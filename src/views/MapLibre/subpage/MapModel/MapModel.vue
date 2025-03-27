<script setup lang="ts">
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
  scale: [number, number, number]
  url: string
}

const mapRef = ref<HTMLElement | null>(null)
onMounted(() => {
  if (!mapRef.value) return
  init(mapRef.value)
})

const mapCenter: maplibregl.LngLatLike = [117.134407, 38.325195]
// 示例：多个模型配置
const models: ModelDefinition[] = [
  {
    origin: [117.133407, 38.325195],
    altitude: 0,
    // rotate: [Math.PI / 2, -Math.PI / 2, 0],
    rotate: [0, -Math.PI / 2, 0],
    scale: [0.05, 0.05, 0.05],
    url: new URL('@/assets/model/common/um_windmill_10_kw.glb', import.meta.url).href,
  },
  {
    origin: [117.135407, 38.324195],
    altitude: 0,
    rotate: [0, -Math.PI / 2, 0],
    scale: [0.05, 0.05, 0.05],
    url: new URL('@/assets/model/common/um_windmill_10_kw.glb', import.meta.url).href,
  },
  // 可继续添加更多模型
]
let gLTFLoaderObject: any = null
function loadGltfModel<T>(modelSrc: string, process?: (xhr: XMLHttpRequest) => void): Promise<T> {
  if (!gLTFLoaderObject) {
    gLTFLoaderObject = new GLTFLoader()
  }
  return new Promise((resolve, reject) => {
    gLTFLoaderObject.load(
      modelSrc,
      (gltf: T) => {
        resolve(gltf)
      },
      process,
      (error: any) => {
        reject(error)
      }
    )
  })
}

/*
 * Helper function used to get threejs-scene-coordinates from mercator coordinates.
 * This is just a quick and dirty solution - it won't work if points are far away from each other
 * because a meter near the north-pole covers more mercator-units
 * than a meter near the equator.
 */
function calculateDistanceMercatorToMeters(from, to) {
  const mercatorPerMeter = from.meterInMercatorCoordinateUnits()
  // mercator x: 0=west, 1=east
  const dEast = to.x - from.x
  const dEastMeter = dEast / mercatorPerMeter
  // mercator y: 0=north, 1=south
  const dNorth = from.y - to.y
  const dNorthMeter = dNorth / mercatorPerMeter
  return { dEastMeter, dNorthMeter }
}

function getFpsTool() {
  let startTime = 0
  let times = 0
  return function () {
    if (!startTime) {
      startTime = new Date().getTime()
    }
    const escape = (new Date().getTime() - startTime) / 1000
    times++
    if (escape) {
      console.log(times / escape)
    }
  }
}
const getFps = getFpsTool()

// Configuration of the custom layer for a 3D model, implementing `CustomLayerInterface`.
const customLayer = {
  id: '3d-model',
  type: 'custom',
  renderingMode: '3d',

  onAdd(map, gl) {
    /**
     * Setting up three.js scene.
     * We're placing model1 and model2 in such a way that the whole scene fits over the terrain.
     */
    this.map = map
    this.camera = new THREE.Camera()
    this.scene = new THREE.Scene()

    const light = new THREE.DirectionalLight(0xffffff)
    // Making it just before noon - light coming from south-east.
    light.position.set(50, 70, 30).normalize()
    this.scene.add(light)

    // Axes helper to show how threejs scene is oriented.
    const axesHelper = new THREE.AxesHelper(60)
    this.scene.add(axesHelper)

    models.forEach((item) => {
      loadGltfModel<IGltfLoaderResult>(item.url).then((gltfModel) => {
        const modelObject = gltfModel.scene
        // Getting model elevations in meters above sea level
        const sceneElevation = map.queryTerrainElevation(mapCenter) || 0
        const modelElevation = map.queryTerrainElevation(item.origin) || 0
        const modelUp = modelElevation - sceneElevation + item.altitude

        // Getting model x and y (in meters) relative to scene origin.
        const sceneOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(mapCenter)
        const modelMercator = maplibregl.MercatorCoordinate.fromLngLat(item.origin)
        const { dEastMeter: model1east, dNorthMeter: model1north } =
          calculateDistanceMercatorToMeters(sceneOriginMercator, modelMercator)

        modelObject.position.set(model1east, modelUp, -model1north)
        modelObject.scale.set(...item.scale) // 缩放模型使大小正常
        modelObject.rotation.set(...item.rotate) // 地图投影矩阵mainMatrix导致threejs坐标系绕x轴旋转了-Math.PI / 2（顺时针），所以这里抵消一下

        this.scene.add(modelObject)
      })
    })

    // Use the MapLibre GL JS map canvas for three.js.
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    })

    this.renderer.autoClear = false
  },

  render(gl, args) {
    const offsetFromCenterElevation = this.map.queryTerrainElevation(mapCenter) || 0
    const sceneOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(
      mapCenter,
      offsetFromCenterElevation
    )
    const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2)

    const scale = sceneOriginMercator.meterInMercatorCoordinateUnits()

    const m = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix)
    const l = new THREE.Matrix4()
      .makeTranslation(sceneOriginMercator.x, sceneOriginMercator.y, sceneOriginMercator.z)
      .scale(new THREE.Vector3(scale, -scale, scale))
      .multiply(rotationX)

    this.camera.projectionMatrix = m.multiply(l)
    this.renderer.resetState()
    this.renderer.render(this.scene, this.camera)
    this.map.triggerRepaint()

    // getFps()
  },
}

function init(el: HTMLElement) {
  const map = new maplibregl.Map({
    container: el,
    center: mapCenter, // starting position
    zoom: 16, // starting zoom
    pitch: 45,
    canvasContextAttributes: { antialias: true },
    style: {
      version: 8,
      sources: {
        // 1. 低分辨率卫星底图（原生切片 zoom 0~11，但 zoom 超过 11 时允许模糊放大）
        satellite: {
          type: 'raster',
          tiles: ['http://1.119.169.101:10041/tile/td_yx_map/png/{z}/{x}/{y}'],
          maxzoom: 13,
          tileSize: 256,
        },
        // 2. 标注（同样原生 zoom 0~11，zoom 超过 11 时放大显示）
        labels: {
          type: 'raster',
          tiles: [
            // 假设标注瓦片的 URL 格式与卫星底图类似
            'http://1.119.169.101:10041/tile/td_yx_bz/png/{z}/{x}/{y}',
          ],
          maxzoom: 12,
          tileSize: 256,
        },
        // 3. 高清卫星底图（局部区域，原生切片 zoom 11~18）
        satellite_hd: {
          type: 'raster',
          scheme: 'tms',
          tiles: [
            // 假设高清瓦片 URL 格式与前两者一致，只是路径不同
            'http://1.119.169.101:10036/cangzhoudianchang/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
        },
      },
      layers: [
        // 卫星底图图层：始终显示（zoom 0～18），超出原生切片范围后会自动放大（允许模糊）
        {
          id: 'satellite-layer',
          type: 'raster',
          source: 'satellite',
          minzoom: 0,
          maxzoom: 22,
          paint: {
            'raster-resampling': 'linear', // 线性插值，保证放大时平滑模糊效果
          },
        },
        // 标注图层：同样始终显示，保证放大后依然能看到标注
        {
          id: 'labels-layer',
          type: 'raster',
          source: 'labels',
          minzoom: 0,
          maxzoom: 22,
          paint: {
            'raster-resampling': 'linear',
          },
        },
        // 高清卫星底图图层：仅在 zoom 11～18 时显示
        {
          id: 'satellite-hd-layer',
          type: 'raster',
          source: 'satellite_hd',
          minzoom: 14,
          maxzoom: 22,
          paint: {
            'raster-resampling': 'linear',
          },
          // 若高清瓦片只在局部区域有效，可通过设置 bounds 属性限制其显示范围
        },
      ],
    },
  })

  map.once('load', function (this: maplibregl.Map) {
    this.addLayer(customLayer)
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
