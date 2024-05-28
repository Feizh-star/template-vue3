import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import * as lodashLib from 'lodash'
// import { createGradient, hexToRgb, rgbNormalized } from './colorGradient'
import { FlowLine3D, type IFlowLine3DOption } from './flowLine3D'

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
export interface ISpriteNodeItem {
  common: Record<string, any>
  src: string
  center: number[]
  scale: number[]
  position: number[]
  offset: number[]
}
export interface IGltfLoaderResult {
  animations: Array<THREE.AnimationClip>
  scene: THREE.Group
  scenes: Array<THREE.Group>
  cameras: Array<THREE.Camera>
  asset: Object
}
export interface IGplot3DOption {
  el: HTMLElement
  scene: {
    backgroundColor: string
  }
  ambient: {
    color: string
    luminance: number
  }
  camera: {
    viewAngle: number
    near: number
    far: number
    initialPosition: { x: number; y: number; z: number }
  }
  controls: {
    enablePan: boolean
    enableRotate: boolean
    enableZoom: boolean
    mouseButtons: {
      LEFT: THREE.MOUSE
      MIDDLE: THREE.MOUSE
      RIGHT: THREE.MOUSE
    }
  }
}

const defaultOption: IGplot3DOption = {
  el: document.body,
  scene: {
    backgroundColor: '#000000',
  },
  ambient: {
    color: '#ffffff',
    luminance: 3,
  },
  camera: {
    viewAngle: 15,
    near: 0.1,
    far: 1000,
    initialPosition: { x: 200, y: 200, z: 200 },
  },
  controls: {
    enablePan: true,
    enableRotate: true,
    enableZoom: true,
    mouseButtons: {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    },
  },
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function customMerge(target: IGplot3DOption, source: IGplot3DOption) {
  return undefined
}
function hexString2Number(hex: string) {
  return parseInt(hex.replace('#', ''), 16)
}
/**
 * 计划：
 * 数据描述：线（路径位置，颜色，虚实线），节点（位置，名称，中心偏移），背景区块（路径位置，颜色，虚实线，下标）
 * 写一个特效线类，包含一条线和线上的特效：写特效
 */
export class Gplot3D {
  private domElement!: HTMLCanvasElement
  private option: IGplot3DOption
  private observer!: ResizeObserver
  private devicePixelRatio: number
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private renderer!: THREE.WebGLRenderer

  constructor(option: DeepPartial<IGplot3DOption>) {
    this.devicePixelRatio = window.devicePixelRatio
    this.option = lodashLib.mergeWith(lodashLib.cloneDeep(defaultOption), option, customMerge)
    this.createCanvas()
    this.initBaseScene()
    this.initRenderer()
    this.initOrbitControls()

    this.render()
    this.animate()
  }
  private render() {
    if (!this.renderer || !this.scene || !this.camera) {
      throw new Error('Missing render, scene or camera!')
    }
    this.renderer.render(this.scene, this.camera)
  }

  private createCanvas() {
    const option = this.option
    const { el } = option
    const canvas = document.createElement('canvas')
    this.domElement = canvas
    setCanvasSize(el, canvas)
    this.registeResize()

    Array.prototype.forEach.call(el.children, (child) => el.removeChild(child))
    el.appendChild(canvas)
  }
  /* 初始化场景、相机、灯光、轨道 */
  private initBaseScene() {
    const canvas = this.domElement
    const { scene: sceneOpt, ambient: ambientOpt, camera: cameraOpt } = this.option

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(hexString2Number(sceneOpt.backgroundColor))

    const ambient = new THREE.AmbientLight(hexString2Number(ambientOpt.color), ambientOpt.luminance)
    scene.add(ambient)

    const camera = new THREE.PerspectiveCamera(
      cameraOpt.viewAngle,
      canvas.width / canvas.height,
      cameraOpt.near,
      cameraOpt.far
    )
    camera.position.x = cameraOpt.initialPosition.x
    camera.position.y = cameraOpt.initialPosition.y
    camera.position.z = cameraOpt.initialPosition.z
    scene.add(camera)

    this.scene = scene
    this.camera = camera
  }
  /* 初始化渲染器 */
  private initRenderer() {
    const canvas = this.domElement
    if (!canvas) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas })
    renderer.setPixelRatio(this.devicePixelRatio)
    renderer.setSize(canvas.width / this.devicePixelRatio, canvas.height / this.devicePixelRatio)
    this.renderer = renderer
  }
  /* 初始化轨道 */
  private initOrbitControls() {
    const canvas = this.domElement
    if (!canvas) return
    const camera = this.camera
    const { controls: controlsOpt } = this.option
    const controls = new OrbitControls(camera, canvas)
    controls.enablePan = controlsOpt.enablePan
    controls.enableRotate = controlsOpt.enableRotate
    controls.enableZoom = controlsOpt.enableZoom
    controls.mouseButtons = controlsOpt.mouseButtons
    controls.addEventListener('change', () => {
      this.render()
    })
    controls.update()
  }
  /* 尺寸变化 */
  private handleResize() {
    const option = this.option
    const { el } = option
    const canvas = this.domElement
    const camera = this.camera
    if (!canvas) return

    const { width, height } = setCanvasSize(el, canvas)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }
  private registeResize() {
    const option = this.option
    const { el } = option
    this.observer = createDomSizeObserver(el, () => {
      this.handleResize()
    })
  }
  private cancelResize() {
    if (this.observer) this.observer.disconnect()
  }

  private rafId!: number | null
  private animate() {
    // 一定要在此函数中调用
    this.flowLines.forEach((item) => {
      item.effectRun()
    })
    this.render()
    this.rafId = requestAnimationFrame(() => {
      this.animate()
    })
  }
  private cancelAnimate() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
  public destory() {
    this.removeFlowLines()
    this.removeSpriteNodes()
    this.cancelResize()
    this.cancelAnimate()
  }
  /**
   * 管理线
   */
  private flowLines: FlowLine3D[] = []
  public addFlowLines(lineData: DeepPartial<IFlowLine3DOption>[]) {
    if (!this.scene || !this.domElement) return this
    this.flowLines = lineData.map((l) => {
      return new FlowLine3D({ ...l, canvas: this.domElement }).addTo(this.scene)
    })
    return this
  }
  public removeFlowLines() {
    this.flowLines.forEach((item) => item.destory())
    this.flowLines = []
    return this
  }
  public getFlowLineById(id: number) {
    const flowLineMap = new Map(this.flowLines.map((item) => [item.id, item]))
    return flowLineMap.get(id) || null
  }
  public setStatusById(
    id: number,
    enable = false,
    colorCfg?: {
      color?: string
      colorStop?: { color: string; percent: number }[]
    }
  ) {
    const flowLine = this.getFlowLineById(id)
    if (!flowLine) {
      console.warn(`The instance of FlowLine3D whose id is ${id} does not exist`)
      return null
    }
    flowLine.setMaterial({
      dashed: !enable,
      color: colorCfg?.color ? colorCfg.color : undefined,
    })
    flowLine.setEffect({
      enable,
      colorStop: colorCfg?.colorStop ? colorCfg.colorStop : [],
    })
  }

  /**
   * 管理点-精灵图
   */
  private spriteNodes: THREE.Sprite[] = []
  private spriteNodesMap: WeakMap<THREE.Sprite, DeepPartial<ISpriteNodeItem>> = new WeakMap()
  public addSpriteNodes(nodeData: DeepPartial<ISpriteNodeItem>[]) {
    if (!this.scene) return this
    this.spriteNodes = nodeData.map((item) => {
      const map = new THREE.TextureLoader().load(item.src || '')
      const material = new THREE.SpriteMaterial({ map: map })
      const sprite = new THREE.Sprite(material)
      const center = new Array(2).fill(0.5).map((v, i) => item.center?.[i] || v) as number[]
      const scale = new Array(3).fill(1).map((v, i) => item.scale?.[i] || v) as number[]
      const position = new Array(3)
        .fill(0)
        .map((v, i) => (item.position?.[i] || v) + (item.offset?.[i] || 0)) as number[]
      sprite.center.set(center[0], center[1])
      sprite.scale.set(scale[0], scale[1], scale[2])
      sprite.position.set(position[0], position[1], position[2])
      this.scene.add(sprite)
      this.spriteNodesMap.set(sprite, item)
      return sprite
    })
    return this
  }
  public removeSpriteNodes() {
    this.spriteNodes.forEach((item) => {
      this.scene.remove(item)
    })
    this.spriteNodes = []
    return this
  }
  /**
   * 管理点-gltf模型
   */
  private gltfNodes: IGltfLoaderResult[]
  private gltfNodesMap: WeakMap<IGltfLoaderResult, DeepPartial<ISpriteNodeItem>> = new WeakMap()
}

/* 尺寸变化工具-1 */
function createDomSizeObserver(
  el: HTMLElement,
  callback: (width: number, height: number, oldWidth: number, oldHeight: number) => void
) {
  let oldWidth = 0
  let oldHeight = 0
  // 创建一个观察器实例并传入回调函数
  const observer = new ResizeObserver(function (entries) {
    const entry = entries[0]
    const { width, height } = entry.contentRect
    if (width !== oldWidth || height !== oldHeight) {
      callback(width, height, oldWidth, oldHeight)
    }
    oldWidth = width
    oldHeight = height
  })
  observer.observe(el)
  return observer
}
/* 尺寸变化工具-2 */
function setCanvasSize(father: HTMLElement, child: HTMLCanvasElement) {
  const { width, height } = getElInnerSize(father)
  child.width = width
  child.height = height
  return { width, height }
}
/* 尺寸变化工具-3 */
function getElInnerSize(el: HTMLElement) {
  const elSizeInfo = getComputedStyle(el)
  const elBoxSizing = elSizeInfo.boxSizing
  const elWidth = parseFloat(elSizeInfo.width)
  const elHeight = parseFloat(elSizeInfo.height)
  const elPaddingX = parseFloat(elSizeInfo.paddingLeft) + parseFloat(elSizeInfo.paddingRight)
  const elPaddingY = parseFloat(elSizeInfo.paddingTop) + parseFloat(elSizeInfo.paddingBottom)
  const elBorderX = parseFloat(elSizeInfo.borderLeft) + parseFloat(elSizeInfo.borderRight)
  const elBorderY = parseFloat(elSizeInfo.borderTop) + parseFloat(elSizeInfo.borderBottom)
  const width = elBoxSizing === 'border-box' ? elWidth - elPaddingX - elBorderX : elWidth
  const height = elBoxSizing === 'border-box' ? elHeight - elPaddingY - elBorderY : elHeight
  return {
    width,
    height,
  }
}
