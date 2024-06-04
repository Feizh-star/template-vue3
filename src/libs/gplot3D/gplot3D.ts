import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import * as lodashLib from 'lodash'
import { FlowLine3D, type IFlowLine3DOption } from './flowLine3D'
import {
  loadGltfModel,
  mapChildrenToModel,
  createDomSizeObserver,
  setCanvasSize,
  updateMousePosition,
  disposeModel,
  disposeSprite,
  registerNodeEventHelper,
  recordOutEventToInnerHelper,
  removeNodeEventHelper,
  throttle,
  loadFont,
} from './gplot3DTool'

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends any[] ? T[P] : T[P] extends object ? DeepPartial<T[P]> : T[P]
}
export type IFlowLineItem = IFlowLine3DOption & { common: Record<string, any> }
export interface ITextOption {
  font: string
  content: string | ((cmn?: Record<string, any>) => string)
  geometry: {
    size: number
    depth: number
  }
  material: {
    color: string
    transparent: boolean
    opacity: number
  }
  center: boolean
  rotation: number[]
  scale: number[]
  offset: number[]
  position: number[]
}
export interface ISpriteNodeItem {
  common: Record<string, any>
  src: string
  center: number[]
  scale: number[]
  position: number[]
  offset: number[]
  text: ITextOption
}
export interface IGltfNodeItem {
  common: Record<string, any>
  src: string
  rotation: number[]
  scale: number[]
  position: number[]
  offset: number[]
  text: ITextOption
}
export type IRailItem = DeepPartial<
  Omit<IFlowLineItem, 'effect' | 'id' | 'canvas' | 'line'> & {
    text: ITextOption
    relative: number
  }
>
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
  grid: {
    enable: boolean
    size: number
    divisions: number
    colorCenterLine: string
    colorGrid: string
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
  grid: {
    enable: false,
    size: 100,
    divisions: 5,
    colorCenterLine: '#20273f',
    colorGrid: '#20273f',
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
  private fontMap = new Map<string, any>()

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
    const { scene: sceneOpt, ambient: ambientOpt, camera: cameraOpt, grid: gridOpt } = this.option

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(hexString2Number(sceneOpt.backgroundColor))

    const ambient = new THREE.AmbientLight(hexString2Number(ambientOpt.color), ambientOpt.luminance)
    scene.add(ambient)

    if (gridOpt.enable) {
      const gridHelper = new THREE.GridHelper(
        gridOpt.size,
        gridOpt.divisions,
        gridOpt.colorCenterLine,
        gridOpt.colorGrid
      )
      scene.add(gridHelper)
    }

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
    if (this.flowEffectUpdate) this.flowEffectUpdate()
    this.gltfNodes.forEach((item) => {
      this.gltfNodesAnimationMixer.get(item)?.update()
    })
    this.render()
    // console.log('camera.position', this.camera.position)
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
  public addFont(name: string, url: string) {
    return loadFont(url).then((font) => {
      this.fontMap.set(name, font)
    })
  }
  private clearFont() {
    this.fontMap.clear()
  }
  private setText(origin: number[], option: DeepPartial<ITextOption>) {
    const font = this.fontMap.get(option.font || '')
    if (!font) {
      console.warn(`No font named ${option.font} found`)
      return []
    }
    if (!option.content) return []
    const contentSplit = (option.content as string).split('\n')
    const textMeshList: THREE.Mesh[] = []
    for (const [l, text] of contentSplit.entries()) {
      const geometry = new TextGeometry(text, {
        font: font,
        size: option.geometry?.size || 0.3, // 字体大小
        depth: option.geometry?.depth || 0, // 挤出文本的厚度
      })
      geometry.computeBoundingBox()

      if (option.center) geometry.center() // 居中文本
      const materials = new THREE.MeshBasicMaterial({
        color: hexString2Number(option.material?.color || '#ffffff'),
        transparent: option.material?.transparent ?? true,
        opacity: option.material?.opacity || 1,
      })
      const textMesh = new THREE.Mesh(geometry, materials)
      // 位置，旋转，缩放
      const lineHeight = (geometry.boundingBox.max.y - geometry.boundingBox.min.y) * 1.2
      const lineYOffset = [0, ((contentSplit.length - 1) * 0.5 - l) * lineHeight, 0]
      const rotation = new Array(3).fill(0).map((v, i) => option.rotation?.[i] || v) as number[]
      const scale = new Array(3).fill(1).map((v, i) => option.scale?.[i] || v) as number[]
      const position = [...origin].map(
        (v, i) => v + (option.position?.[i] || 0) + (option.offset?.[i] || 0) + lineYOffset[i]
      ) as number[]
      textMesh.rotation.set(rotation[0], rotation[1], rotation[2])
      textMesh.scale.set(scale[0], scale[1], scale[2])
      textMesh.position.set(position[0], position[1], position[2])
      this.scene.add(textMesh)
      textMeshList.push(textMesh)
    }
    return textMeshList
  }
  public destory() {
    this.removeFlowLines()
    this.removeSpriteNodes()
    this.removeGltfNodes()
    this.removeAllRails()
    this.cancelResize()
    this.cancelAnimate()
    this.removeAllMouseEvent()
    this.clearFont()
    this.option.el?.removeChild(this.domElement)
  }

  /* 事件监听器 */
  private raycaster: THREE.Raycaster = new THREE.Raycaster()
  private mousePosition: THREE.Vector2 = new THREE.Vector2()
  private mouseEvents: Map<string, ((event: Event, intersects: THREE.Intersection[]) => void)[]> =
    new Map()
  private mouseEventHandlerMap = new WeakMap<Function, ReturnType<typeof registerNodeEventHelper>>()
  private mouseEventCommonHandlerMap: Map<string, Function> = new Map()
  private registerMouseEvent(
    eventType: string,
    handler: (event: Event, intersects: THREE.Intersection[]) => void
  ) {
    const handlers = this.mouseEvents.get(eventType)
    if (handlers && handlers.length > 0) {
      handlers.push(handler)
      this.mouseEvents.set(eventType, handlers)
    } else {
      const commonHandler = throttle((event: Event) => {
        const { mousePosition: mouse, domElement: canvas } = this
        // 更新鼠标位置
        updateMousePosition(mouse, event, canvas)
        // 将鼠标位置转换为世界坐标
        this.raycaster.setFromCamera(mouse, this.camera)
        // 计算物体和鼠标的交点
        const intersects = this.raycaster.intersectObjects(this.scene.children)
        const eventHanlders = this.mouseEvents.get(eventType)
        eventHanlders?.forEach((handler) => {
          handler(event, intersects)
        })
      }, 16.7)
      this.domElement?.addEventListener(eventType, commonHandler)
      this.mouseEvents.set(eventType, [handler])
      this.mouseEventCommonHandlerMap.set(eventType, commonHandler)
    }
  }
  private removeMouseEvent(
    eventType: string,
    handler?: (event: Event, intersects: THREE.Intersection[]) => void
  ) {
    if (handler) {
      const handlers = this.mouseEvents.get(eventType)
      if (handlers) {
        this.mouseEvents.set(
          eventType,
          handlers.filter((item) => item !== handler)
        )
      }
    } else {
      this.mouseEvents.delete(eventType)
    }
  }
  // 把回调函数数组已经空了的事件关闭
  private removeNoHandlerMouseEvent() {
    ;[...this.mouseEvents.entries()]
      .filter((item) => item[1].length === 0)
      .map((item) => item[0])
      .forEach((eventType) => {
        this.removeMouseEvent(eventType)
      })
  }
  private removeAllMouseEvent() {
    this.mouseEvents.clear()
    for (const [eventType, handler] of this.mouseEventCommonHandlerMap.entries()) {
      this.domElement?.removeEventListener(eventType, handler as (e: Event) => void)
    }
  }

  /**
   * 管理线
   */
  private flowLines: FlowLine3D[] = []
  private flowLinesMap: WeakMap<FlowLine3D, DeepPartial<IFlowLineItem>> = new WeakMap()
  private flowEffectUpdate!: (() => void) | null
  public addFlowLines(lineData: DeepPartial<IFlowLineItem>[]) {
    if (!this.scene || !this.domElement) return this
    this.flowLines = lineData.map((l) => {
      if (l.id && this.getFlowLineById(l.id)) {
        this.removeFlowLineById(l.id) // 如果此id已存在，则销毁重建
      }
      const flowLine = new FlowLine3D({ ...l, canvas: this.domElement }).addTo(this.scene)
      this.flowLinesMap.set(flowLine, l)
      return flowLine
    })
    this.flowEffectUpdate = throttle(() => {
      this.flowLines.forEach((item) => {
        item.effectRun()
      })
    }, 16.7)
    return this
  }
  public removeFlowLines() {
    this.flowLines.forEach((item) => item.destory())
    this.flowLines = []
    this.flowEffectUpdate = null
    return this
  }
  public getFlowLineById(id: number) {
    const flowLineMap = new Map(this.flowLines.map((item) => [item.id, item]))
    return flowLineMap.get(id)
  }
  public getFlowLineDataById(id: number) {
    const flowLine = this.getFlowLineById(id)
    return flowLine && this.flowLinesMap.get(flowLine)
  }
  public removeFlowLineById(id: number) {
    const index = this.flowLines.findIndex((item) => item.id === id)
    const flowLine = index >= 0 ? this.flowLines[index] : undefined
    if (flowLine) {
      this.flowLines.splice(index, 1)
      flowLine.destory()
    }
    if (this.flowLines.length === 0) {
      this.flowEffectUpdate = null
    }
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
   * 线框
   */
  private railLine: Line2[] = []
  private railLineTextMap: Map<Line2, THREE.Mesh[]> = new Map()
  public addRails(rails: IRailItem[]) {
    if (!this.scene || !this.domElement) return []
    this.railLine = rails.map((item) => {
      const { path: positions, lineMaterial: lineMaterialOpt, text, relative } = item

      const trackLine = new LineGeometry()
      trackLine.setPositions(positions?.flat() || [])

      const trackLineMaterial = new LineMaterial()
      ;(trackLineMaterial.color as THREE.Color).setHex(
        hexString2Number(lineMaterialOpt?.color || '#fffff')
      )
      trackLineMaterial.dashed = lineMaterialOpt?.dashed ?? true
      trackLineMaterial.linewidth = lineMaterialOpt?.linewidth ?? 1
      trackLineMaterial.resolution.set(this.domElement.width, this.domElement.width)

      const line = new Line2(trackLine, trackLineMaterial)
      line.computeLineDistances()
      this.scene.add(line)
      if (typeof text?.content === 'string' && positions) {
        this.railLineTextMap.set(line, this.setText(positions[relative || 0] || positions[0], text))
      }
      return line
    })
  }
  public removeAllRails() {
    this.railLine.forEach((item) => {
      this.scene.remove(item)
      disposeModel(item)
      this.railLineTextMap.get(item)?.forEach((text) => {
        this.scene.remove(text)
        disposeModel(text)
      })
      this.railLineTextMap.delete(item)
    })
    this.railLine = []
  }

  /**
   * 管理点-精灵图
   */
  private spriteNodes: THREE.Sprite[] = []
  private spriteNodesMap: WeakMap<THREE.Sprite, DeepPartial<ISpriteNodeItem>> = new WeakMap()
  private spriteNodesTextMap: Map<THREE.Sprite, THREE.Mesh[]> = new Map()
  private spriteNodesEventMap = new Map<string, ReturnType<typeof registerNodeEventHelper>[]>()
  public addSpriteNodes(nodeData: DeepPartial<ISpriteNodeItem>[]) {
    if (!this.scene) return []
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
      if (item.text) {
        item.text.content =
          item.text.content && typeof item.text.content === 'function'
            ? item.text.content(item.common)
            : item.text.content
        this.spriteNodesTextMap.set(sprite, this.setText(position, item.text))
      }
      this.spriteNodesMap.set(sprite, item)
      return sprite
    })
    return this.spriteNodes
  }
  public onSpriteNodes(
    eventType: string,
    handler: (
      type: string,
      event: Event,
      model: THREE.Sprite[],
      data: DeepPartial<ISpriteNodeItem>[]
    ) => void
  ) {
    const eInfo = registerNodeEventHelper(
      'sprite',
      eventType,
      handler,
      this.registerMouseEvent.bind(this),
      (intersects) =>
        intersects
          .map((item) =>
            new Set(this.spriteNodes).has(item.object as THREE.Sprite) ? item.object : null
          )
          .filter((item) => item) as THREE.Sprite[],
      this.spriteNodesMap
    )
    recordOutEventToInnerHelper(
      eventType,
      handler,
      eInfo,
      this.spriteNodesEventMap,
      this.mouseEventHandlerMap
    )
  }
  public offSpriteNodes(eventType: string, handler?: Function) {
    removeNodeEventHelper(
      eventType,
      this.spriteNodesEventMap,
      this.mouseEventHandlerMap,
      this.removeMouseEvent.bind(this),
      handler
    )
    this.removeNoHandlerMouseEvent()
  }
  public removeSpriteNodes() {
    this.spriteNodes.forEach((item) => {
      this.scene.remove(item)
      disposeSprite(item)
      this.spriteNodesTextMap.get(item)?.forEach((text) => {
        this.scene.remove(text)
        disposeModel(text)
      })
      this.spriteNodesTextMap.delete(item)
    })
    this.spriteNodes = []
    for (const eInfos of this.spriteNodesEventMap.values()) {
      eInfos.forEach((item) => this.removeMouseEvent(item.name, item.callback))
    }
    this.removeNoHandlerMouseEvent()
    return this
  }
  /**
   * 管理点-gltf模型
   */
  private gltfNodes: IGltfLoaderResult[] = []
  private gltfNodesMap: WeakMap<IGltfLoaderResult, DeepPartial<IGltfNodeItem>> = new WeakMap()
  private gltfNodesTextMap: Map<IGltfLoaderResult, THREE.Mesh[]> = new Map()
  private gltfNodesEventMap = new Map<string, ReturnType<typeof registerNodeEventHelper>[]>()
  private childrenModelMap: WeakMap<Object, IGltfLoaderResult> = new WeakMap()
  private gltfNodesAnimationMixer: WeakMap<IGltfLoaderResult, AnimationMixerUpdater> = new WeakMap() // 可根据模型数据查找动画控制器
  public async addGltfNodes(nodeData: DeepPartial<IGltfNodeItem>[]) {
    if (!this.scene)
      return Promise.resolve(nodeData.map((item) => ({ status: false, data: item, model: null })))
    const loaders = nodeData.map((item) => {
      return new Promise<{
        status: boolean
        data: DeepPartial<IGltfNodeItem>
        model: IGltfLoaderResult | null
        error: null | Error
      }>((resolve) => {
        try {
          loadGltfModel<IGltfLoaderResult>(item?.src || '')
            .then((gltfModel) => {
              const modelObject = gltfModel.scene
              // 位置，旋转，缩放
              const rotation = new Array(3)
                .fill(0)
                .map((v, i) => item.rotation?.[i] || v) as number[]
              const scale = new Array(3).fill(1).map((v, i) => item.scale?.[i] || v) as number[]
              const position = new Array(3)
                .fill(0)
                .map((v, i) => (item.position?.[i] || v) + (item.offset?.[i] || 0)) as number[]
              modelObject.rotation.set(rotation[0], rotation[1], rotation[2])
              modelObject.scale.set(scale[0], scale[1], scale[2])
              modelObject.position.set(position[0], position[1], position[2])

              // 将模型下的children（可以理解为零件），一一映射到模型数据本身，方便交互时根据零件找到整个模型
              this.childrenModelMap.set(modelObject, gltfModel)
              mapChildrenToModel(gltfModel, modelObject.children, this.childrenModelMap)

              // 处理模型的动画
              this.gltfNodesAnimationMixer.set(gltfModel, new AnimationMixerUpdater(gltfModel))

              this.gltfNodes.push(gltfModel)
              this.gltfNodesMap.set(gltfModel, item)
              this.scene.add(modelObject)
              if (item.text) {
                item.text.content =
                  item.text.content && typeof item.text.content === 'function'
                    ? item.text.content(item.common)
                    : item.text.content
                this.gltfNodesTextMap.set(gltfModel, this.setText(position, item.text))
              }
              resolve({
                status: true,
                data: item,
                model: gltfModel,
                error: null,
              })
            })
            .catch((error) => {
              resolve({
                status: false,
                data: item,
                model: null,
                error: error,
              })
            })
        } catch (error) {
          resolve({
            status: false,
            data: item,
            model: null,
            error: error as Error,
          })
        }
      })
    })
    // Promise.all是为了最终给出一个加载完成的结果，每一个promise内部的loadGltfModel都是同步执行，互不阻塞
    const result = await Promise.all(loaders)
    return result
  }
  public onGltfNodes(
    eventType: string,
    handler: (
      type: string,
      event: Event,
      model: IGltfLoaderResult[],
      data: DeepPartial<IGltfNodeItem>[]
    ) => void
  ) {
    const eInfo = registerNodeEventHelper(
      'gltf',
      eventType,
      handler,
      this.registerMouseEvent.bind(this),
      (intersects) =>
        intersects
          .map((item) => this.childrenModelMap.get(item.object))
          .filter((item) => item) as IGltfLoaderResult[],
      this.gltfNodesMap
    )
    recordOutEventToInnerHelper(
      eventType,
      handler,
      eInfo,
      this.gltfNodesEventMap,
      this.mouseEventHandlerMap
    )
  }
  public offGltfNodes(eventType: string, handler?: Function) {
    removeNodeEventHelper(
      eventType,
      this.gltfNodesEventMap,
      this.mouseEventHandlerMap,
      this.removeMouseEvent.bind(this),
      handler
    )
    this.removeNoHandlerMouseEvent()
  }
  public removeGltfNodes() {
    this.gltfNodes.forEach((item) => {
      this.gltfNodesAnimationMixer.get(item)?.distory()
      this.scene.remove(item.scene)
      disposeModel(item.scene)
      this.gltfNodesTextMap.get(item)?.forEach((text) => {
        this.scene.remove(text)
        disposeModel(text)
      })
      this.gltfNodesTextMap.delete(item)
    })
    this.gltfNodes = []
    for (const eInfos of this.gltfNodesEventMap.values()) {
      eInfos.forEach((item) => this.removeMouseEvent(item.name, item.callback))
    }
    this.removeNoHandlerMouseEvent()
    return this
  }
}

/**
 * 简单模型动画管理器
 */
class AnimationMixerUpdater {
  private clock: THREE.Clock = new THREE.Clock()
  private mixer: THREE.AnimationMixer
  private previousTime: number = 0
  private animateClip: { clip: THREE.AnimationClip; action: THREE.AnimationAction }[] = []
  constructor(gltfModel: IGltfLoaderResult) {
    this.mixer = new THREE.AnimationMixer(gltfModel.scene)
    gltfModel.animations.forEach((clip) => {
      const action = this.mixer.clipAction(clip)
      action.play()
      this.animateClip.push({ clip, action })
    })
  }
  public update() {
    if (!this.mixer) return this
    const elapsedTime = this.clock.getElapsedTime()
    const deltaTime = elapsedTime - this.previousTime
    this.previousTime = elapsedTime
    this.mixer.update(deltaTime)
    return this
  }
  public distory() {
    if (!this.mixer) return
    const root = this.mixer.getRoot()
    this.mixer.stopAllAction()
    this.animateClip.forEach((item) => {
      this.mixer.uncacheClip(item.clip)
      this.mixer.uncacheAction(item.clip, root)
    })
    this.mixer.uncacheRoot(root)
  }
}
