<script setup lang="ts">
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

const mapRef = ref<HTMLElement | null>(null)
onMounted(() => {
  if (!mapRef.value) return
  init(mapRef.value)
})

const modelOrigin: maplibregl.LngLatLike = [117.134407, 38.325195];
const modelAltitude = 0;
const modelRotate = [Math.PI / 2, 0, 0];
const modelAsMercatorCoordinate = maplibregl.MercatorCoordinate.fromLngLat(
    modelOrigin,
    modelAltitude
);

const modelTransform = {
    translateX: modelAsMercatorCoordinate.x,
    translateY: modelAsMercatorCoordinate.y,
    translateZ: modelAsMercatorCoordinate.z,
    rotateX: modelRotate[0],
    rotateY: modelRotate[1],
    rotateZ: modelRotate[2],
    scale: modelAsMercatorCoordinate.meterInMercatorCoordinateUnits()
};
// 示例：多个模型配置
const models: ModelDefinition[] = [
  {
    origin: [117.134407, 38.325195],
    altitude: 0,
    rotate: [0, -Math.PI / 2, 0],
    scale: 0.05,
    url: new URL('@/assets/model/common/um_windmill_10_kw.glb', import.meta.url).href
  },
  {
    origin: [117.144407, 38.325195],
    altitude: 0,
    rotate: [0, -Math.PI / 2, 0],
    scale: 0.05,
    url: new URL('@/assets/model/common/um_windmill_10_kw.glb', import.meta.url).href
  }
  // 可继续添加更多模型
]
let gLTFLoaderObject: any = null
function loadGltfModel<T>(
  modelSrc: string,
  process?: (xhr: XMLHttpRequest) => void
): Promise<T> {
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
const customLayer: maplibregl.AddLayerObject = {
    id: '3d-model',
    type: 'custom',
    renderingMode: '3d',
    // 初始化，自定义图层
    onAdd(this: any, map: maplibregl.Map, gl: WebGL2RenderingContext) {
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();

        const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
        directionalLight.position.set(100, 200, 100);
        directionalLight.castShadow = true; // 开启平行光的阴影效果
        this.scene.add(directionalLight);

        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 2000;
        directionalLight.shadow.camera.left = -500;
        directionalLight.shadow.camera.right = 500;
        directionalLight.shadow.camera.top = 500;
        directionalLight.shadow.camera.bottom = -500;

        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;

        const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
        const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.5 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = modelAsMercatorCoordinate.z;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // const loader = new GLTFLoader();
        // loader.load(
        //     new URL('@/assets/model/common/um_windmill_10_kw.glb', import.meta.url).href,
        //     (gltf: IGltfLoaderResult) => {
        //         gltf.scene.traverse(function (node: any) {
        //             if (node.isMesh || node.isLight) {
        //                 node.castShadow = true;
        //                 node.receiveShadow = true;
        //             }
        //         });
        //         gltf.scene.position.set(0, 0, 0)
        //         gltf.scene.rotation.set(0, -Math.PI / 2, 0)
        //         gltf.scene.scale.set(0.05, 0.05, 0.05)
        //         this.scene.add(gltf.scene);
        //     }
        // );
        models.forEach((item) => {
          loadGltfModel<IGltfLoaderResult>(item.url).then((gltfModel) => {
              const modelObject = gltfModel.scene
              modelObject.traverse(function (node: any) {
                  if (node.isMesh || node.isLight) {
                      node.castShadow = true;
                      node.receiveShadow = true;
                  }
              });
              // 根据经纬度和海拔计算 Mercator 坐标
              const mercatorCoord = maplibregl.MercatorCoordinate.fromLngLat(item.origin, item.altitude)
              // 模型加载后，添加到场景中
              console.log(modelObject)
              console.log(item.origin, mercatorCoord.x, mercatorCoord.y, mercatorCoord.z)
              modelObject.position.set(mercatorCoord.x, mercatorCoord.y, mercatorCoord.z)
              // 根据当前坐标系计算缩放比例（1米对应多少坐标单位）
              const scaleFactor = mercatorCoord.meterInMercatorCoordinateUnits()
              modelObject.scale.set(item.scale, item.scale, item.scale)
              modelObject.rotation.set(item.rotate[0], item.rotate[1], item.rotate[2])
              this.scene.add(modelObject)
              // modelObject.position.set(0, 0, 0)
              // modelObject.rotation.set(0, -Math.PI / 2, 0)
              // modelObject.scale.set(0.05, 0.05, 0.05)
              // this.scene.add(modelObject);
          })
        })
        this.map = map;

        this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true
        });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.renderer.autoClear = false;
    },
    render(this: any, gl, args) {
        const rotationX = new THREE.Matrix4().makeRotationAxis(
            new THREE.Vector3(1, 0, 0),
            modelTransform.rotateX
        );
        const rotationY = new THREE.Matrix4().makeRotationAxis(
            new THREE.Vector3(0, 1, 0),
            modelTransform.rotateY
        );
        const rotationZ = new THREE.Matrix4().makeRotationAxis(
            new THREE.Vector3(0, 0, 1),
            modelTransform.rotateZ
        );

        const m = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
        const l = new THREE.Matrix4()
            .makeTranslation(
                modelTransform.translateX,
                modelTransform.translateY,
                modelTransform.translateZ
            )
            .scale(
                new THREE.Vector3(
                    modelTransform.scale,
                    -modelTransform.scale,
                    modelTransform.scale
                )
            )
            .multiply(rotationX)
            .multiply(rotationY)
            .multiply(rotationZ);

        this.camera.projectionMatrix = m.multiply(l);
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
        this.map.triggerRepaint();
    }
};

function init(el: HTMLElement) {
  const map = new maplibregl.Map({
      container: el,
      style: {
        version: 8,
        sources: {
          // 1. 低分辨率卫星底图（原生切片 zoom 0~11，但 zoom 超过 11 时允许模糊放大）
          'satellite': {
            type: 'raster',
            tiles: [
              'http://1.119.169.101:10041/tile/td_yx_map/png/{z}/{x}/{y}'
            ],
            maxzoom: 13,
            tileSize: 256,
          },
          // 2. 标注（同样原生 zoom 0~11，zoom 超过 11 时放大显示）
          'labels': {
            type: 'raster',
            tiles: [
              // 假设标注瓦片的 URL 格式与卫星底图类似
              'http://1.119.169.101:10041/tile/td_yx_bz/png/{z}/{x}/{y}'
            ],
            maxzoom: 12,
            tileSize: 256,
          },
          // 3. 高清卫星底图（局部区域，原生切片 zoom 11~18）
          'satellite_hd': {
            type: 'raster',
            scheme: 'tms',
            tiles: [
              // 假设高清瓦片 URL 格式与前两者一致，只是路径不同
              'http://1.119.169.101:10036/cangzhoudianchang/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
          }
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
              'raster-resampling': 'linear' // 线性插值，保证放大时平滑模糊效果
            }
          },
          // 标注图层：同样始终显示，保证放大后依然能看到标注
          {
            id: 'labels-layer',
            type: 'raster',
            source: 'labels',
            minzoom: 0,
            maxzoom: 22,
            paint: {
              'raster-resampling': 'linear'
            }
          },
          // 高清卫星底图图层：仅在 zoom 11～18 时显示
          {
            id: 'satellite-hd-layer',
            type: 'raster',
            source: 'satellite_hd',
            minzoom: 14,
            maxzoom: 22,
            paint: {
              'raster-resampling': 'linear'
            }
            // 若高清瓦片只在局部区域有效，可通过设置 bounds 属性限制其显示范围
          }
        ]
      },
      center: [117.134407, 38.325195], // starting position
      zoom: 16, // starting zoom
      pitch: 45,
      canvasContextAttributes: {antialias: true}
  });

  map.on('style.load', () => {
      map.addLayer(customLayer);
  });
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
