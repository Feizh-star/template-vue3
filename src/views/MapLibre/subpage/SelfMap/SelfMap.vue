<script setup lang="ts">
import type { IMapInstance } from 'hxmap'
import { Map as HxMap, TileLayer } from 'hxmap'
import { shallowRef, onMounted } from 'vue'
import type { IMapInstance2 } from 'hxmap'
import { homeTyphoonManager } from '@/compositions/typhoon/index'
import './style/hxmap.css'
// @ts-ignore
import TyphoonDatas from './data/typhoon.json'

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

const testTyphoon = (type: number) => {
  if (type === 1) {
    homeTyphoonManager.addHomeTyphoons(mapInstance.value as IMapInstance2, TyphoonDatas, true)
  }
  if (type === 2) {
    homeTyphoonManager.clearHomeTyphoons(mapInstance.value as IMapInstance2)
  }
}
</script>

<template>
  <div class="map-page">
    <div id="portal-map"></div>
    <div class="float-btn">
      <button @click="() => testTyphoon(1)">台风</button>
      &ensp;
      <button @click="() => testTyphoon(2)">清除</button>
    </div>
  </div>
</template>

<style scoped>
.map-page {
  width: 100%;
  height: 100vh;
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
</style>
