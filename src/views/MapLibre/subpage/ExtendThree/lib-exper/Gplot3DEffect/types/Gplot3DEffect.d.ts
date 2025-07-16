import * as THREE from 'three'

declare global {
  const THREE: typeof import('three')

  // gltfLoader 加载器返回的数据类型
  interface IGltfLoaderResult {
    animations: Array<THREE.AnimationClip>
    scene: THREE.Group
    scenes: Array<THREE.Group>
    cameras: Array<THREE.Camera>
    asset: Object
  }

  interface IGplot3DEffectOption {
    animation: {
      enable: boolean
    }
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

  type IFlowLineItem = IFlowLine3DEffectOption & { common: Record<string, any> }
  interface ITextOption {
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
  interface ISpriteNodeItem {
    common: Record<string, any>
    src: string
    center: number[]
    scale: number[]
    position: number[]
    offset: number[]
    text: ITextOption
  }
  interface IGltfNodeItem {
    common: Record<string, any>
    src: string
    rotation: number[]
    scale: number[]
    position: [number, number, number]
    offset: [number, number, number]
    text: ITextOption
  }
  type IRailItem = DeepPartial<
    Omit<IFlowLineItem, 'effect' | 'id' | 'canvas' | 'line'> & {
      text: ITextOption
      relative: number
    }
  >
}
