<script setup lang="ts">
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const mapRef = ref<HTMLElement | null>(null)
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
    maxZoom: 20,
    pitch: 0,
    canvasContextAttributes: { antialias: true },
    style: {
      version: 8,
      sources: {
        // 1. 低分辨率卫星底图（原生切片 zoom 0~17）
        satellite: {
          type: 'raster',
          tiles: [
            'http://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=42139ec25fe7ae771affe917de5c9ecf',
          ],
          maxzoom: 17, // 假设这是瓦片的最大放大范围
          tileSize: 256,
        },
        // 2. 标注（同样原生 zoom 0~17）
        labels: {
          type: 'raster',
          tiles: [
            // 假设标注瓦片的 URL 格式与卫星底图类似
            'http://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=42139ec25fe7ae771affe917de5c9ecf',
          ],
          maxzoom: 17, // 假设这是瓦片的最大放大范围
          tileSize: 256,
        },
        // 3. 高清卫星底图（局部区域，原生切片 zoom 14~20）
        satellite_hd: {
          type: 'raster',
          scheme: 'tms',
          tiles: [
            // 假设高清瓦片 URL 格式与前两者一致，只是路径不同
            'http://localhost/cangzhoudianchang/{z}/{x}/{y}.png',
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
          maxzoom: 20.1, // 值等于高清图层的maxzoom，zoom 超过 17 时允许模糊放大
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
          maxzoom: 20.1, // 值等于高清图层的maxzoom，zoom 超过 17 时允许模糊放大
          paint: {
            'raster-resampling': 'linear',
          },
        },
        // // 高清卫星底图图层：仅在 zoom 11～18 时显示
        {
          id: 'satellite-hd-layer',
          type: 'raster',
          source: 'satellite_hd',
          minzoom: 17, // zoom小于17就不显示这个图层了
          maxzoom: 20.1, // 要比期望的最大缩放略大一点点，这个maxzoom好像是不包含最大值的，如果等于20会白屏
          paint: {
            'raster-resampling': 'linear',
          },
          // 若高清瓦片只在局部区域有效，可通过设置 bounds 属性限制其显示范围
        },
      ],
    },
  })

  await map.once('load')

  map.on('zoomend', () => {
    console.log('zoom', map.getZoom())
  })
  console.log('map-loaded')
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
  position: relative;
  overflow: hidden;
  > .map {
    width: 100%;
    height: 100%;
  }
}
</style>
