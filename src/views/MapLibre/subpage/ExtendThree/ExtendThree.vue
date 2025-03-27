<script setup lang="ts">
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Gplot3DMap } from './lib/gplot3DMap/gplot3DMap'
import { lines, modelNodes, rails } from './test-data'

const mapRef = ref<HTMLElement | null>(null)
onMounted(() => {
  if (!mapRef.value) return
  init(mapRef.value)
})

const mapCenter: maplibregl.LngLatLike = [117.134407, 38.325195]

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
    const customLayer = new Gplot3DMap({
      layerOption: {
        center: mapCenter,
      },
    })
    this.addLayer(customLayer)
    // customLayer.addGltfNodes()
    // customLayer.addFlowLines(lines)

    customLayer
      .addFont('font1', new URL('./font/Microsoft_YaHei_Regular.json', import.meta.url).href)
      .then(() => {
        customLayer?.addGltfNodes(modelNodes)
        customLayer?.addRails(rails)
      })
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
