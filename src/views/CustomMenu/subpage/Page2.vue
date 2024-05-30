<script setup lang="ts">
import { Gplot3D } from './compositions/gplot3D'
import type { IFlowLineItem } from './compositions/flowLine3D'
import { dist } from 'zrender/lib/core/vector'

const renderEl = ref<HTMLElement | null>(null)
const tooltipEl = ref<HTMLElement | null>(null)

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

const size = 5
const speed = 2
const multiple = 50
const centerPosition: [number, number, number] = [-40, 0, 0]
const distance = 40
const lineIntervalHalf = 2
const straightway = (
  begin: [number, number, number],
  end: [number, number, number],
  option?: { justify?: 'X' | 'Z'; reverse?: boolean }
) => {
  const justify = option?.justify ?? 'X'
  const reverse = option?.reverse ?? false
  const goLine = [[...begin], [...end]] as [number, number, number][]
  const backLine = [[...end], [...begin]] as [number, number, number][]
  goLine.forEach((p) => {
    const index = justify === 'X' ? 2 : 0
    p[index] += lineIntervalHalf * (justify === 'X' ? -1 : 1)
  })
  backLine.forEach((p) => {
    const index = justify === 'X' ? 2 : 0
    p[index] -= lineIntervalHalf * (justify === 'X' ? -1 : 1)
  })
  return {
    go: reverse ? backLine : goLine,
    back: reverse ? goLine : backLine,
  }
}
const getTargetByInterval = (x: number = 0, z: number = 0) => {
  return [centerPosition[0] + x * distance, 0, centerPosition[2] + z * distance] as [
    number,
    number,
    number
  ]
}
// console.log(straightway([-10, 0, -10], [-10, 0, -50], { justify: 'Z' }))
const lines: IFlowLineItem[] = [
  {
    id: 1,
    path: straightway([...centerPosition], getTargetByInterval(0, -1), {
      justify: 'Z',
    }).go,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 2,
    path: straightway([...centerPosition], getTargetByInterval(0, -1), {
      justify: 'Z',
    }).back,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 3,
    path: [
      [centerPosition[0] - 1 * distance, 0, centerPosition[2] - 1 * distance - lineIntervalHalf],
      [
        centerPosition[0] - 1 * distance - distance * 0.6,
        0,
        centerPosition[2] - 1 * distance - lineIntervalHalf,
      ],
      [
        centerPosition[0] - 1 * distance - distance * 0.6,
        0,
        centerPosition[2] - 1 * distance - distance * 0.75,
      ],
      [
        centerPosition[0] - 1 * distance - distance,
        0,
        centerPosition[2] - 1 * distance - distance * 0.75,
      ],
      [centerPosition[0] - 1 * distance - distance, 0, centerPosition[2] - 1 * distance],
    ],
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 4,
    path: [
      [centerPosition[0] - 1 * distance - distance, 0, centerPosition[2] - 1 * distance],
      [
        centerPosition[0] - 1 * distance - distance,
        0,
        centerPosition[2] - 1 * distance + distance * 0.75,
      ],
      [
        centerPosition[0] - 1 * distance - distance * 0.6,
        0,
        centerPosition[2] - 1 * distance + distance * 0.75,
      ],
      [
        centerPosition[0] - 1 * distance - distance * 0.6,
        0,
        centerPosition[2] - 1 * distance + lineIntervalHalf,
      ],
      [centerPosition[0] - 1 * distance, 0, centerPosition[2] - 1 * distance + lineIntervalHalf],
    ],
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
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
    path: straightway(getTargetByInterval(0, -1), getTargetByInterval(-1, -1), {
      justify: 'X',
    }).go,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 6,
    path: straightway(getTargetByInterval(0, -1), getTargetByInterval(-1, -1), {
      justify: 'X',
    }).back,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 7,
    path: straightway(getTargetByInterval(1, -1), getTargetByInterval(0, -1), {
      justify: 'X',
    }).go,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 8,
    path: straightway(getTargetByInterval(1, -1), getTargetByInterval(0, -1), {
      justify: 'X',
    }).back,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 9,
    path: straightway(getTargetByInterval(2, -1), getTargetByInterval(1, -1), {
      justify: 'X',
    }).go,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 10,
    path: straightway(getTargetByInterval(2, -1), getTargetByInterval(1, -1), {
      justify: 'X',
    }).back,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 11,
    path: straightway(getTargetByInterval(3, -1), getTargetByInterval(2, -1), {
      justify: 'X',
    }).go,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 12,
    path: straightway(getTargetByInterval(3, -1), getTargetByInterval(2, -1), {
      justify: 'X',
    }).back,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 13,
    path: straightway(getTargetByInterval(4, -1), getTargetByInterval(3, -1), {
      justify: 'X',
    }).go,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 14,
    path: straightway(getTargetByInterval(4, -1), getTargetByInterval(3, -1), {
      justify: 'X',
    }).back,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 15,
    path: straightway(getTargetByInterval(4, 0), getTargetByInterval(4, -1), {
      justify: 'Z',
    }).go,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
  {
    id: 16,
    path: straightway(getTargetByInterval(4, 0), getTargetByInterval(4, -1), {
      justify: 'Z',
    }).back,
    lineMaterial: { color: color[0] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[0]}ff`, percent: 0.15 },
        { color: `${color[0]}80`, percent: 0.4 },
        { color: `${color[0]}00`, percent: 1 },
      ],
    },
  },
]
const modelNodes = [
  {
    // src: new URL('./assets/cat/scene.gltf', import.meta.url).href,
    src: new URL('./assets/smol_ame_in_an_upcycled_terrarium_hololiveen.glb', import.meta.url).href,
    rotation: [0, 0, 0],
    scale: [5, 5, 5],
    position: [...centerPosition],
    offset: [0, 0, 0],
    common: {
      name: '汤姆',
    },
  },
  {
    src: new URL('./assets/smol_ame_in_an_upcycled_terrarium_hololiveen.glb', import.meta.url).href,
    rotation: [0, 0, 0],
    scale: [5, 5, 5],
    position: getTargetByInterval(-2, -1),
    offset: [0, 0, 0],
    common: {
      name: '电力监控系统',
    },
  },
  {
    src: new URL('./assets/smol_ame_in_an_upcycled_terrarium_hololiveen.glb', import.meta.url).href,
    rotation: [0, 0, 0],
    scale: [5, 5, 5],
    position: getTargetByInterval(-1, -1),
    offset: [0, 0, 0],
    common: {
      name: '内网防火墙',
    },
  },
  {
    src: new URL('./assets/smol_ame_in_an_upcycled_terrarium_hololiveen.glb', import.meta.url).href,
    rotation: [0, 0, 0],
    scale: [5, 5, 5],
    position: getTargetByInterval(0, -1),
    offset: [0, 0, 0],
    common: {
      name: '风功率预测交换机',
    },
  },
  {
    src: new URL('./assets/smol_ame_in_an_upcycled_terrarium_hololiveen.glb', import.meta.url).href,
    rotation: [0, 0, 0],
    scale: [5, 5, 5],
    position: getTargetByInterval(1, -1),
    offset: [0, 0, 0],
    common: {
      name: '风功率预测服务器',
    },
  },
  {
    src: new URL('./assets/smol_ame_in_an_upcycled_terrarium_hololiveen.glb', import.meta.url).href,
    rotation: [0, 0, 0],
    scale: [5, 5, 5],
    position: getTargetByInterval(2, -1),
    offset: [0, 0, 0],
    common: {
      name: '反向隔离装置',
    },
  },
  {
    src: new URL('./assets/smol_ame_in_an_upcycled_terrarium_hololiveen.glb', import.meta.url).href,
    rotation: [0, 0, 0],
    scale: [5, 5, 5],
    position: getTargetByInterval(3, -1),
    offset: [0, 0, 0],
    common: {
      name: '气象服务器',
    },
  },
  {
    src: new URL('./assets/smol_ame_in_an_upcycled_terrarium_hololiveen.glb', import.meta.url).href,
    rotation: [0, 0, 0],
    scale: [5, 5, 5],
    position: getTargetByInterval(4, -1),
    offset: [0, 0, 0],
    common: {
      name: '外网防火墙',
    },
  },
  {
    src: new URL('./assets/smol_ame_in_an_upcycled_terrarium_hololiveen.glb', import.meta.url).href,
    rotation: [0, 0, 0],
    scale: [5, 5, 5],
    position: getTargetByInterval(4, 0),
    offset: [0, 0, 0],
    common: {
      name: '互联网',
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
      initialPosition: { x: 300, y: 300, z: 300 },
    },
  })
  gplot.value.addFlowLines(lines)

  // gplot.value.addSpriteNodes(nodes)

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
  overflow: hidden;
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
    background-color: #011a42;
    color: #ffffff;
    border: 1px solid #0a69d5;
  }
}
</style>
