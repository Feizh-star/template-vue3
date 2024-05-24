import type * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { createGradient, hexToRgb, rgbNormalized } from '@/utils/colorGradient'
import * as lodashLib from 'lodash'

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export interface IFlowLine3DOption {
  id: number
  path: [number, number, number][]
  lineMaterial: {
    // 更多参数详见：https://github.com/mrdoob/three.js/blob/master/examples/jsm/lines/LineMaterial.js
    color: string
    linewidth: number
    dashed: boolean
    alphaToCoverage: boolean // 暂时默认true
  }
  line: {
    scale: [number, number, number]
  }
}

const defaultOption: IFlowLine3DOption = {
  id: 1,
  path: [],
  lineMaterial: {
    color: '#53ffc1',
    linewidth: 2,
    dashed: false,
    alphaToCoverage: true,
  },
  line: {
    scale: [1, 1, 1],
  },
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function customMerge(target: IFlowLine3DOption, source: IFlowLine3DOption) {
  return undefined
}
function hexString2Number(hex: string) {
  return parseInt(hex.replace('#', ''), 16)
}

export class FlowLine3D {
  static MaxId: number = 1
  static Ids: Set<number> = new Set()
  private option: IFlowLine3DOption = defaultOption
  private lineIns: Line2 | null
  private lineGeometryIns: LineGeometry | null
  private lineMaterialIns: LineMaterial | null
  private scene: THREE.Scene[] = []
  public id!: number | null

  public get line() {
    return this.lineIns
  }
  public get lineGeometry() {
    return this.lineGeometryIns
  }
  public get lineMaterial() {
    return this.lineMaterialIns
  }
  constructor(option: DeepPartial<IFlowLine3DOption>) {
    this.option = lodashLib.mergeWith(defaultOption, option, customMerge)
    this.setId()
    this.initFlowLine()
  }
  private setId() {
    const { id: specifiedId } = this.option
    if (specifiedId && !FlowLine3D.Ids.has(specifiedId)) {
      this.id = specifiedId
    } else {
      this.id = FlowLine3D.MaxId + 1
    }
    FlowLine3D.Ids.add(this.id)
    FlowLine3D.MaxId = Math.max(...[...FlowLine3D.Ids])
  }
  private initFlowLine() {
    const { path: positions, lineMaterial: lineMaterialOpt, line: lineOpt } = this.option

    const trackLine = new LineGeometry()
    this.lineGeometryIns = trackLine
    this.setPath(positions)

    const trackLineMaterial = new LineMaterial()
    this.lineMaterialIns = trackLineMaterial
    this.setMaterial(lineMaterialOpt)

    const line = new Line2(trackLine, trackLineMaterial)
    this.lineIns = line
    line.computeLineDistances()
    this.setScale(lineOpt.scale)
  }
  public setPath(path: IFlowLine3DOption['path']) {
    if (!this.lineGeometryIns) return this
    this.option.path = lodashLib.cloneDeep(path)
    this.lineGeometryIns.setPositions(this.option.path.flat())
    return this
  }
  public setMaterial(material: DeepPartial<IFlowLine3DOption['lineMaterial']>) {
    if (!this.lineMaterialIns) return this
    const lineMaterialOpt = lodashLib.mergeWith(this.option.lineMaterial, material, customMerge)
    this.option.lineMaterial = lineMaterialOpt

    this.lineMaterialIns.color.setHex(hexString2Number(lineMaterialOpt.color))
    this.lineMaterialIns.dashed = lineMaterialOpt.dashed
    this.lineMaterialIns.linewidth = lineMaterialOpt.linewidth
    return this
  }
  public setScale(scale: [number, number, number]) {
    if (!this.lineIns) return this
    this.option.line.scale = lodashLib.cloneDeep(scale)
    this.lineIns.scale.set(...this.option.line.scale)
    return this
  }
  public addTo(scene: THREE.Scene) {
    this.lineIns && scene.add(this.lineIns)
    this.scene.push(scene)
    return this
  }
  public destory() {
    this.scene.forEach((scene) => {
      scene && this.lineIns && scene.remove(this.lineIns)
    })
    this.lineGeometryIns && this.lineGeometryIns.dispose()
    this.lineMaterialIns && this.lineMaterialIns.dispose()
    this.lineGeometryIns = null
    this.lineMaterialIns = null
    this.lineIns = null
    this.id && FlowLine3D.Ids.delete(this.id)
    FlowLine3D.MaxId = FlowLine3D.Ids.size === 0 ? 1 : Math.max(...[...FlowLine3D.Ids])
    this.id = null
    this.scene = []
  }
}
