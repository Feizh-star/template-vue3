import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { decompressGZipFont } from './pickCharacter/pickCharacter'

let gLTFLoaderObject: any = null
export function loadGltfModel<T>(
  modelSrc: string,
  process?: (xhr: XMLHttpRequest) => void
): Promise<T> {
  if (!gLTFLoaderObject) {
    gLTFLoaderObject = new GLTFLoader()
  }
  return new Promise((resolve, reject) => {
    gLTFLoaderObject.load(
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

let fontLoaderObject: any = null
/* 加载字体 */
export function loadFont(url: string, process?: (xhr: XMLHttpRequest) => void) {
  if (!fontLoaderObject) {
    fontLoaderObject = new FontLoader()
  }
  return new Promise((resolve, reject) => {
    if (url.endsWith('.json')) {
      fontLoaderObject.load(
        url,
        function (font: any) {
          resolve(font)
        },
        process,
        (error: any) => {
          reject(error)
        }
      )
    } else {
      decompressGZipFont(url)
        .then((json) => {
          resolve(fontLoaderObject.parse(json))
        })
        .catch((error) => {
          reject(error)
        })
    }
  })
}
