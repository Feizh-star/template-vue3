import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import {
  getTweenPoint,
  setInitialPosition,
  updatePositions,
  setGeometryColor,
  getFlowPointScale,
  handleColorStop,
} from './flowLine3DTool'
import * as lodashLib from 'lodash'

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends any[] ? T[P] : T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export interface IFlowLine3DOption {
  id: number
  canvas?: HTMLCanvasElement
  path: [number, number, number][]
  lineMaterial: {
    // 更多参数详见：https://github.com/mrdoob/three.js/blob/master/examples/jsm/lines/LineMaterial.js
    color: string
    linewidth: number
    dashed: boolean
    alphaToCoverage: boolean // 暂时默认true
  }
  effect: {
    enable: boolean
    reverse: boolean
    colorStop: { color: string; percent: number }[] // 渐变色，优先级高于lineMaterial.color
    multiple: number // 点插值倍数
    length: number // 特效相对长度
    size: number // 特效宽度
    speed: number // 移动速度
    scale: (sizeVal: number, index: number, length: number) => number
  }
  line: {
    scale: [number, number, number]
  }
}
export type IFlowLineItem = DeepPartial<IFlowLine3DOption>

const defaultOption: IFlowLine3DOption = {
  id: 1,
  canvas: undefined,
  path: [],
  lineMaterial: {
    color: '#53ffc1',
    linewidth: 2,
    dashed: false,
    alphaToCoverage: true,
  },
  effect: {
    enable: false,
    reverse: false,
    colorStop: [],
    multiple: 200,
    length: 80,
    size: 4.5,
    speed: 2,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    scale: (sizeVal: number, index: number, length: number) => sizeVal * 1,
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

let maxId: number = 1
const flowLine3DIds = new Set<number>()
export class FlowLine3D {
  private option: IFlowLine3DOption
  private lineIns!: Line2 | null
  private lineGeometryIns!: LineGeometry | null
  private lineMaterialIns!: LineMaterial | null
  private scene!: THREE.Scene | null
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
  constructor(option: IFlowLineItem) {
    this.option = lodashLib.mergeWith(lodashLib.cloneDeep(defaultOption), option, customMerge)
    this.setId()
    this.initFlowLine()
    this.initFlowEffect()
    this.setResolution(this.option.canvas?.width || 0, this.option.canvas?.height || 0)
  }
  private setId() {
    const { id: specifiedId } = this.option
    if (specifiedId === 0 || typeof specifiedId !== 'number') {
      console.warn('Id must be a number that be greater than 0')
    }
    if (specifiedId && !flowLine3DIds.has(specifiedId)) {
      this.id = specifiedId
    } else {
      this.id = maxId + 1
    }
    flowLine3DIds.add(this.id)
    maxId = Math.max(...[...flowLine3DIds])
  }
  private setLineScale(scale: [number, number, number]) {
    if (!this.lineIns) return
    this.option.line.scale = lodashLib.cloneDeep(scale)
    this.lineIns.scale.set(...this.option.line.scale)
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
    this.setLineScale(lineOpt.scale)
  }
  public setPath(path: IFlowLine3DOption['path']) {
    if (!this.lineGeometryIns) return this
    this.option.path = lodashLib.cloneDeep(path)
    this.lineGeometryIns.setPositions(this.option.path.flat())
    this.initInterpolationPath() // 插值特效的轨迹线line
    return this
  }
  public setMaterial(material: DeepPartial<IFlowLine3DOption['lineMaterial']>) {
    if (!this.lineMaterialIns) return this
    const lineMaterialOpt = lodashLib.mergeWith(this.option.lineMaterial, material, customMerge)
    this.option.lineMaterial = lineMaterialOpt
    ;(this.lineMaterialIns.color as THREE.Color).setHex(hexString2Number(lineMaterialOpt.color))
    this.lineMaterialIns.dashed = lineMaterialOpt.dashed
    this.lineMaterialIns.linewidth = lineMaterialOpt.linewidth
    return this
  }

  /**
   * 流动特效
   */
  private flowEffectInterpolation: THREE.Vector3[] = []
  private flowEffectIndex: number = 0
  private flowEffectGeometryIns!: THREE.BufferGeometry | null
  private flowEffectMaterialIns!: THREE.ShaderMaterial | null
  private flowEffectObject!: THREE.Points | null
  private flowEffectColor: { color: string; percent: number }[] = []
  private static sizeAttrName = 'effectSize'
  private initFlowEffect() {
    this.flowEffectIndex = 0 // 拖尾的光从轨迹线的第一个点位开始流动
    // 初始化几何形状
    this.initFlowEffectGeometry()
    // 初始化材质
    this.initFlowEffectMaterial()
    // 点组成的物体
    if (this.flowEffectGeometryIns && this.flowEffectMaterialIns) {
      this.flowEffectObject = new THREE.Points(
        this.flowEffectGeometryIns,
        this.flowEffectMaterialIns
      )
    }
  }
  private initInterpolationPath() {
    const { path: positions, effect: effectOpt } = this.option
    const pointVectors = positions.map((item) => new THREE.Vector3(...item))
    const interpolation = getTweenPoint(pointVectors, effectOpt.multiple)
    if (effectOpt.reverse) interpolation.reverse()
    this.flowEffectInterpolation = interpolation
  }
  private initFlowEffectGeometry() {
    const { lineMaterial: lineMaterialOpt, effect: effectOpt } = this.option
    const flowEffectGeometry = new THREE.BufferGeometry()
    this.flowEffectGeometryIns = flowEffectGeometry
    // 设置特效尺寸
    flowEffectGeometry.setAttribute(FlowLine3D.sizeAttrName, getFlowPointScale(effectOpt.length, effectOpt.size, effectOpt.scale))
    // 初始化几何体的位置
    setInitialPosition(flowEffectGeometry, this.flowEffectInterpolation[0], effectOpt.length)
    // 为每一个顶点设置颜色
    this.flowEffectColor = handleColorStop(lineMaterialOpt.color, effectOpt.colorStop)
    setGeometryColor(flowEffectGeometry, this.flowEffectColor)
  }
  private initFlowEffectMaterial() {
    const flowEffectMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float ${FlowLine3D.sizeAttrName};
        attribute vec4 color;
        varying vec4 vColor;
        void main() {
          vColor = color;

          // 使用模型视图矩阵计算点的位置
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

          // 根据视距调整点的大小
          gl_PointSize = ${FlowLine3D.sizeAttrName} * (500.0 / -mvPosition.z); // 使点的大小与距离成反比变化，500是一个经验值

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec4 vColor;
        void main() {
          // // 默认是方形的点，解除此注释，点就是圆的
          // // 将gl_PointCoord从0到1的坐标转换为-1到1的范围
          // vec2 uv = gl_PointCoord * 2.0 - 1.0;
          // // 检查当前片元是否在圆形内
          // if (dot(uv, uv) > 1.0) {
          //   discard; // 丢弃片元，使其透明
          // }

          gl_FragColor = vec4(vColor);
        }
      `,
      transparent: true
    })
    this.flowEffectMaterialIns = flowEffectMaterial
  }
  private enableEffect() {
    const { enable } = this.option.effect
    if (!this.scene) return this
    if (enable) {
      this.flowEffectObject && this.scene.add(this.flowEffectObject)
    } else {
      this.flowEffectObject && this.scene.remove(this.flowEffectObject)
      this.flowEffectIndex = 0
    }
    return this
  }
  private setResolution(width: number, height: number) {
    if (!this.lineMaterialIns) return this
    this.lineMaterialIns.resolution.set(width, height)
    return this
  }
  public setEffect(effect: Partial<IFlowLine3DOption['effect']>) {
    if (!this.flowEffectGeometryIns || !this.flowEffectMaterialIns) return this
    const newEffectOpt = lodashLib.mergeWith(this.option.effect, effect, customMerge)
    this.option.effect = newEffectOpt
    const { lineMaterial: lineMaterialOpt } = this.option

    // 更新插值特效的轨迹线line
    this.initInterpolationPath()
    // 重新初始化几何体的位置
    setInitialPosition(this.flowEffectGeometryIns, this.flowEffectInterpolation[0], newEffectOpt.length)
    // 重新初始化特效尺寸
    this.flowEffectGeometryIns.setAttribute(FlowLine3D.sizeAttrName, getFlowPointScale(newEffectOpt.length, newEffectOpt.size, newEffectOpt.scale))
    // 更新顶点颜色
    this.flowEffectColor = handleColorStop(lineMaterialOpt.color, newEffectOpt.colorStop)
    setGeometryColor(this.flowEffectGeometryIns, this.flowEffectColor)
    this.enableEffect()
    return this
  }
  public effectRun() {
    const { effect: effectOpt } = this.option
    if (!effectOpt.enable) return this
    if (!this.flowEffectGeometryIns) return this
    // 每隔一段时间不断在轨迹线上向前取线段从而生成拖尾的光对应的一个个点位
    if (this.flowEffectIndex > this.flowEffectInterpolation.length - 1) {
      this.flowEffectIndex = 0
    }
    // 更新几何体的位置，为拖尾的光设置新的点位从而实现流动效果
    updatePositions(
      this.flowEffectGeometryIns,
      this.flowEffectInterpolation,
      this.flowEffectIndex,
      effectOpt.length
    )
    this.flowEffectGeometryIns.computeBoundingSphere()
    this.flowEffectIndex += Math.max(Math.round(effectOpt.speed), 1)
    return this
  }

  public addTo(scene: THREE.Scene) {
    this.scene = scene
    this.lineIns && scene.add(this.lineIns)
    this.enableEffect()
    return this
  }
  public destory() {
    this.scene && this.lineIns && this.scene.remove(this.lineIns)
    this.scene && this.flowEffectObject && this.scene.remove(this.flowEffectObject)
    this.lineGeometryIns && this.lineGeometryIns.dispose()
    this.lineMaterialIns && this.lineMaterialIns.dispose()
    this.lineGeometryIns = null
    this.lineMaterialIns = null
    this.lineIns = null
    this.flowEffectGeometryIns && this.flowEffectGeometryIns.dispose()
    this.flowEffectMaterialIns && this.flowEffectMaterialIns.dispose()
    this.flowEffectGeometryIns = null
    this.flowEffectMaterialIns = null
    this.flowEffectObject = null
    this.flowEffectInterpolation = []
    this.id && flowLine3DIds.delete(this.id)
    maxId = flowLine3DIds.size === 0 ? 1 : Math.max(...[...flowLine3DIds])
    this.id = null
    this.scene = null
  }
}
