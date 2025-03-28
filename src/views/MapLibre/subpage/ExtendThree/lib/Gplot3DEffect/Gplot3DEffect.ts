import * as THREE from 'three'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import * as lodashLib from 'lodash'
import { FlowLine3DEffect } from './FlowLine3DEffect'
import { AnimationMixerUpdater } from './AnimationMixerUpdater'
import { AnimationInitiator } from './AnimationInitiator'
import {
  loadGltfModel,
  mapChildrenToModel,
  updateMousePosition,
  disposeModel,
  disposeSprite,
  registerNodeEventHelper,
  recordOutEventToInnerHelper,
  removeNodeEventHelper,
  throttle,
  loadFont,
  createDomSizeObserver,
} from '../tools/gplot3DTool'
import { filterAttrbuteByKeys } from '../tools/common'

const defaultOption: IGplot3DEffectOption = {
  animation: {
    enable: true,
  },
  axesHelper: {
    enable: false,
    size: 10,
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
}

export function hexString2Number(hex: string) {
  return parseInt(hex.replace('#', ''), 16)
}

/**
 * 3D特效基类
 */
export abstract class Gplot3DEffect {
  constructor(effectOption?: DeepPartial<IGplot3DEffectOption>) {
    this.devicePixelRatio = window.devicePixelRatio
    this.effectOption = lodashLib.merge(
      lodashLib.cloneDeep(defaultOption),
      filterAttrbuteByKeys(effectOption || {}, Object.keys(defaultOption))
    )
  }
  /**
   * 抽象属性和方法
   */
  protected abstract initScene(): void
  protected abstract initCamera(): void
  public abstract startEffect(): void
  public abstract stopEffect(): void
  /**
   * 自有属性和方法
   */
  protected scene!: THREE.Scene
  protected camera!: THREE.Camera
  protected renderer!: THREE.WebGLRenderer
  protected canvasEffect!: HTMLCanvasElement
  private resizeObserver!: ResizeObserver
  private devicePixelRatio: number
  private effectOption: IGplot3DEffectOption

  /**
   * 初始化，由派生类调用
   * @param canvas 画布
   */
  protected initEffect(canvas: HTMLCanvasElement) {
    this.canvasEffect = canvas
    this.initScene() // 场景
    this.initCamera() // 相机
    this.setLight() // 灯光
    this.setAxesHelper() // 辅助坐标系
    this.initRendererEffect() // 初始化渲染器
    this.registeResizeEffect() // 注册resize处理函数
    this.renderEffect() // 渲染场景（第一帧）
    this.initAnimationLoop() // 初始化动画管理器
  }
  /**
   * 初始化渲染器
   */
  protected initRendererEffect() {
    const canvas = this.canvasEffect
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
    })
    this.setRendererSizeEffect(canvas)
    this.renderer.autoClear = false
  }
  /**
   * 渲染场景
   */
  protected renderEffect() {
    if (!this.renderer || !this.scene || !this.camera) {
      throw new Error('Missing render, scene or camera!')
    }
    this.renderer.render(this.scene, this.camera)
  }
  /**
   * 销毁特效
   */
  public destoryEffect() {
    this.removeLight()
    this.removeAxesHelper()
    this.removeFlowLines()
    this.removeSpriteNodes()
    this.removeGltfNodes()
    this.removeAllRails()
    this.removeAllMouseEvent()
    this.clearFont()
    this.cancelResizeEffect()
  }

  /* 尺寸变化，更新three的dpr和尺寸 */
  protected setRendererSizeEffect(canvas: HTMLCanvasElement) {
    if (window.devicePixelRatio !== this.devicePixelRatio) {
      this.devicePixelRatio = window.devicePixelRatio
      this.renderer.setPixelRatio(this.devicePixelRatio)
      this.updateSubObjectDPR()
    }
    this.renderer.setSize(canvas.width, canvas.height)
  }
  protected registeResizeEffect() {
    const canvas = this.canvasEffect
    this.resizeObserver = createDomSizeObserver(canvas, () => {
      this.setRendererSizeEffect(canvas)
    })
  }
  private cancelResizeEffect() {
    if (this.resizeObserver) this.resizeObserver.disconnect()
  }
  // 更新子级对象的DPR
  private updateSubObjectDPR() {
    this.flowLines.forEach((item) => {
      item.resizeLine(this.devicePixelRatio)
    })
    this.resizeRails(this.devicePixelRatio)
  }

  /**
   * 处理动画帧
   */
  protected animationInitiator!: AnimationInitiator
  private initAnimationLoop() {
    this.animationInitiator = new AnimationInitiator(this.effectOption.animation.enable)
  }
  // 每一帧时调用
  public tickEffect() {
    this.animationInitiator?.animationInitiatorTick((delta) => {
      this.updateSubObjectFrame(delta)
    })
  }
  // 需要在每一帧更新的内容
  private updateSubObjectFrame(delta: number) {
    this.flowLines.forEach((item) => {
      item.effectRun(delta)
    })
    this.gltfNodes.forEach((item) => {
      this.gltfNodesAnimationMixer.get(item)?.update(delta)
    })
    this.renderEffect()
  }

  // 坐标系
  protected axesHelper: THREE.AxesHelper | null = null
  public setAxesHelper(effectOption?: Partial<IGplot3DEffectOption['axesHelper']>) {
    if (!this.scene) throw new Error('Attempt to add AxesHelper before scene inited')
    if (effectOption) {
      this.effectOption.axesHelper = lodashLib.mergeWith(
        lodashLib.cloneDeep(this.effectOption.axesHelper),
        effectOption
      )
    }
    const axesHelperOption = this.effectOption.axesHelper
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
  private removeAxesHelper() {
    const axesHelper = this.axesHelper
    if (axesHelper?.id && this.scene.getObjectById(axesHelper.id)) this.scene.remove(axesHelper)
  }

  // 灯光
  protected ambientLight: THREE.AmbientLight | null = null
  protected directionalLight: THREE.DirectionalLight | null = null
  public setLight(
    effectOption?: Partial<Pick<IGplot3DEffectOption, 'ambientLight' | 'directionalLight'>>
  ) {
    if (!this.scene) throw new Error('Attempt to init Light before scene inited')
    if (effectOption?.ambientLight) {
      this.effectOption.ambientLight = lodashLib.mergeWith(
        lodashLib.cloneDeep(this.effectOption.ambientLight),
        effectOption.ambientLight
      )
    }
    if (effectOption?.directionalLight) {
      this.effectOption.directionalLight = lodashLib.mergeWith(
        lodashLib.cloneDeep(this.effectOption.directionalLight),
        effectOption.directionalLight
      )
    }
    const { ambientLight: ambientOpt, directionalLight: directionalOpt } = this.effectOption
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
        if (this.scene.getObjectById(directionalLight.target.id)) {
          this.scene.remove(directionalLight.target)
        }
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
  private removeLight() {
    const directionalLight = this.directionalLight
    if (directionalLight?.id && this.scene.getObjectById(directionalLight.id))
      this.scene.remove(directionalLight)
    const ambientLight = this.ambientLight
    if (ambientLight?.id && this.scene.getObjectById(ambientLight.id))
      this.scene.remove(ambientLight)
  }

  /* 添加字体文件 */
  protected fontMap = new Map<string, any>()
  public addFont(name: string, url: string) {
    return loadFont(url).then((font) => {
      this.fontMap.set(name, font)
    })
  }
  protected clearFont() {
    this.fontMap.clear()
  }
  protected setText(origin: number[], effectOption: DeepPartial<ITextOption>) {
    const font = this.fontMap.get(effectOption.font || '')
    if (!font) {
      console.warn(`No font named ${effectOption.font} found`)
      return []
    }
    if (!effectOption.content) return []
    const contentSplit = (effectOption.content as string).split('\n')
    const textMeshList: THREE.Mesh[] = []
    for (const [l, text] of contentSplit.entries()) {
      const geometry = new TextGeometry(text, {
        font: font,
        size: effectOption.geometry?.size || 0.3, // 字体大小
        depth: effectOption.geometry?.depth || 0, // 挤出文本的厚度
      })
      geometry.computeBoundingBox()

      if (effectOption.center) geometry.center() // 居中文本
      const materials = new THREE.MeshBasicMaterial({
        color: hexString2Number(effectOption.material?.color || '#ffffff'),
        transparent: effectOption.material?.transparent ?? true,
        opacity: effectOption.material?.opacity || 1,
      })
      const textMesh = new THREE.Mesh(geometry, materials)
      // 位置，旋转，缩放
      const lineHeight = (geometry.boundingBox.max.y - geometry.boundingBox.min.y) * 1.2
      const lineYOffset = [0, ((contentSplit.length - 1) * 0.5 - l) * lineHeight, 0]
      const rotation = new Array(3)
        .fill(0)
        .map((v, i) => effectOption.rotation?.[i] || v) as number[]
      const scale = new Array(3).fill(1).map((v, i) => effectOption.scale?.[i] || v) as number[]
      const position = [...origin].map(
        (v, i) =>
          v + (effectOption.position?.[i] || 0) + (effectOption.offset?.[i] || 0) + lineYOffset[i]
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
  protected raycaster: THREE.Raycaster = new THREE.Raycaster()
  protected mousePosition: THREE.Vector2 = new THREE.Vector2()
  protected mouseEvents: Map<string, ((event: Event, intersects: THREE.Intersection[]) => void)[]> =
    new Map()
  protected mouseEventHandlerMap = new WeakMap<
    Function,
    ReturnType<typeof registerNodeEventHelper>
  >()
  protected mouseEventCommonHandlerMap: Map<string, Function> = new Map()
  protected registerMouseEvent(
    eventType: string,
    handler: (event: Event, intersects: THREE.Intersection[]) => void
  ) {
    const handlers = this.mouseEvents.get(eventType)
    if (handlers && handlers.length > 0) {
      handlers.push(handler)
      this.mouseEvents.set(eventType, handlers)
    } else {
      const commonHandler = throttle((event: Event) => {
        const { mousePosition: mouse, canvasEffect: canvas } = this
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
      this.canvasEffect?.addEventListener(eventType, commonHandler)
      this.mouseEvents.set(eventType, [handler])
      this.mouseEventCommonHandlerMap.set(eventType, commonHandler)
    }
  }
  protected removeMouseEvent(
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
  protected removeNoHandlerMouseEvent() {
    ;[...this.mouseEvents.entries()]
      .filter((item) => item[1].length === 0)
      .map((item) => item[0])
      .forEach((eventType) => {
        this.removeMouseEvent(eventType)
      })
  }
  protected removeAllMouseEvent() {
    this.mouseEvents.clear()
    for (const [eventType, handler] of this.mouseEventCommonHandlerMap.entries()) {
      this.canvasEffect?.removeEventListener(eventType, handler as (e: Event) => void)
    }
  }

  /**
   * 管理线
   */
  protected flowLines: FlowLine3DEffect[] = []
  protected flowLinesMap: WeakMap<FlowLine3DEffect, IFlowLineItem> = new WeakMap()
  public addFlowLines(lineData: IFlowLineItem[]) {
    if (!this.scene || !this.canvasEffect) return this
    this.flowLines = lineData.map((l) => {
      if (l.id && this.getFlowLineById(l.id)) {
        this.removeFlowLineById(l.id) // 如果此id已存在，则销毁重建
      }
      const flowLine = new FlowLine3DEffect({
        ...l,
        canvas: this.canvasEffect,
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
      console.warn(`The instance of FlowLine3DEffect whose id is ${id} does not exist`)
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
  protected railLine: Line2[] = []
  protected railLineTextMap: Map<Line2, THREE.Mesh[]> = new Map()
  protected railLineDataMap: WeakMap<Line2, IRailItem> = new WeakMap()
  /* 当devicePixelRatio变化时更新line2的宽度 */
  protected resizeRails(dpr: number) {
    this.railLine.forEach((item) => {
      const railLineOpt = this.railLineDataMap.get(item)
      if (railLineOpt) {
        ;(item.material as LineMaterial).linewidth =
          (railLineOpt.lineMaterial?.linewidth ?? 1) / dpr
      }
    })
  }
  public addRails(rails: IRailItem[]) {
    if (!this.scene || !this.canvasEffect) return this
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
      trackLineMaterial.resolution.set(this.canvasEffect.width, this.canvasEffect.width)

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
  protected spriteNodes: THREE.Sprite[] = []
  protected spriteNodesMap: WeakMap<THREE.Sprite, DeepPartial<ISpriteNodeItem>> = new WeakMap()
  protected spriteNodesTextMap: Map<THREE.Sprite, THREE.Mesh[]> = new Map()
  protected spriteNodesEventMap = new Map<string, ReturnType<typeof registerNodeEventHelper>[]>()
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
  protected gltfNodes: IGltfLoaderResult[] = []
  protected gltfNodesMap: WeakMap<IGltfLoaderResult, DeepPartial<IGltfNodeItem>> = new WeakMap()
  protected gltfNodesTextMap: Map<IGltfLoaderResult, THREE.Mesh[]> = new Map()
  protected gltfNodesEventMap = new Map<string, ReturnType<typeof registerNodeEventHelper>[]>()
  protected childrenModelMap: WeakMap<Object, IGltfLoaderResult> = new WeakMap()
  protected gltfNodesAnimationMixer: WeakMap<IGltfLoaderResult, AnimationMixerUpdater> =
    new WeakMap() // 可根据模型数据查找动画控制器
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
      (intersects) => {
        return intersects
          .map((item) => this.childrenModelMap.get(item.object))
          .filter((item) => item) as IGltfLoaderResult[]
      },
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
}
