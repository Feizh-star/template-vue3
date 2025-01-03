<script setup lang="ts">
import { useInit } from './compositions/useInit'

const canvasRef = ref<HTMLCanvasElement | null>(null)

useInit({ canvasRef })
</script>

<template>
  <div class="rectangle-v2">
    <canvas ref="canvasRef" class="canvas"></canvas>
  </div>
</template>

<style scoped lang="less">
.rectangle-v2 {
  width: 100%;
  height: 100%;
  .canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
}
</style>
