<script setup lang="ts">
import { ref, onMounted } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

interface IGltfLoaderResult {
  animations: Array<THREE.AnimationClip>
  scene: THREE.Group
  scenes: Array<THREE.Group>
  cameras: Array<THREE.Camera>
  asset: Object
}

// 定义模型配置接口
interface ModelDefinition {
  origin: maplibregl.LngLatLike
  altitude: number
  rotate: [number, number, number]
  scale: number
  url: string
}

// 示例：多个模型配置
const models: ModelDefinition[] = [
  {
    origin: [117.134407, 38.325195],
    altitude: 0,
    rotate: [Math.PI / 2, 0, 0],
    scale: 0.05,
    url: new URL('@/assets/model/common/um_windmill_10_kw.glb', import.meta.url).href
  },
  {
    origin: [117.135000, 38.325500],
    altitude: 0,
    rotate: [Math.PI / 2, 0, 0],
    scale: 0.05,
    url: new URL('@/assets/model/common/um_windmill_10_kw.glb', import.meta.url).href
  }
  // 可继续添加更多模型
]

const mapRef = ref<HTMLElement | null>(null)
onMounted(() => {
  if (!mapRef.value) return
  initMap(mapRef.value)
})

/**
 * 初始化光源和地面
 */
function initLightsAndGround(scene: THREE.Scene, mercatorZ: number) {
  // 添加定向光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 3)
  directionalLight.position.set(100, 200, 100)
  directionalLight.castShadow = true
  scene.add(directionalLight)

  // 配置阴影属性
  directionalLight.shadow.camera.near = 0.1
  directionalLight.shadow.camera.far = 2000
  directionalLight.shadow.camera.left = -500
  directionalLight.shadow.camera.right = 500
  directionalLight.shadow.camera.top = 500
  directionalLight.shadow.camera.bottom = -500
  directionalLight.shadow.mapSize.width = 4096
  directionalLight.shadow.mapSize.height = 4096

  // 添加地面
  const groundGeometry = new THREE.PlaneGeometry(1000, 1000)
  const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.5 })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = mercatorZ
  ground.receiveShadow = true
  scene.add(ground)
}

/**
 * 加载 GLTF 模型并添加到场景中对应位置
 */
function addModelToScene(modelDef: ModelDefinition, scene: THREE.Scene) {
  // 使用 GLTFLoader 加载模型
  const loader = new GLTFLoader()
  loader.load(
    modelDef.url,
    (gltf: IGltfLoaderResult) => {
      gltf.scene.traverse((node: any) => {
        if (node.isMesh || node.isLight) {
          node.castShadow = true
          node.receiveShadow = true
        }
      })
      // 根据经纬度和海拔计算 Mercator 坐标
      const mercatorCoord = maplibregl.MercatorCoordinate.fromLngLat(modelDef.origin, modelDef.altitude)
      // 模型加载后，添加到场景中
      gltf.scene.position.set(mercatorCoord.x, mercatorCoord.y, mercatorCoord.z)
      // 根据当前坐标系计算缩放比例（1米对应多少坐标单位）
      const scaleFactor = mercatorCoord.meterInMercatorCoordinateUnits()
      gltf.scene.scale.set(modelDef.scale * scaleFactor, modelDef.scale * scaleFactor, modelDef.scale * scaleFactor)
      gltf.scene.rotation.set(modelDef.rotate[0], modelDef.rotate[1], modelDef.rotate[2])
      scene.add(gltf.scene)
    },
    undefined,
    (error: Error) => {
      console.error('加载模型出错', error)
    }
  )
}

/**
 * 自定义图层：将多个模型添加到地图中
 */
const customLayer: maplibregl.AddLayerObject = {
  id: '3d-models',
  type: 'custom',
  renderingMode: '3d',
  onAdd(this: any, map: maplibregl.Map, gl: WebGL2RenderingContext) {
    // 初始化 Three.js 相机和场景
    this.camera = new THREE.Camera()
    this.scene = new THREE.Scene()

    // 这里统一使用第一个模型的 z 坐标来作为地面高度（也可自定义）
    const baseMercator = maplibregl.MercatorCoordinate.fromLngLat(models[0].origin, models[0].altitude)
    initLightsAndGround(this.scene, baseMercator.z)

    // 遍历所有模型配置，加载模型并添加到场景中
    models.forEach((modelDef) => {
      addModelToScene(modelDef, this.scene)
    })

    this.map = map
    // 初始化渲染器，使用 maplibre 的 canvas 和 WebGL 上下文
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true
    })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.autoClear = false
  },
  render(this: any, gl, args) {
    // 使用 MapLibre 提供的投影矩阵
    const m = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix)
    this.camera.projectionMatrix = m
    this.renderer.resetState()
    this.renderer.render(this.scene, this.camera)
    this.map.triggerRepaint()
  }
}

/**
 * 初始化地图
 */
function initMap(el: HTMLElement) {
  const map = new maplibregl.Map({
    container: el,
    style: {
      version: 8,
      sources: {
        satellite: {
          type: 'raster',
          tiles: ['http://1.119.169.101:10041/tile/td_yx_map/png/{z}/{x}/{y}'],
          maxzoom: 13,
          tileSize: 256
        },
        labels: {
          type: 'raster',
          tiles: ['http://1.119.169.101:10041/tile/td_yx_bz/png/{z}/{x}/{y}'],
          maxzoom: 12,
          tileSize: 256
        },
        satellite_hd: {
          type: 'raster',
          scheme: 'tms',
          tiles: ['http://1.119.169.101:10036/cangzhoudianchang/{z}/{x}/{y}.png'],
          tileSize: 256
        }
      },
      layers: [
        {
          id: 'satellite-layer',
          type: 'raster',
          source: 'satellite',
          minzoom: 0,
          maxzoom: 22,
          paint: { 'raster-resampling': 'linear' }
        },
        {
          id: 'labels-layer',
          type: 'raster',
          source: 'labels',
          minzoom: 0,
          maxzoom: 22,
          paint: { 'raster-resampling': 'linear' }
        },
        {
          id: 'satellite-hd-layer',
          type: 'raster',
          source: 'satellite_hd',
          minzoom: 14,
          maxzoom: 22,
          paint: { 'raster-resampling': 'linear' }
        }
      ]
    },
    center: [117.134407, 38.325195],
    zoom: 16,
    pitch: 45,
    canvasContextAttributes: { antialias: true }
  })

  map.on('style.load', () => {
    map.addLayer(customLayer)
  })
}
</script>

<template>
  <div class="component-class">
    <div class="map" ref="mapRef"></div>
  </div>
</template>

<style lang="less" scoped>
.component-class {
  width: 100%;
  height: 100%;
  > .map {
    width: 100%;
    height: 100%;
  }
}
</style>
