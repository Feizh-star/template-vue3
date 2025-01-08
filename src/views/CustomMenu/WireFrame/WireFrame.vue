<script setup lang="ts">
import { useInit } from './compositions/useInit'

const canvasRef = ref<HTMLCanvasElement | null>(null)

useInit({ canvasRef })
</script>

<template>
  <div class="component-class">
    <canvas ref="canvasRef" class="canvas"></canvas>
  </div>
</template>

<style lang="less" scoped>
.component-class {
  width: 100%;
  height: 100%;
  .canvas {
    width: 300px;
    height: 300px;
    display: block;
  }
}
</style>
