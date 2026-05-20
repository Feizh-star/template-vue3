<script setup lang="ts">
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import CollapsibleTimeline from '@/components/CollapsibleTimeline/CollapsibleTimeline.vue'
import { shallowRef, onMounted } from 'vue'
import { useStainImg } from './compositions/useStainImg'

const mapContainer = ref<HTMLElement | null>(null)
const mapIns = shallowRef<maplibregl.Map | null>(null)

onMounted(() => {
  if (!mapContainer.value) return

  const map = new maplibregl.Map({
    container: mapContainer.value,
    center: [104.29499999, 35.85999999],
    zoom: 4.337,
    minZoom: 3,
    maxZoom: 16,
    style: {
      version: 8,
      sources: {
        'tianditu-vec': {
          type: 'raster',
          tiles: [
            'http://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=42139ec25fe7ae771affe917de5c9ecf',
          ],
          tileSize: 256,
        },
        'tianditu-cva': {
          type: 'raster',
          tiles: [
            'http://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=42139ec25fe7ae771affe917de5c9ecf',
          ],
          tileSize: 256,
        },
      },
      layers: [
        {
          id: 'tianditu-vec-layer',
          type: 'raster',
          source: 'tianditu-vec',
        },
        {
          id: 'tianditu-cva-layer',
          type: 'raster',
          source: 'tianditu-cva',
        },
      ],
    },
  })

  map.once('load', () => {
    mapIns.value = map
  })
})

const { selectedTime } = useStainImg({ mapIns })
</script>

<template>
  <div class="map-page">
    <div ref="mapContainer" class="map-container"></div>
    <div class="timeline-container">
      <CollapsibleTimeline
        v-model:selected="selectedTime"
        :origin="'202605170000'"
        :start="'202605170000'"
        :end-equal="false"
        :days="1"
        :division="60"
        :label-interval="2"
        :time-formatter="'YYYYMMDDHHmm'"
      />
    </div>
  </div>
</template>

<style scoped lang="less">
.map-page {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.map-container {
  width: 100%;
  height: 100%;
}

.timeline-container {
  --float-element-padding: 12px;
  --bottom-chart-height: 252px;
  --timeline-bg: #ffffff; // #05397480
  --common-shadow: 0 0 16px rgba(0, 0, 0, 0.1);
  --wind-edge: var(--float-element-padding);
  position: absolute;
  left: 256px; // 248px
  bottom: var(--wind-edge);
  right: 256px;
  box-shadow: var(--common-shadow);
  :deep(.time-line) {
    --tick-item-width: 8px;
    --time-row-padding: 40px;
    --time-text-color: #626b80;
    --past-time-text-color: #eb8f52;
    --time-tick-line-color: #c8d0df;
    --past-time-tick-line-color: #eba15288;
    --selected-color: #598af6;
    --tips-text-color: #ffffff;
    background-color: var(--timeline-bg);
    border-radius: 8px;
    overflow: hidden;
  }
}
</style>
