<script setup lang="ts">
import { station } from './data'

const numReg = /^\d+$/
const numStation = station.filter(s => numReg.test(s.station_id_c || ''))
const notNumStation = station.filter(s => !numReg.test(s.station_id_c || ''))
console.log(station.length, numStation.length, notNumStation.length)
console.log(numStation.map(a => a.station_id_c), notNumStation.map(a => a.station_id_c))

</script>

<template>
  <div class="test-menu">
    1
  </div>
</template>

<style scoped lang="less">
.test-menu {
  width: 100%;
  height: 100%;
  background-color: #fff;
}
</style>
