import type maplibregl from 'maplibre-gl'

export const lines = []

type LngLatEle = [number, number, number]

const gridUnit = 50 / 100000 // 50m的经纬度表示 0.0005度
// 模型设定
const modelScale = 0.04 // 0.04
const modelFontScale = 7 // 7
// 特效设定
const size = 2 // 特效点尺寸
const elength = 30 // 特效长度
const speed = 50 // 特效速度
const density = 10 // 点密度
const lineIntervalHalf = 4 / 100000 // 线间隔
// 点缩放
const scale = (sizeVal: number, index: number, length: number) =>
  sizeVal * Math.min(1, 1 - index / length + 0.1)
const color = ['#53ffc1', '#ff5600', '#f5b84a']

// 模型节点
const modelRelativePosition = [
  {
    name: '装置1',
    coord: [-3, -3, 0] as LngLatEle,
  },
  {
    name: '装置2',
    coord: [-3, 0, 0] as LngLatEle,
  },
  {
    name: '装置3',
    coord: [3, 0, 0] as LngLatEle,
  },
  {
    name: '装置4',
    coord: [3, 3, 0] as LngLatEle,
  },
]

// 根据偏移量计算经纬度
function getLnglatByOffset(center: number[], offset: LngLatEle, unit: number) {
  const centerWithElevation = new Array(3).fill(0).map((v, i) => center[i] || v) as LngLatEle
  return [...centerWithElevation].map((v, i) => v + (offset[i] || 0) * unit) as LngLatEle
}

// 获取所有的模型节点
function getModelNodes(center: number[]) {
  return modelRelativePosition.map((info) => {
    return {
      src: new URL('./assets/um_windmill_10_kw.glb', import.meta.url).href,
      rotation: [0, -Math.PI / 2, 0],
      scale: [modelScale, modelScale, modelScale],
      position: getLnglatByOffset(center, info.coord, gridUnit),
      offset: [0, 0, 0] as LngLatEle,
      common: {
        name: info.name,
      },
      text: genTextOpt('font1'),
    }
  })
}

// 获取所有模型之间的直线连线
function getModelStraightLink(points: LngLatEle[]) {
  const result = []
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]
    const end = points[i + 1]
    const doubleLine = straightway(start, end, {
      justify: Math.abs(start[0] - end[0]) < Number.EPSILON ? 'lat' : 'lng',
    })
    result.push(
      ...doubleLine.map((item, index) => ({
        id: i * 2 + index + 1,
        path: item,
        lineMaterial: { color: color[0], linewidth: 1 },
        effect: {
          enable: true,
          size: size,
          speed: speed,
          density: density,
          scale: scale,
          length: elength,
          colorStop: [
            { color: '#ffffffff', percent: 0 },
            { color: `${color[0]}ff`, percent: 0.15 },
            { color: `${color[0]}80`, percent: 0.4 },
            { color: `${color[0]}00`, percent: 1 },
          ],
        },
      }))
    )
  }
  return result
}

function getAreaRails(points: LngLatEle[]) {
  const edge = gridUnit
  const allLng = points.map((item) => item[0])
  const allLat = points.map((item) => item[1])
  const lngMax = Math.max(...allLng) + edge
  const latMax = Math.max(...allLat) + edge
  const lngMin = Math.min(...allLng) - edge
  const latMin = Math.min(...allLat) - edge
  const eastNorth = [lngMax, latMax, 0] as LngLatEle
  const eastSouth = [lngMax, latMin, 0] as LngLatEle
  const westSouth = [lngMin, latMin, 0] as LngLatEle
  const westNorth = [lngMin, latMax, 0] as LngLatEle
  return [
    {
      path: [eastNorth, eastSouth, westSouth, westNorth, eastNorth],
      relative: 1,
      lineMaterial: { color: '#2b90fa', linewidth: 3 },
      text: genRailTextOpt('font1', [-40, 0, -20], '安全区1'),
    },
  ]
}

function straightway(
  begin: [number, number, number],
  end: [number, number, number],
  option?: { justify?: 'lng' | 'lat'; reverse?: boolean }
) {
  const justify = option?.justify ?? 'lng'
  const reverse = option?.reverse ?? false
  const goLine = [[...begin], [...end]] as [number, number, number][]
  const backLine = [[...end], [...begin]] as [number, number, number][]
  goLine.forEach((p) => {
    const index = justify === 'lng' ? 1 : 0
    p[index] += lineIntervalHalf * (justify === 'lng' ? -1 : 1)
  })
  backLine.forEach((p) => {
    const index = justify === 'lng' ? 1 : 0
    p[index] -= lineIntervalHalf * (justify === 'lng' ? -1 : 1)
  })
  return [reverse ? backLine : goLine, reverse ? goLine : backLine]
}

function genTextOpt(font: string, content?: string) {
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
    scale: [modelFontScale, modelFontScale, modelFontScale],
    position: [0, 10, 18],
  }
}
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
    scale: [modelFontScale, modelFontScale, modelFontScale],
    position: position,
  }
}

export { getModelNodes, getModelStraightLink, getAreaRails }
