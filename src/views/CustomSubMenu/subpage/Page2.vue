<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import * as lodashLib from 'lodash'

const container = ref<HTMLElement | null>(null)

const renderer = shallowRef<any>()
const scene = shallowRef<any>()
const camera = shallowRef<any>()
const observer = shallowRef<any>()

onMounted(() => {
  createWorld()
  drawLine2Ins()
})
onBeforeUnmount(() => {
  renderer.value?.setAnimationLoop(null)
  observer.value?.disconnect()
})

function render() {
  if (!renderer.value || !scene.value || !camera.value) {
    throw new Error('Missing render, scene or camera!')
  }
  renderer.value.render(scene.value, camera.value)
}
function handleResize() {
  if (!container.value) return
  if (!camera.value) return
  const width = container.value?.clientWidth
  const height = container.value?.clientHeight
  camera.value.aspect = width / height
  camera.value.updateProjectionMatrix()
  // renderer.value.setPixelRatio(devicePixelRatio)
  renderer.value.setSize(width, height)
}
function createWorld() {
  if (!container.value) return
  const canvas = document.createElement('canvas')
  canvas.width = container.value?.clientWidth || 200
  canvas.height = container.value?.clientHeight || 200
  container.value.appendChild(canvas)

  scene.value = new THREE.Scene()
  scene.value.background = new THREE.Color(0x333333)

  const ambientLight = new THREE.AmbientLight(0xffffff, 2)
  scene.value.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 4)
  directionalLight.position.set(200, 300, -200)
  scene.value.add(directionalLight)

  const gridHelper = new THREE.GridHelper(
    200,
    10,
    0xaaaaaa,
    0x666666,
  )
  scene.value.add(gridHelper)


  camera.value = new THREE.PerspectiveCamera(
    75,
    canvas.width / canvas.height,
    0.25,
    10000
  )
  camera.value.position.x = 21.73072717684386
  camera.value.position.y = 30.433737039778144
  camera.value.position.z = 36.90751078349861
  scene.value.add(camera.value)

  renderer.value = new THREE.WebGLRenderer({ antialias: true, canvas: canvas })
  renderer.value.setPixelRatio(devicePixelRatio)
  renderer.value.setSize(canvas.width, canvas.height)

  const controls = new OrbitControls(camera.value, canvas)
  controls.addEventListener('change', () => {
    render()
  })
  controls.update()

  renderer.value.setAnimationLoop(() => {
    render()
  })

  observer.value = createDomSizeObserver(container.value, () => {
    handleResize()
  })
}

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

function drawLine2Ins() {
  const geometry = new LineGeometry()
  geometry.setPositions([0, 10, 0, 0, 0, 0, 10, 0, 0])
  const material = new LineMaterial()
  ;(material.color as THREE.Color).setHex(0x00ff00)
  material.linewidth = 4 / devicePixelRatio
  console.log(devicePixelRatio, material.linewidth)

  const line = new Line2(geometry, material)
  line.computeLineDistances()
  scene.value.add(line)

  const circleGeometry = new THREE.CircleGeometry( 5, 32 );
  const circleMaterial = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
  const circle = new THREE.Mesh( circleGeometry, circleMaterial );
  scene.value.add( circle );
}
</script>

<template>
  <div class="custom-page2">
    <div class="container" ref="container"></div>
  </div>
</template>

<style scoped lang="less">
.custom-page2 {
  width: 100%;
  height: 100%;
  .container {
    width: 100%;
    height: 100%;
  }
}
</style>
