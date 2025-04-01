import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import * as lodashLib from 'lodash'
import { Gplot3DEffect, hexString2Number } from '../Gplot3DEffect/Gplot3DEffect'
import { filterAttrbuteByKeys } from '../tools/common'
import { setCanvasSize } from '../tools/gplot3DTool'

interface IGplot3DLayerOption extends IGplot3DEffectOption {
  el: HTMLElement
  scene: {
    backgroundColor: string
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
    initialTarget: { x: number; y: number; z: number }
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
type IGplot3DOption = Omit<IGplot3DLayerOption, keyof IGplot3DEffectOption>

const defaultOption: IGplot3DOption = {
  el: document.body,
  scene: {
    backgroundColor: '#000000',
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
    initialTarget: { x: 0, y: 0, z: 0 },
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

export class Gplot3D extends Gplot3DEffect {
  protected option: IGplot3DOption
  constructor(option?: DeepPartial<IGplot3DLayerOption>) {
    super(option as any)
    this.option = lodashLib.mergeWith(
      lodashLib.cloneDeep(defaultOption),
      filterAttrbuteByKeys(option || {}, Object.keys(defaultOption))
    )
    this.createCanvas()
  }

  /**
   * 实现抽象类的抽象属性/方法
   */
  protected initScene() {
    const { scene: sceneOpt } = this.option
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(hexString2Number(sceneOpt.backgroundColor))
    this.scene = scene
  }
  protected initCamera() {
    const { camera: cameraOpt } = this.option
    const camera = new THREE.PerspectiveCamera(
      cameraOpt.viewAngle,
      this.canvasEffect.width / this.canvasEffect.height,
      cameraOpt.near,
      cameraOpt.far
    )
    camera.position.x = cameraOpt.initialPosition.x
    camera.position.y = cameraOpt.initialPosition.y
    camera.position.z = cameraOpt.initialPosition.z
    this.camera = camera
  }
  public startEffect() {
    this.animationInitiator.startAnimationInitiator(() => {
      this.renderer.setAnimationLoop(() => {
        this.tickEffect()
      })
    })
  }
  public stopEffect() {
    this.animationInitiator.stopAnimationInitiator(() => {
      this.renderer.setAnimationLoop(null)
    })
  }
  private createCanvas() {
    const { el } = this.option
    const canvas = document.createElement('canvas')
    setCanvasSize(el, canvas)
    Array.prototype.forEach.call(el.children, (child) => el.removeChild(child))
    el.appendChild(canvas)
    this.initEffect(canvas)
    this.initOrbitControls()
    this.startEffect()
  }
  /* 初始化轨道 */
  private initOrbitControls() {
    const canvas = this.canvasEffect
    if (!canvas) return
    const camera = this.camera
    const { controls: controlsOpt } = this.option
    const controls = new OrbitControls(camera, canvas)
    const { x: tx, y: ty, z: tz } = controlsOpt.initialTarget
    controls.enablePan = controlsOpt.enablePan
    controls.enableRotate = controlsOpt.enableRotate
    controls.enableZoom = controlsOpt.enableZoom
    controls.mouseButtons = controlsOpt.mouseButtons
    controls.target = new THREE.Vector3(tx, ty, tz)
    controls.addEventListener('change', () => {
      this.renderEffect()
    })
    controls.update()
  }
  /**
   * 图层生命周期：移除自定义图层时调用
   */
  destory() {
    this.destoryEffect()
  }
}
