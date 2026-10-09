<script setup lang="ts">
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import CollapsibleTimeline from '@/components/CollapsibleTimeline/CollapsibleTimeline.vue'
import { ElMessage } from 'element-plus'
import { shallowRef, onMounted, ref } from 'vue'
import {
  defaultOption,
  getStainImageUrl,
  imgColor,
  imgScale,
  useStainImg,
} from './compositions/useStainImg'
import cutUrl from '../SelfMap/assets/100000.png'
import {
  exportColorfulMapImage,
  exportColorfulMapImageInWorker,
  type IColorfulMapWorkerExportOptions,
} from '@/libs/ColorfulMapImageExport'

const mapContainer = ref<HTMLElement | null>(null)
const mapIns = shallowRef<maplibregl.Map | null>(null)
const exportingMode = ref<'main' | 'worker' | null>(null)

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
  map.on('click', (e) => {
    console.log(e.lngLat)
  })
})

const { selectedTime } = useStainImg({ mapIns })

async function getExportOptions(time: string): Promise<IColorfulMapWorkerExportOptions> {
  const responses = await Promise.all([
    fetch('/dataset/geojson/province.json'),
    fetch('/dataset/geojson/china.json'),
  ])
  if (!responses.every((response) => response.ok)) {
    throw new Error(
      `省界 GeoJSON 加载失败：${responses.map((response) => response.status).join(', ')}`
    )
  }
  const [provinceGeoJson, chinaGeoJson] = await Promise.all(
    responses.map((response) => response.json())
  )
  return {
    image: getStainImageUrl(time),
    lonmin: defaultOption.lonmin,
    lonmax: defaultOption.lonmax,
    latmin: defaultOption.latmin,
    latmax: defaultOption.latmax,
    // outputBounds: {
    //   lonmin: 45,
    //   lonmax: 140,
    //   latmin: 15.5,
    //   latmax: 58,
    // },
    scale: imgScale,
    colors: imgColor,
    linear: defaultOption.linear,
    flipy: defaultOption.flipy,
    format: 'jpg',
    cut: {
      image: cutUrl,
      lonmin: defaultOption.cutlonmin,
      lonmax: defaultOption.cutlonmax,
      latmin: defaultOption.cutlatmin,
      latmax: defaultOption.cutlatmax,
    },
    boundaries: [
      {
        data: provinceGeoJson,
        color: '#4b3a58',
        lineWidth: 1.2,
        opacity: 0.95,
        label: { enabled: true, labelMap: { 新疆维吾尔自治区: '新疆' } },
      },
      {
        data: chinaGeoJson,
        color: '#ff0000',
        lineWidth: 2,
        opacity: 0.95,
      },
    ],
    axes: {
      width: 1800,
      lonStep: 10,
      latStep: 5,
      color: '#455464',
      labelColor: '#455464',
      margin: [56, 16, 56, 64],
    },
    colorScale: {
      enabled: true,
      blockWidth: 16,
      blockHeight: 22,
      showFirstLabel: false,
      font: '16px sans-serif',
      color: '#ff0000',
      offset: 16,
      labelGap: 8,
    },
  }
}

function downloadExport(blob: Blob, time: string, mode: 'main' | 'worker') {
  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = `colorful-map-${time}${mode === 'worker' ? '-worker' : ''}.${
    blob.type === 'image/jpeg' ? 'jpg' : 'png'
  }`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
}

async function exportColorfulMap(mode: 'main' | 'worker') {
  if (exportingMode.value) return

  exportingMode.value = mode
  try {
    const time = selectedTime.value || '202605171000'
    const options = await getExportOptions(time)
    const blob =
      mode === 'worker'
        ? await exportColorfulMapImageInWorker(options)
        : await exportColorfulMapImage({ ...options, preferOffscreenCanvas: true })
    downloadExport(blob, time, mode)
    ElMessage.success('填色图导出完成')
  } catch (error) {
    console.error(error)
    ElMessage.error(error instanceof Error ? error.message : '填色图导出失败')
  } finally {
    exportingMode.value = null
  }
}
</script>

<template>
  <div class="map-page">
    <div ref="mapContainer" class="map-container"></div>
    <div class="export-actions">
      <button
        class="export-button"
        type="button"
        :disabled="Boolean(exportingMode)"
        @click="exportColorfulMap('main')"
      >
        {{ exportingMode === 'main' ? '导出中...' : '导出填色图' }}
      </button>
      <button
        class="export-button"
        type="button"
        :disabled="Boolean(exportingMode)"
        @click="exportColorfulMap('worker')"
      >
        {{ exportingMode === 'worker' ? '导出中...' : 'Worker 导出填色图' }}
      </button>
    </div>
    <div class="timeline-container">
      <CollapsibleTimeline
        v-model:selected="selectedTime"
        :origin="'202605170000'"
        :start="'202605170000'"
        :end-equal="false"
        :days="1"
        :interval="15"
        :play-interval="100"
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

.export-actions {
  position: absolute;
  z-index: 5;
  top: 20px;
  right: 20px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  max-width: calc(100% - 40px);
}

.export-button {
  min-width: 112px;
  height: 36px;
  padding: 0 16px;
  border: 1px solid rgba(59, 80, 103, 0.28);
  border-radius: 6px;
  color: #ffffff;
  background: rgba(45, 64, 84, 0.92);
  box-shadow: 0 4px 14px rgba(27, 41, 58, 0.22);
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease, opacity 0.2s ease;
  &:hover:not(:disabled) {
    background: rgba(32, 50, 69, 0.98);
  }
  &:disabled {
    cursor: wait;
    opacity: 0.72;
  }
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
