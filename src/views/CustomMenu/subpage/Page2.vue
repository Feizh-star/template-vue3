<script setup lang="ts">
import { Gplot3D } from './compositions/gplot3D'

const renderEl = ref<HTMLElement | null>(null)

const positions: [number, number, number][] = [
  [30, 0, 30],
  [-30, 0, 30],
  [-30, 0, -30],
  [30, 0, -30],
  [30, 0, 30],
]
const positions1: [number, number, number][] = [
  [15, 0, 15],
  [15, 0, -15],
  [-15, 0, -15],
  [-15, 0, 15],
  [15, 0, 15],
]

const color = ['#53ffc1', '#ff5600']
const lines = [
  {
    id: 2,
    path: positions,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 5,
    path: positions1,
    lineMaterial: { color: color[1] },
    effect: {
      enable: true,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[1]}ff`, percent: 0.15 },
        { color: `${color[1]}80`, percent: 0.4 },
        { color: `${color[1]}00`, percent: 1 },
      ],
    },
  },
]
const nodes = [
  {
    src: new URL('./assets/sprite.png', import.meta.url).href,
    center: [0.5, 0.5],
    scale: [15, 15, 15],
    position: [-30, 0, 30],
    offset: [-0.3, 1, 2],
  },
  {
    src: new URL('./assets/sprite.png', import.meta.url).href,
    center: [0.5, 0.5],
    scale: [15, 15, 15],
    position: [-15, 0, 15],
    offset: [-0.3, 1, 2],
  },
]
onMounted(() => {
  if (!renderEl.value) return
  const gplot = new Gplot3D({
    el: renderEl.value,
    scene: {
      backgroundColor: '#1a212e',
    },
    camera: {
      initialPosition: { y: 300 },
    },
  })
  gplot.addFlowLines(lines)
  gplot.addSpriteNodes(nodes)
  let a = false
  setInterval(() => {
    gplot.setStatusById(5, a, {
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[1]}ff`, percent: 0.15 },
        { color: `${color[1]}80`, percent: 0.4 },
        { color: `${color[1]}00`, percent: 1 },
      ],
    })
    a = !a
  }, 3000)
})
</script>

<template>
  <div class="custom-page2" ref="renderEl">
    <el-empty description="CustomMenu 页面二" />
  </div>
</template>

<style scoped lang="less">
.custom-page2 {
  width: 100%;
  height: 100%;
  padding: 16px;
  > canvas {
    width: 100%;
    height: 100%;
  }
}
</style>
