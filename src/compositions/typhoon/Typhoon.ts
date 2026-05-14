import { GMarker, GPolyline, ElMarker, GText } from 'hxmap'
import type {
  IMapInstance2,
  IGMarkerInstance,
  IGPolylineInstance,
  IElMarkerInstance,
  IGeojsonLinesInstance,
  IGeojsonPolygonInstance,
} from 'hxmap'
import type { ITyphoonData, ITyphoonPoint } from './type'
import { getTyphoonColor, getPointImage } from './tools/tool'
import { getTyphoonCircle } from './components/typhoonCircle'
import { renderPopupContent } from './components/popupContent'
import gifPath from './assets/tf1.gif'

interface ITyphoonLayerProps {
  map: IMapInstance2
  data: ITyphoonData
}
interface IPointGraph {
  type: 'sk' | 'fcst'
  data: ITyphoonPoint
  marker: IGMarkerInstance
  line: IGPolylineInstance
  gifMarker: IElMarkerInstance
  polygon: (IGeojsonLinesInstance | IGeojsonPolygonInstance)[]
}

const iconSize = 6
const pointIndex = 400
const lineIndex = 300
const polygonIndex = 200
const warningLineIndex = 100
const gifEl = `<div style="width: 0; height: 0; display: flex; justify-content: center; align-items: center;"><img src="${gifPath}" /></div>`

export class TyphoonLayer {
  // 地图实例
  mapIns: IMapInstance2
  // 台风数据
  data: ITyphoonData
  // 播放过程中的索引
  currentIndex: number = 0
  // 激活的点
  activedPointGraph: IPointGraph | null = null
  // 点及其图形数据
  pointGraphList: IPointGraph[] = []
  // 实况最大索引
  skMaxIndex: number = 0
  timer: ReturnType<typeof setTimeout> | null = null
  _clickHander: (e: any) => void

  constructor({ map, data }: ITyphoonLayerProps) {
    if (!map) {
      throw new Error('缺少地图实例!')
    }
    if (!data) {
      throw new Error('缺少台风数据!')
    }
    this.mapIns = map
    this.data = data
    this._clickHander = (e: any) => this.clickHander(e)
    this.initGraph()
    this.start()
  }
  private start() {
    this.currentIndex = 0
    this.animationFrame()
  }
  private stop() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
  public destroy() {
    this.stop()
    for (const markerGraph of this.pointGraphList) {
      this.mapIns.removeLayerEvent('click', markerGraph.marker, this._clickHander)
      const layers = [
        markerGraph.marker,
        markerGraph.line,
        markerGraph.gifMarker,
        ...markerGraph.polygon,
      ]
      layers.forEach((item) => {
        if (this.mapIns.hasLayer(item)) {
          item.destroy(this.mapIns)
        }
      })
    }
    this.pointGraphList = []
    this.activedPointGraph = null
  }
  private requestNextTick() {
    this.timer = setTimeout(() => {
      this.currentIndex++
      this.animationFrame()
    }, 120)
  }
  private animationFrame() {
    if (this.pointGraphList[this.currentIndex]) {
      this.drawPoint()
      this.updateGraph()
      this.requestNextTick()
    } else {
      this.stop()
      if (!this.activedPointGraph) {
        this.activedPointGraph = this.pointGraphList[this.pointGraphList.length - 1]
      }
    }
  }
  private drawPoint() {
    if (!this.mapIns) return
    const markerGraph = this.pointGraphList[this.currentIndex]
    if (markerGraph) {
      markerGraph.marker.addTo(this.mapIns)
      markerGraph.line.addTo(this.mapIns)
    }
  }
  private updateGraph() {
    if (this.activedPointGraph) return // 如果已经手动操作过点击了，风圈就不再自动跟着动画跑
    // 风圈自动跟着动画跑，直到之后一个实况点
    if (this.currentIndex <= this.skMaxIndex) {
      this.removeGraph(this.pointGraphList[this.currentIndex - 1])
      this.showGraph(this.pointGraphList[this.currentIndex])
    } else {
      // 碰到预报点，风圈不再自动前进，把激活点设置为最后显示风圈的点（前提是还没有设置过激活点，以免干扰点击）
      this.activedPointGraph = this.pointGraphList[this.currentIndex - 1] || this.pointGraphList[0]
    }
  }
  private removeGraph(pointGraph?: IPointGraph | null) {
    if (!pointGraph) return
    const layers = [pointGraph.gifMarker, ...pointGraph.polygon]
    layers.forEach((item) => {
      if (this.mapIns.hasLayer(item)) {
        item.removeFromMap(this.mapIns)
      }
    })
  }
  // 没有用LayerGroup是因为ElMarker gif没法用LayerGroup管理
  private showGraph(markerGraph: IPointGraph) {
    if (!this.mapIns) return
    if (markerGraph) {
      markerGraph.gifMarker.addTo(this.mapIns)
      markerGraph.polygon.forEach((item) => item.addTo(this.mapIns))
    }
  }
  private clickHander(e: any) {
    const clickMarker = this.pointGraphList.find((item) => item.marker.id === e.id)
    if (clickMarker) {
      const oldActivedPointGraph = this.activedPointGraph
      this.removeGraph(oldActivedPointGraph || this.pointGraphList[this.currentIndex])
      oldActivedPointGraph?.marker?.closePopup(this.mapIns)
      this.activedPointGraph = clickMarker
      this.showGraph(this.activedPointGraph)

      const htmlContent = renderPopupContent({ data: clickMarker.data, type: clickMarker.type })
      clickMarker.marker.openPopup(this.mapIns, htmlContent, 2000)
      const closeIcon = document.querySelector('.typhoon-popup-dialog .typhoon-close-icon')
      closeIcon?.addEventListener('click', () => {
        clickMarker.marker.closePopup(this.mapIns)
      })
    }
  }
  private initGraph() {
    const skdata = this.data.typh_skdata || []
    const fcstdata = this.data.typh_fcstdata || []
    const allPoint = [...skdata, ...fcstdata]
    this.pointGraphList = []
    for (const [index, item] of allPoint.entries()) {
      const type = index >= skdata.length ? 'fcst' : 'sk'
      const { color, rgba } = getTyphoonColor(item.typhGrade)
      const marker = new GMarker({
        position: [item.lat, item.lon],
        source: getPointImage({
          radius: iconSize,
          strokeWidth: 2,
          fillColor: color,
          borderColor: '#ffffff',
        }),
        imgSize: [iconSize * 2, iconSize * 2],
        eventSize: [iconSize * 2, iconSize * 2],
        offset: [0, 0],
        index: pointIndex,
      } as any)
      const line = new GPolyline({
        coords: [
          [
            index > 0 ? allPoint[index - 1].lat : item.lat,
            index > 0 ? allPoint[index - 1].lon : item.lon,
          ],
          [item.lat, item.lon],
        ],
        lineWidth: 3,
        index: lineIndex,
        color: rgba,
      })
      const gifMarker = new ElMarker({
        source: gifEl,
        position: [item.lat, item.lon],
      })
      const typhoonCircle = getTyphoonCircle(item, polygonIndex)
      // @ts-ignore 第四个参数是阻止冒泡
      this.mapIns.setLayerEvent('click', marker, this._clickHander, true)
      this.pointGraphList.push({
        marker,
        data: item,
        line,
        gifMarker,
        polygon: typhoonCircle,
        type,
      })
    }
    this.activedPointGraph = null
    this.currentIndex = 0
    this.skMaxIndex = skdata.length - 1
  }
}

// 台风警戒线
export function getTyphoonWarnLineLayer() {
  const latlon24: [number, number][] = [
    [34, 127],
    [22, 127],
    [18, 119],
    [11, 119],
    [4.5, 113],
    [0, 105],
  ]
  const latlon48: [number, number][] = [
    [34, 132],
    [15, 132],
    [0, 120],
    [0, 105],
  ]
  const line24 = new GPolyline({
    coords: latlon24,
    lineWidth: 1.5,
    index: warningLineIndex,
    color: [255, 0, 0, 255],
  })
  const line48 = new GPolyline({
    coords: latlon48,
    lineWidth: 1.5,
    index: warningLineIndex,
    color: [0, 0, 255, 255],
  })
  const text24 = new GText({
    data: ['24', '小', '时', '预', '警', '线'].map((item, index) => ({
      lon: 127.5,
      lat: 33.85 - index,
      value: item,
    })),
    index: warningLineIndex,
    fontSize: 14,
    fontColor: '#ff0000',
    fontWeight: 'bold',
  } as any)
  const text48 = new GText({
    data: ['48', '小', '时', '预', '警', '线'].map((item, index) => ({
      lon: 132.5,
      lat: 33.85 - index,
      value: item,
    })),
    index: warningLineIndex,
    fontSize: 14,
    fontColor: '#0000ff',
    fontWeight: 'bold',
  } as any)
  return { line24, line48, text24, text48 }
}
