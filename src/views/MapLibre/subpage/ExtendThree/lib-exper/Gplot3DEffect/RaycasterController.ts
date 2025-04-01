import * as THREE from 'three'

interface IRaycasterControllerOption {
  manualUpdate?: boolean
  canvas: HTMLCanvasElement
  camera: THREE.Camera
  scene: THREE.Scene
}

/**
 * 射线拾取事件控制器
 */
export class RaycasterController {
  // 射线的原点是否要直接使用相机（setFromCamera），threejs中要，maplibre中不要
  private manualUpdate: boolean
  private canvas: HTMLCanvasElement
  private camera: THREE.Camera
  private scene: THREE.Scene
  protected raycaster: THREE.Raycaster = new THREE.Raycaster()
  protected mousePosition: THREE.Vector2 = new THREE.Vector2()
  protected mouseEvents: Map<string, ((event: Event, intersects: THREE.Intersection[]) => void)[]> =
    new Map()
  protected mouseEventCommonHandlerMap: Map<string, Function> = new Map()
  public mouseEventHandlerMap = new WeakMap<Function, ReturnType<typeof registerNodeEventHelper>>()

  constructor(option: IRaycasterControllerOption) {
    if (!option?.canvas) throw new Error('RaycasterController need canvas element')
    if (!option?.scene) throw new Error('RaycasterController need scene')
    if (!option?.camera) throw new Error('RaycasterController need camera')
    this.canvas = option.canvas
    this.camera = option.camera
    this.scene = option.scene
    this.manualUpdate = option.manualUpdate || false
  }

  public registerMouseEvent(
    eventType: string,
    handler: (event: Event, intersects: THREE.Intersection[]) => void
  ) {
    const handlers = this.mouseEvents.get(eventType)
    if (handlers && handlers.length > 0) {
      handlers.push(handler)
      this.mouseEvents.set(eventType, handlers)
    } else {
      const commonHandler = throttle((event: Event) => {
        const { mousePosition: mouse, canvas } = this
        // 更新鼠标位置（xy平面，标准化设备坐标）
        updateMousePosition(mouse, event, canvas)
        // 直接利用Camera更新射线的原点和方向，看似跟下方手动步骤重复，但去掉这里会导致Line2报错
        this.raycaster.setFromCamera(mouse, this.camera)
        // 地图上需要手动更新射线的原点和方向
        if (this.manualUpdate) {
          const camInverseProjection = this.camera.projectionMatrix.invert()
          const cameraPosition = new THREE.Vector3().applyMatrix4(camInverseProjection)
          const mousePosition = new THREE.Vector3(mouse.x, mouse.y, 1).applyMatrix4(
            camInverseProjection
          )
          const viewDirection = mousePosition.clone().sub(cameraPosition).normalize()
          this.raycaster.set(cameraPosition, viewDirection)
        }
        // 计算物体和鼠标的交点
        const intersects = this.raycaster.intersectObjects(this.scene.children)
        const eventHanlders = this.mouseEvents.get(eventType)
        eventHanlders?.forEach((handler) => {
          handler(event, intersects)
        })
      }, 16.7)
      this.canvas?.addEventListener(eventType, commonHandler)
      this.mouseEvents.set(eventType, [handler])
      this.mouseEventCommonHandlerMap.set(eventType, commonHandler)
    }
  }
  public removeMouseEvent(
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
  public removeNoHandlerMouseEvent() {
    ;[...this.mouseEvents.entries()]
      .filter((item) => item[1].length === 0)
      .map((item) => item[0])
      .forEach((eventType) => {
        this.removeMouseEvent(eventType)
      })
  }
  public removeAllMouseEvent() {
    for (const [eventType, handler] of this.mouseEventCommonHandlerMap.entries()) {
      this.canvas?.removeEventListener(eventType, handler as (e: Event) => void)
    }
    this.mouseEventCommonHandlerMap.clear()
    this.mouseEvents.clear()
  }
}

// 精灵图和模型注册帮助函数
export function registerNodeEventHelper<T extends object, K>(
  type: string,
  eventType: string,
  handler: (type: string, event: Event, model: T[], data: K[]) => void,
  register: (
    eventType: string,
    handler: (event: Event, intersects: THREE.Intersection[]) => void
  ) => void,
  picker: (intersects: THREE.Intersection[]) => T[],
  nodeToData: Map<T, K> | WeakMap<T, K>
) {
  let oldModelGroup: T[] = []
  let judgementCondition: (newVal: T[], oldVal: T[]) => boolean
  let trueEventType: string
  switch (eventType) {
    case 'mouseenter':
      trueEventType = 'mousemove'
      judgementCondition = (newVal, oldVal) => newVal.length > 0 && oldVal.length === 0
      break
    case 'mouseleave':
      trueEventType = 'mousemove'
      judgementCondition = (newVal, oldVal) => oldVal.length > 0 && newVal.length === 0
      break
    default:
      trueEventType = eventType
      judgementCondition = (newVal) => newVal.length > 0
      break
  }
  const trueHandler = (mevent: Event, intersects: THREE.Intersection[]) => {
    const models = picker(intersects)
    const modelGroup = [...new Set(models)]
    if (judgementCondition(modelGroup, oldModelGroup)) {
      let outResult: T[] = []
      switch (eventType) {
        case 'mouseleave':
          outResult = oldModelGroup
          break
        default:
          outResult = modelGroup
      }
      handler(
        type,
        mevent,
        outResult,
        outResult.map((item) => nodeToData.get(item)).filter((item) => item) as K[]
      )
    }
    oldModelGroup = modelGroup
  }
  register(trueEventType, trueHandler)
  return {
    name: trueEventType,
    callback: trueHandler,
  }
}

// 帮助记录外部事件到内部事件的映射关系，方便外界可以删除指定的事件
export function recordOutEventToInnerHelper(
  eventType: string,
  handler: Function,
  eInfo: ReturnType<typeof registerNodeEventHelper>,
  eventMap: Map<string, ReturnType<typeof registerNodeEventHelper>[]>,
  eventHandlerMap: WeakMap<Function, ReturnType<typeof registerNodeEventHelper>>
) {
  const eventInfos = eventMap.get(eventType)
  if (eventInfos && eventInfos.length > 0) {
    eventInfos.push(eInfo)
    eventMap.set(eventType, eventInfos)
  } else {
    eventMap.set(eventType, [eInfo])
  }
  eventHandlerMap.set(handler, eInfo)
}

export function removeNodeEventHelper(
  eventType: string,
  eventMap: Map<string, ReturnType<typeof registerNodeEventHelper>[]>,
  eventHandlerMap: WeakMap<Function, ReturnType<typeof registerNodeEventHelper>>,
  removeMouseEvent: (
    eventType: string,
    handler: (
      event: Event,
      intersects: THREE.Intersection<THREE.Object3D<THREE.Object3DEventMap>>[]
    ) => void
  ) => void,
  handler?: Function
) {
  if (handler) {
    const eInfo = eventHandlerMap.get(handler)
    if (!eInfo) return
    removeMouseEvent(eInfo.name, eInfo.callback)
    const eList = eventMap.get(eventType)
    if (eList) {
      eventMap.set(
        eventType,
        eList.filter((item) => item === eInfo)
      )
    }
  } else {
    const eList = eventMap.get(eventType)
    eList?.forEach((item) => {
      removeMouseEvent(item.name, item.callback)
    })
  }
}

/* 更新鼠标位置 */
export function updateMousePosition(mouse: THREE.Vector2, event: Event, canvas: HTMLCanvasElement) {
  const mevent = event as MouseEvent
  const canvasRect = canvas.getBoundingClientRect()
  mouse.x = ((mevent.clientX - canvasRect.left) / canvasRect.width) * 2 - 1
  mouse.y = -((mevent.clientY - canvasRect.top) / canvasRect.height) * 2 + 1
}

/**
 * @desc 简单函数节流
 * @param func 回调函数
 * @param limit 时间限制
 */
export function throttle<T extends (...args: any[]) => void>(func: T, wait: number) {
  //上次执行时间
  let previous = 0
  return function (this: any, ...args: Parameters<T>) {
    //当前时间
    const now = performance ? performance.now() : Date.now()
    // 若当前时间-上次执行时间大于时间限制
    if (previous === 0 || now - previous >= wait) {
      func.apply(this, args)
      previous = now
    }
  }
}
