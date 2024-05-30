<script setup lang="ts">
import { Gplot3D } from './compositions/gplot3D'

const renderEl = ref<HTMLElement | null>(null)
const tooltipEl = ref<HTMLElement | null>(null)

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
const modelNodes = [
  {
    src: new URL('./assets/smol_ame_in_an_upcycled_terrarium_hololiveen.glb', import.meta.url).href,
    rotation: [0, 0, 0],
    scale: [5, 5, 5],
    position: [-30, 0, -30],
    offset: [0, 0, 0],
    common: {
      name: '电脑',
    },
  },
  {
    src: new URL('./assets/robot_playground.glb', import.meta.url).href,
    rotation: [0, 0, 0],
    scale: [5, 5, 5],
    position: [15, 0, -15],
    offset: [0, 0, 0],
    common: {
      name: '机器人',
    },
  },
]

const gplot = shallowRef<Gplot3D | null>(null)
onMounted(() => {
  if (!gplot.value) {
    testGplot3D()
  }
})
onActivated(() => {
  if (!gplot.value) {
    console.log('onActivated')
    testGplot3D()
  }
})
onDeactivated(() => {
  if (gplot.value) {
    gplot.value.destory()
    gplot.value = null
  }
})
function testGplot3D() {
  if (!renderEl.value) return
  gplot.value = new Gplot3D({
    el: renderEl.value,
    scene: {
      backgroundColor: '#1a212e',
    },
    camera: {
      initialPosition: { y: 300 },
    },
  })
  gplot.value.addFlowLines(lines)

  gplot.value.addSpriteNodes(nodes)

  gplot.value.addGltfNodes(modelNodes)
  gplot.value.onGltfNodes('mousemove', (type, e, models, datas) => {
    if (!tooltipEl.value || !renderEl.value) return
    const mevent = e as MouseEvent
    const left = mevent.clientX - renderEl.value.getBoundingClientRect().left
    const top = mevent.clientY - renderEl.value.getBoundingClientRect().top
    tooltipEl.value.style.transform = `translate(${left + 16}px, ${top + 16}px)`
    tooltipEl.value.innerText = datas[0]?.common?.name || ''
  })
  gplot.value.onGltfNodes('mouseenter', () => {
    if (!tooltipEl.value) return
    tooltipEl.value.style.display = `block`
  })
  gplot.value.onGltfNodes('mouseleave', () => {
    if (!tooltipEl.value) return
    tooltipEl.value.style.display = `none`
  })
}
</script>

<template>
  <div class="custom-page2">
    <div class="three-field" ref="renderEl">
      <el-empty description="CustomMenu 页面二" />
    </div>
    <div class="tooltip" ref="tooltipEl">123</div>
  </div>
</template>

<style scoped lang="less">
.custom-page2 {
  width: 100%;
  height: 100%;
  padding: 16px;
  position: relative;
  .three-field {
    width: 100%;
    height: 100%;

    > canvas {
      width: 100%;
      height: 100%;
    }
  }
  .tooltip {
    position: absolute;
    display: none;
    pointer-events: none;
    padding: 8px;
    top: 16px;
    left: 16px;
    background-color: #fff;
  }
}
</style>
