<script setup lang="ts">
import CollapsibleTimeline from '@/components/CollapsibleTimeline/CollapsibleTimeline.vue'
import type { IMapInstance, IMapInstance2 } from 'hxmap'
import { Map as HxMap, TileLayer } from 'hxmap'
import { shallowRef, onMounted } from 'vue'
import './style/hxmap.css'
import { useTyphoon } from './compositions/useTyphoon'
import { useStainImg } from './compositions/useStainImg'

const mapInstance = shallowRef<IMapInstance | null>(null)
onMounted(() => {
  mapInstance.value = new HxMap({
    content: 'portal-map',
    center: [35.85999999, 104.29499999],
    zoom: 4.337,
    minZoom: 3,
    maxZoom: 16,
  })
  new TileLayer({
    url: 'http://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=42139ec25fe7ae771affe917de5c9ecf',
  }).addTo(mapInstance.value)
  new TileLayer({
    url: 'http://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=42139ec25fe7ae771affe917de5c9ecf',
  }).addTo(mapInstance.value)
})

const { testTyphoon } = useTyphoon({ mapInstance: mapInstance as Ref<IMapInstance2> })

const { selectedTime } = useStainImg({ mapIns: mapInstance as Ref<IMapInstance2 | null> })
</script>

<template>
  <div class="map-page">
    <div id="portal-map"></div>
    <div class="float-btn">
      <button @click="() => testTyphoon(1)">台风</button>
      &ensp;
      <button @click="() => testTyphoon(2)">清除</button>
    </div>
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
  width: 100%;
  height: 100%;
  position: relative;
}
#portal-map {
  width: 100%;
  height: 100%;
}
.float-btn {
  position: absolute;
  left: 20px;
  top: 20px;
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
