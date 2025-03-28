<script setup lang="ts">
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Gplot3DLayer } from './lib/Gplot3DLayer/Gplot3DLayer'
import { getModelNodes, getModelStraightLink, getAreaRails } from './test-data'

const mapRef = ref<HTMLElement | null>(null)
const tooltipEl = ref<HTMLElement | null>(null)
onMounted(() => {
  if (!mapRef.value) return
  init(mapRef.value)
})

const mapCenter: [number, number] = [117.134407, 38.325195]

async function init(el: HTMLElement) {
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

  await map.once('load')
  const gplot3DLayer = new Gplot3DLayer({
    origin: mapCenter,
    axesHelper: {
      enable: false,
    },
  })
  map.addLayer(gplot3DLayer)
  const models = getModelNodes(mapCenter)
  const lines = getModelStraightLink(models.map((item) => item.position))
  const rails = getAreaRails(models.map((item) => item.position))

  await gplot3DLayer.addFont(
    'font1',
    new URL('./font/Microsoft_YaHei_Regular.json', import.meta.url).href
  )
  gplot3DLayer.addFlowLinesLnglat(lines)
  gplot3DLayer.addGltfNodesLngLat(models)
  gplot3DLayer.addRailsLngLat(rails)
  gplot3DLayer.onGltfNodes('mousemove', (type, e, models, datas) => {
    console.log('mousemove')
    if (!tooltipEl.value || !mapRef.value || !datas[0]?.common?.name) return
    const mevent = e as MouseEvent
    const left = mevent.clientX - mapRef.value.getBoundingClientRect().left
    const top = mevent.clientY - mapRef.value.getBoundingClientRect().top
    tooltipEl.value.style.transform = `translate(${left + 16}px, ${top + 16}px)`
    tooltipEl.value.innerText = datas[0]?.common?.name || ''
  })
  gplot3DLayer?.onGltfNodes('mouseenter', (type, e, models, datas) => {
    if (!tooltipEl.value || !datas[0]?.common?.name) return
    tooltipEl.value.style.display = `block`
  })
  gplot3DLayer?.onGltfNodes('mouseleave', (type, e, models, datas) => {
    if (!tooltipEl.value || !datas[0]?.common?.name) return
    tooltipEl.value.style.display = `none`
  })
}
</script>

<template>
  <div class="component-class">
    <div class="map" ref="mapRef"></div>
    <div class="tooltip" ref="tooltipEl">123</div>
  </div>
</template>

<style lang="less" scoped>
.component-class {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  > .map {
    width: 100%;
    height: 100%;
  }
  .tooltip {
    position: absolute;
    display: none;
    pointer-events: none;
    padding: 8px;
    top: 16px;
    left: 16px;
    background-color: #011a42;
    color: #ffffff;
    border: 1px solid #0a69d5;
  }
}
</style>
