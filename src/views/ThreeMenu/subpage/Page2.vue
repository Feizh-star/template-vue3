<script setup lang="ts">
import { Gplot3D } from '@/libs/gplot3D/gplot3D'
import type { IRailItem } from '@/libs/gplot3D/gplot3D'
import type { IFlowLineItem } from '@/libs/gplot3D/flowLine3D'

const renderEl = ref<HTMLElement | null>(null)
const tooltipEl = ref<HTMLElement | null>(null)

const color = ['#53ffc1', '#ff5600', '#f5b84a']

const size = 4.5
const speed = 2
const multiple = 100
const centerPosition: [number, number, number] = [-27, 0, -27]
const distance = 24
const lineIntervalHalf = 1
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
const genTextOpt = (font: string, content?: string) => {
  return {
    font: font,
    content:
      content ||
      ((cmn: any) => {
        return cmn.name.length > 10
          ? `${cmn.name.substring(0, 7)}\n${cmn.name.substring(7)}`
          : cmn.name
      }),
    geometry: {
      size: 1.8,
      depth: 0,
    },
    material: {
      color: '#ececec',
    },
    center: true,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    position: [0, 1, 5],
  }
}

const modelNodes = [
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: [...centerPosition],
    offset: [0, 0, 0],
    common: {
      name: '电脑',
    },
    text: genTextOpt('font1'),
  },
  // src/views/ThreeMenu/subpage/assets/smol_ame_in_an_upcycled_terrarium_hololiveen.glb
  // src/views/ThreeMenu/subpage/assets/cat/scene.gltf
  // src/views/ThreeMenu/subpage/assets/um_windmill_10_kw.glb
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: getTargetByInterval(-2, -1),
    offset: [0, 0, 0],
    common: {
      name: '电力监控系统',
    },
    text: genTextOpt('font1'),
  },
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: getTargetByInterval(-1, -1),
    offset: [0, 0, 0],
    common: {
      name: '内网防火墙',
    },
    text: genTextOpt('font1'),
  },
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: getTargetByInterval(0, -1),
    offset: [0, 0, 0],
    common: {
      name: '风功率预测交换机',
    },
    text: genTextOpt('font1'),
  },
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: getTargetByInterval(1, -1),
    offset: [0, 0, 0],
    common: {
      name: '风功率预测服务器',
    },
    text: genTextOpt('font1'),
  },
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: getTargetByInterval(2, -1),
    offset: [0, 0, 0],
    common: {
      name: '反向隔离装置',
    },
    text: genTextOpt('font1'),
  },
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: getTargetByInterval(3, -1),
    offset: [0, 0, 0],
    common: {
      name: '气象服务器',
    },
    text: genTextOpt('font1'),
  },
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: getTargetByInterval(4, -1),
    offset: [0, 0, 0],
    common: {
      name: '外网防火墙',
    },
    text: genTextOpt('font1'),
  },
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: getTargetByInterval(4, 0),
    offset: [0, 0, 0],
    common: {
      name: '互联网',
    },
    text: genTextOpt('font1'),
  },
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: getTargetByInterval(-1, 2),
    offset: [0, 0, 0],
    common: {
      name: '平面非实时交换机一',
    },
    text: genTextOpt('font1'),
  },
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: getTargetByInterval(0, 2),
    offset: [0, 0, 0],
    common: {
      name: '平面非实时纵向加密装置一',
    },
    text: genTextOpt('font1'),
  },
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: getTargetByInterval(1, 2),
    offset: [0, 0, 0],
    common: {
      name: '平面非实时纵向加密装置二',
    },
    text: genTextOpt('font1'),
  },
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: getTargetByInterval(2, 2),
    offset: [0, 0, 0],
    common: {
      name: '平面非实时交换机二',
    },
    text: genTextOpt('font1'),
  },
  {
    src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.005, 0.005, 0.005],
    position: getTargetByInterval(0.5, 3),
    offset: [0, 0, 0],
    common: {
      name: '调度数据网',
    },
    text: genTextOpt('font1'),
  },
]

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
    lineMaterial: { color: color[2] },
    effect: {
      enable: true,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[2]}ff`, percent: 0.15 },
        { color: `${color[2]}80`, percent: 0.4 },
        { color: `${color[2]}00`, percent: 1 },
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
    lineMaterial: { color: color[1], dashed: true },
    effect: {
      enable: false,
      size: size,
      speed: speed,
      multiple: multiple,
      colorStop: [
        { color: '#ffffffff', percent: 0 },
        { color: `${color[1]}ff`, percent: 0.15 },
        { color: `${color[1]}80`, percent: 0.4 },
        { color: `${color[1]}00`, percent: 1 },
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
  {
    id: 17,
    path: [
      [centerPosition[0] + 1 * lineIntervalHalf, 0, centerPosition[2]],
      [
        centerPosition[0] + 1 * lineIntervalHalf,
        0,
        centerPosition[2] + 1 * distance + 2 * lineIntervalHalf,
      ],
      [
        centerPosition[0] + 2 * distance - 1 * lineIntervalHalf,
        0,
        centerPosition[2] + 1 * distance + 2 * lineIntervalHalf,
      ],
      [
        centerPosition[0] + 2 * distance - 1 * lineIntervalHalf,
        0,
        centerPosition[2] + 2 * distance,
      ],
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
    id: 18,
    path: [
      [
        centerPosition[0] + 2 * distance + 1 * lineIntervalHalf,
        0,
        centerPosition[2] + 2 * distance,
      ],
      [
        centerPosition[0] + 2 * distance + 1 * lineIntervalHalf,
        0,
        centerPosition[2] + 1 * distance,
      ],
      [centerPosition[0] + 1 * lineIntervalHalf, 0, centerPosition[2] + 1 * distance],
      [centerPosition[0] + 1 * lineIntervalHalf, 0, centerPosition[2]],
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
    id: 19,
    path: [
      [centerPosition[0] - 1 * lineIntervalHalf, 0, centerPosition[2]],
      [centerPosition[0] - 1 * lineIntervalHalf, 0, centerPosition[2] + 1 * distance],
      [centerPosition[0] - 1 * distance - lineIntervalHalf, 0, centerPosition[2] + 1 * distance],
      [centerPosition[0] - 1 * distance - lineIntervalHalf, 0, centerPosition[2] + 2 * distance],
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
    id: 20,
    path: [
      [centerPosition[0] - 1 * distance + lineIntervalHalf, 0, centerPosition[2] + 2 * distance],
      [
        centerPosition[0] - 1 * distance + lineIntervalHalf,
        0,
        centerPosition[2] + 1 * distance + 2 * lineIntervalHalf,
      ],
      [
        centerPosition[0] - 1 * lineIntervalHalf,
        0,
        centerPosition[2] + 1 * distance + 2 * lineIntervalHalf,
      ],
      [centerPosition[0] - 1 * lineIntervalHalf, 0, centerPosition[2]],
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
    id: 21,
    path: straightway(getTargetByInterval(0, 2), getTargetByInterval(-1, 2), {
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
    id: 22,
    path: straightway(getTargetByInterval(0, 2), getTargetByInterval(-1, 2), {
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
    id: 23,
    path: [
      [
        centerPosition[0] + 0.5 * distance,
        0,
        centerPosition[2] + 3 * distance - 1 * lineIntervalHalf,
      ],
      [
        centerPosition[0] + 1 * lineIntervalHalf,
        0,
        centerPosition[2] + 3 * distance - 1 * lineIntervalHalf,
      ],
      [centerPosition[0] + 1 * lineIntervalHalf, 0, centerPosition[2] + 2 * distance],
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
    id: 24,
    path: [
      [centerPosition[0] - 1 * lineIntervalHalf, 0, centerPosition[2] + 2 * distance],
      [
        centerPosition[0] - 1 * lineIntervalHalf,
        0,
        centerPosition[2] + 3 * distance + 1 * lineIntervalHalf,
      ],
      [
        centerPosition[0] + 0.5 * distance,
        0,
        centerPosition[2] + 3 * distance + 1 * lineIntervalHalf,
      ],
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
    id: 25,
    path: [
      [
        centerPosition[0] + 0.5 * distance,
        0,
        centerPosition[2] + 3 * distance + 1 * lineIntervalHalf,
      ],
      [
        centerPosition[0] + 1 * distance + 1 * lineIntervalHalf,
        0,
        centerPosition[2] + 3 * distance + 1 * lineIntervalHalf,
      ],
      [
        centerPosition[0] + 1 * distance + 1 * lineIntervalHalf,
        0,
        centerPosition[2] + 2 * distance,
      ],
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
    id: 26,
    path: [
      [
        centerPosition[0] + 1 * distance - 1 * lineIntervalHalf,
        0,
        centerPosition[2] + 2 * distance,
      ],
      [
        centerPosition[0] + 1 * distance - 1 * lineIntervalHalf,
        0,
        centerPosition[2] + 3 * distance - 1 * lineIntervalHalf,
      ],
      [
        centerPosition[0] + 0.5 * distance,
        0,
        centerPosition[2] + 3 * distance - 1 * lineIntervalHalf,
      ],
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
]
const genRailTextOpt = (font: string, position: number[], content?: string) => {
  return {
    font: font,
    content: content || '',
    geometry: {
      size: 1.6,
      depth: 0,
    },
    material: {
      color: '#D7ECF8',
    },
    center: true,
    rotation: [-Math.PI / 2, 0, 0],
    scale: [1, 1, 1],
    position: position,
  }
}
const rails: IRailItem[] = [
  {
    path: [
      [-62, 0, 57],
      [-82, 0, 57],
      [-82, 0, -72],
      [-62, 0, -72],
      [-62, 0, 57],
    ],
    relative: 0,
    lineMaterial: { color: '#647186' },
    text: genRailTextOpt('font1', [-6, 0, -2.5], '安全区1'),
  },
  {
    path: [
      [32, 0, 57],
      [-59, 0, 57],
      [-59, 0, -72],
      [32, 0, -72],
      [32, 0, 57],
    ],
    relative: 0,
    lineMaterial: { color: '#647186' },
    text: genRailTextOpt('font1', [-6, 0, -2.5], '安全区2'),
  },
  {
    path: [
      [57, 0, 57],
      [35, 0, 57],
      [35, 0, -72],
      [57, 0, -72],
      [57, 0, 57],
    ],
    relative: 0,
    lineMaterial: { color: '#647186' },
    text: genRailTextOpt('font1', [-8, 0, -2.5], '管理信息大区'),
  },
]
// [-58.4, 0, -42] [-68, 0, -42] [-8, 0, 72]
// [28, 0, -24]

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
      initialPosition: { x: 254.64725857847603, y: 322.8563456977105, z: 270.5627122396308 },
    },
  })
  gplot.value.addFlowLines(lines)

  gplot.value
    .addFont('font1', new URL('./font/Microsoft YaHei_Regular.json', import.meta.url).href)
    .then(() => {
      gplot.value?.addGltfNodes(modelNodes)
      gplot.value?.onGltfNodes('mousemove', (type, e, models, datas) => {
        if (!tooltipEl.value || !renderEl.value || !datas[0]?.common?.name) return
        const mevent = e as MouseEvent
        const left = mevent.clientX - renderEl.value.getBoundingClientRect().left
        const top = mevent.clientY - renderEl.value.getBoundingClientRect().top
        tooltipEl.value.style.transform = `translate(${left + 16}px, ${top + 16}px)`
        tooltipEl.value.innerText = datas[0]?.common?.name || ''
      })
      gplot.value?.onGltfNodes('mouseenter', (type, e, models, datas) => {
        if (!tooltipEl.value || !datas[0]?.common?.name) return
        tooltipEl.value.style.display = `block`
      })
      gplot.value?.onGltfNodes('mouseleave', (type, e, models, datas) => {
        if (!tooltipEl.value || !datas[0]?.common?.name) return
        tooltipEl.value.style.display = `none`
      })
      gplot.value?.addRails(rails)
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
