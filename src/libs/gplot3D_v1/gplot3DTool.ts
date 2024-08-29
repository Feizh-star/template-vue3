import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'

export function loadGltfModel<T>(
  modelSrc: string,
  process?: (xhr: XMLHttpRequest) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      modelSrc,
      (gltf: T) => {
        resolve(gltf)
      },
      process,
      (error: any) => {
        reject(error)
      }
    )
  })
}
export function mapChildrenToModel(model: any, arr: any[], childMap: WeakMap<any, any>) {
  for (const item of arr) {
    childMap.set(item, model)
    if (item.children) {
      mapChildrenToModel(model, item.children, childMap)
    }
  }
}

/* 尺寸变化工具-1 */
export function createDomSizeObserver(
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
export function setCanvasSize(father: HTMLElement, child: HTMLCanvasElement) {
  const { width, height } = getElInnerSize(father)
  child.width = width
  child.height = height
  return { width, height }
}
/* 尺寸变化工具-3 */
export function getElInnerSize(el: HTMLElement) {
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

/* 更新鼠标位置 */
export function updateMousePosition(mouse: THREE.Vector2, event: Event, canvas: HTMLCanvasElement) {
  const mevent = event as MouseEvent
  mouse.x = ((mevent.clientX - canvas.getBoundingClientRect().left) / canvas.clientWidth) * 2 - 1
  mouse.y = -((mevent.clientY - canvas.getBoundingClientRect().top) / canvas.clientHeight) * 2 + 1
}

export function disposeModel(node: THREE.Object3D): void {
  if ((node as THREE.Mesh).geometry) {
    ;(node as THREE.Mesh).geometry.dispose()
  }

  if ((node as THREE.Mesh).material) {
    const material = (node as THREE.Mesh).material
    if (Array.isArray(material)) {
      // 如果材质是一个数组，则需要遍历释放每一个材质
      material.forEach((material) => disposeMaterial(material))
    } else {
      disposeMaterial(material)
    }
  }

  // 如果节点有子节点，递归调用disposeModel
  if (node.children) {
    for (let i = node.children.length - 1; i >= 0; i--) {
      disposeModel(node.children[i])
      node.remove(node.children[i])
    }
  }
}

// 类型保护函数，用于检查材质是否具有特定的纹理属性
function hasTextureProperty<T extends string>(
  material: THREE.Material,
  prop: T
): material is THREE.MeshStandardMaterial & { [key in T]: THREE.Texture } {
  return (material as any)[prop] instanceof THREE.Texture
}

export function disposeMaterial(material: THREE.Material): void {
  const textureProperties = [
    'map',
    'lightMap',
    'aoMap',
    'emissiveMap',
    'bumpMap',
    'normalMap',
    'displacementMap',
    'roughnessMap',
    'metalnessMap',
    'alphaMap',
    'envMap',
  ] as const

  textureProperties.forEach((prop) => {
    if (hasTextureProperty(material, prop)) {
      material[prop].dispose()
    }
  })

  material.dispose()
}

// 清理Sprite
export function disposeSprite(sprite: THREE.Sprite): void {
  if (sprite.material) {
    disposeMaterial(sprite.material)
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

/* 加载字体 */
export function loadFont(url: string, process?: (xhr: XMLHttpRequest) => void) {
  return new Promise((resolve, reject) => {
    new FontLoader().load(
      url,
      function (font: any) {
        resolve(font)
      },
      process,
      (error: any) => {
        reject(error)
      }
    )
  })
}
