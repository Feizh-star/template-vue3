import maplibregl from 'maplibre-gl'
import * as THREE from 'three'
import * as lodashLib from 'lodash'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { FlowLine3D, type IFlowLine3DOption } from '../gplot3D/flowLine3D'
import {
  loadGltfModel,
  mapChildrenToModel,
  createDomSizeObserver,
  updateMousePosition,
  disposeModel,
  disposeSprite,
  registerNodeEventHelper,
  recordOutEventToInnerHelper,
  removeNodeEventHelper,
  throttle,
  loadFont,
} from '../gplot3D/gplot3DTool'
export type DeepPartial<T> = {
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

function hexString2Number(hex: string) {
  return parseInt(hex.replace('#', ''), 16)
}

export interface IThreeOption {
  animation: boolean
  axesHelper: {
    enable: boolean
    size: number
  }
  ambientLight: {
    enable: boolean
    color: string
    luminance: number
  }
  directionalLight: {
    enable: boolean
    color: string
    luminance: number
    position: number[]
    target: number[]
  }
}
export interface ILayerOption {
  center: maplibregl.LngLatLike
}
export interface IGplot3DLayerOption {
  threeOption: IThreeOption
  layerOption: ILayerOption
}
const defaultOption: IGplot3DLayerOption = {
  threeOption: {
    animation: true,
    axesHelper: {
      enable: true,
      size: 60,
    },
    ambientLight: {
      enable: true,
      color: '#ffffff',
      luminance: 1,
    },
    directionalLight: {
      enable: true,
      color: '#ffffff',
      luminance: 3,
      position: [200, 200, 200],
      target: [0, 0, 0],
    },
  },
  layerOption: {
    center: [115, 40],
  },
}

export class Gplot3DMap {
  private id = '3d-model'
  private type = 'custom'
  private renderingMode = '3d'
  private threeOption: IThreeOption
  private layerOption: ILayerOption
  private devicePixelRatio!: number
  private map!: maplibregl.Map
  constructor(option?: DeepPartial<IGplot3DLayerOption>) {
    this.threeOption = lodashLib.mergeWith(
      lodashLib.cloneDeep(defaultOption.threeOption),
      option?.threeOption || {}
    )
    this.layerOption = lodashLib.mergeWith(
      lodashLib.cloneDeep(defaultOption.layerOption),
      option?.layerOption || {}
    )
  }
  /* ************************************************************************************************************ */
  private domElement!: HTMLCanvasElement
  private axesHelper: THREE.AxesHelper | undefined
  protected scene!: THREE.Scene
  protected camera!: THREE.Camera
  protected ambientLight!: THREE.AmbientLight
  protected directionalLight!: THREE.DirectionalLight
  protected renderer!: THREE.WebGLRenderer
  private observer!: ResizeObserver
  /* 初始化 */
  protected initScene() {
    this.scene = new THREE.Scene()
  }
  protected initCamera() {
    this.camera = new THREE.Camera()
  }
  public setLight(option?: Partial<Pick<IThreeOption, 'ambientLight' | 'directionalLight'>>) {
    if (!this.scene) throw new Error('Attempt to init Light before scene inited')
    if (option?.ambientLight) {
      this.threeOption.ambientLight = lodashLib.mergeWith(
        lodashLib.cloneDeep(this.threeOption.ambientLight),
        option.ambientLight
      )
    }
    if (option?.directionalLight) {
      this.threeOption.directionalLight = lodashLib.mergeWith(
        lodashLib.cloneDeep(this.threeOption.directionalLight),
        option.directionalLight
      )
    }
    const { ambientLight: ambientOpt, directionalLight: directionalOpt } = this.threeOption
    if (ambientOpt.enable) {
      let ambientLight = this.ambientLight
      if (!ambientLight) {
        ambientLight = new THREE.AmbientLight()
        this.ambientLight = ambientLight
      }
      ambientLight.color.setHex(hexString2Number(ambientOpt.color))
      ambientLight.intensity = ambientOpt.luminance
      if (!this.scene.getObjectById(ambientLight.id)) this.scene.add(ambientLight)
    }
    if (directionalOpt.enable) {
      let directionalLight = this.directionalLight
      if (!directionalLight) {
        directionalLight = new THREE.DirectionalLight()
        this.directionalLight = directionalLight
      }
      directionalLight.color.setHex(hexString2Number(directionalOpt.color))
      directionalLight.intensity = directionalOpt.luminance
      const position = new Array(3)
        .fill(200)
        .map((v, i) => directionalOpt.position?.[i] || v) as number[]
      directionalLight.position.set(position[0], position[1], position[2])
      if (directionalOpt.target.some((item) => item !== 0)) {
        const targetObject = new THREE.Object3D()
        this.scene.add(targetObject)
        const target = new Array(3)
          .fill(0)
          .map((v, i) => directionalOpt.target?.[i] || v) as number[]
        targetObject.position.set(target[0], target[1], target[2])
        directionalLight.target = targetObject
      }
      if (!this.scene.getObjectById(directionalLight.id)) this.scene.add(directionalLight)
    }
  }
  public setAxesHelper(option?: Partial<IThreeOption['axesHelper']>) {
    if (!this.scene) throw new Error('Attempt to add AxesHelper before scene inited')
    if (option) {
      this.threeOption.axesHelper = lodashLib.mergeWith(
        lodashLib.cloneDeep(this.threeOption.axesHelper),
        option
      )
    }
    const axesHelperOption = this.threeOption.axesHelper
    if (axesHelperOption.enable) {
      let axesHelper = this.axesHelper
      if (!axesHelper) {
        axesHelper = new THREE.AxesHelper(axesHelperOption.size)
        this.axesHelper = axesHelper
      }
      if (!this.scene.getObjectById(axesHelper.id)) this.scene.add(axesHelper)
    } else if (this.axesHelper?.id && this.scene.getObjectById(this.axesHelper.id)) {
      this.scene.remove(this.axesHelper)
    }
  }
  protected initThreeRenderer(canvas: HTMLCanvasElement) {
    this.domElement = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
    })
    this.setThreeRendererSize(canvas)
    this.renderer.autoClear = false
  }
  private renderThree() {
    if (!this.renderer || !this.scene || !this.camera) {
      throw new Error('Missing render, scene or camera!')
    }
    this.renderer.render(this.scene, this.camera)
  }
  public threeDestory() {
    this.removeFlowLines()
    this.removeSpriteNodes()
    this.removeGltfNodes()
    this.removeAllRails()
    this.cancelResize()
    this.removeAllMouseEvent()
    this.clearFont()
  }
  /* 尺寸变化，更新three的dpr和尺寸 */
  protected setThreeRendererSize(canvas: HTMLCanvasElement) {
    if (window.devicePixelRatio !== this.devicePixelRatio) {
      this.devicePixelRatio = window.devicePixelRatio
      this.renderer.setPixelRatio(this.devicePixelRatio)
      this.updateSubObjectDPR()
    }
    this.renderer.setSize(canvas.width, canvas.height)
  }
  private registeResize() {
    const canvas = this.domElement
    this.observer = createDomSizeObserver(canvas, () => {
      this.setThreeRendererSize(canvas)
    })
  }
  private cancelResize() {
    if (this.observer) this.observer.disconnect()
  }
  // 更新子级对象的DPR
  private updateSubObjectDPR() {
    this.flowLines.forEach((item) => {
      item.resizeLine(this.devicePixelRatio)
    })
    this.resizeRails(this.devicePixelRatio)
  }
  /* 处理动画循环 */
  private clock!: THREE.Clock | null
  private deltaTime: number = 0
  public toggleAnimation(flag: boolean) {
    if (flag !== this.threeOption.animation) {
      this.threeOption.animation = flag
    }
    if (flag) {
      this.deltaTime = 0
      this.clock = new THREE.Clock()
    } else {
      this.clock = null
    }
  }
  protected threeTick() {
    if (this.threeOption.animation && this.clock) {
      this.deltaTime = this.clock.getDelta()
      this.flowLines.forEach((item) => {
        item.effectRun(this.deltaTime)
      })
      this.gltfNodes.forEach((item) => {
        this.gltfNodesAnimationMixer.get(item)?.update(this.deltaTime)
      })
      this.renderThree()
    }
  }

  /* 添加字体文件 */
  private fontMap = new Map<string, any>()
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
  public addFlowLines(lineData: DeepPartial<IFlowLineItem>[]) {
    if (!this.scene || !this.domElement) return this
    this.flowLines = lineData.map((l) => {
      if (l.id && this.getFlowLineById(l.id)) {
        this.removeFlowLineById(l.id) // 如果此id已存在，则销毁重建
      }
      const flowLine = new FlowLine3D({
        ...l,
        canvas: this.domElement,
        devicePixelRatio: this.devicePixelRatio,
      }).addTo(this.scene)
      this.flowLinesMap.set(flowLine, l)
      return flowLine
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
    return this
  }
  // 只是给外界提供一个方便的工具，其实不算这个类的功能，这些代码在外部写是一样的
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
  private railLineDataMap: WeakMap<Line2, IRailItem> = new WeakMap()
  /* 当devicePixelRatio变化时更新line2的宽度 */
  private resizeRails(dpr: number) {
    this.railLine.forEach((item) => {
      const railLineOpt = this.railLineDataMap.get(item)
      if (railLineOpt) {
        ;(item.material as LineMaterial).linewidth =
          (railLineOpt.lineMaterial?.linewidth ?? 1) / dpr
      }
    })
  }
  public addRails(rails: IRailItem[]) {
    if (!this.scene || !this.domElement) return this
    this.railLine = rails.map((item) => {
      const { path: positions, lineMaterial: lineMaterialOpt, text, relative } = item

      const trackLine = new LineGeometry()
      trackLine.setPositions(positions?.flat() || [])

      const trackLineMaterial = new LineMaterial()
      ;(trackLineMaterial.color as THREE.Color).setHex(
        hexString2Number(lineMaterialOpt?.color || '#fffff')
      )
      trackLineMaterial.dashed = lineMaterialOpt?.dashed ?? true
      trackLineMaterial.linewidth = (lineMaterialOpt?.linewidth ?? 1) / this.devicePixelRatio
      trackLineMaterial.resolution.set(this.domElement.width, this.domElement.width)

      const line = new Line2(trackLine, trackLineMaterial)
      line.computeLineDistances()
      this.scene.add(line)
      if (typeof text?.content === 'string' && positions) {
        this.railLineTextMap.set(line, this.setText(positions[relative || 0] || positions[0], text))
      }
      this.railLineDataMap.set(line, item)
      return line
    })
    return this
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
    return this
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
      const map = new THREE.TextureLoader().load(item.src || '', function (texture) {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.needsUpdate = true
      })
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
    return this
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
    return this
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
    return this
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
    return this
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
  /* ************************************************************************************************************ */

  onAdd(map: maplibregl.Map, gl: WebGL2RenderingContext | WebGLRenderingContext) {
    this.map = map
    this.initScene()
    this.initCamera()
    this.setLight()
    this.setAxesHelper()
    this.initThreeRenderer(this.map.getCanvas())
    this.registeResize()
    this.toggleAnimation(this.threeOption.animation)
  }
  onRemove() {
    this.threeDestory()
  }
  render(
    gl: WebGL2RenderingContext | WebGLRenderingContext,
    args: maplibregl.CustomRenderMethodInput
  ) {
    const offsetFromCenterElevation = this.map.queryTerrainElevation(this.layerOption.center) || 0
    const sceneOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(
      this.layerOption.center,
      offsetFromCenterElevation
    )
    const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2)

    const scale = sceneOriginMercator.meterInMercatorCoordinateUnits()

    const m = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix)
    const l = new THREE.Matrix4()
      .makeTranslation(sceneOriginMercator.x, sceneOriginMercator.y, sceneOriginMercator.z)
      .scale(new THREE.Vector3(scale, -scale, scale))
      .multiply(rotationX)

    this.camera.projectionMatrix = m.multiply(l)
    this.renderer.resetState()
    this.threeTick()
    this.map.triggerRepaint()
  }
}

/**
 * 简单模型动画管理器
 */
class AnimationMixerUpdater {
  private mixer: THREE.AnimationMixer
  private animateClip: { clip: THREE.AnimationClip; action: THREE.AnimationAction }[] = []
  constructor(gltfModel: IGltfLoaderResult) {
    this.mixer = new THREE.AnimationMixer(gltfModel.scene)
    gltfModel.animations.forEach((clip) => {
      const action = this.mixer.clipAction(clip)
      action.play()
      this.animateClip.push({ clip, action })
    })
  }
  public update(dt: number) {
    if (!this.mixer) return this
    this.mixer.update(dt)
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
