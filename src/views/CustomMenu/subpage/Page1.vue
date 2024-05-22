<script setup lang="ts">
import { useSquare } from './compositions/useSquare'
import { useTestPoints } from './compositions/useTestPoints'
import * as lodashLib from 'lodash'

const renderCanvas = ref<HTMLCanvasElement | null>(null)

useSquare({ el: renderCanvas })
// useTestPoints({ el: renderCanvas })
</script>

<template>
  <div class="custom-page1">
    <canvas ref="renderCanvas"></canvas>
  </div>
</template>

<style scoped lang="less">
.custom-page1 {
  width: 100%;
  height: 100%;
  padding: 16px;
  > canvas {
    width: 100%;
    height: 100%;
  }
}
</style>
