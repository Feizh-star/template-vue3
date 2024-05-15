import type { Ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { KMZLoader } from 'three/addons/loaders/KMZLoader.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { createGradient, hexToRgb, rgbNormalized } from '@/utils/colorGradient'

export function useTestPoints({ el }: { el: Ref<HTMLCanvasElement | null> }) {
  let camera, renderer

  onMounted(() => {
    init()
  })

  function init() {
    const canvas = el.value
    if (!canvas) return
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    // 创建一个场景
    const scene = new THREE.Scene()

    // 创建一个透视摄像机
    const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000)
    camera.position.x = 100
    camera.position.y = 100
    camera.position.z = 100

    // 创建一个 WebGL 渲染器
    const renderer = new THREE.WebGLRenderer({ canvas: canvas })
    renderer.setSize(canvas.width, canvas.height)

    const axesHelper = new THREE.AxesHelper(50)
    scene.add(axesHelper)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = true
    controls.enableRotate = true
    controls.enableZoom = true
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    }
    controls.addEventListener('change', () => {
      renderer.render(scene, camera)
    })
    controls.update()

    // 创建一个正方形路径的顶点数组
    const positions = [
      [30, 1, 30],
      [-30, 1, 30],
      [-30, 1, -30],
      [30, 1, -30],
    ]
    const pointss = positions.map((item) => new THREE.Vector3(...item))

    // 创建 BufferGeometry
    const geometry = new THREE.BufferGeometry().setFromPoints(pointss)

    // 创建 PointsMaterial 材质
    const material = new THREE.PointsMaterial({ color: 0xffffff })

    // 创建点
    const points = new THREE.Points(geometry, material)

    // 添加点到场景中
    scene.add(points)

    const flowingLine = addFlowingLine(
      scene,
      positions.map((item) => new THREE.Vector3(...item))
    )

    // 动画函数
    function animate() {
      requestAnimationFrame(animate)
      flowingLine.update()
      // points.rotation.y += 0.01 // 使点绕 z 轴旋转
      renderer.render(scene, camera)
    }

    animate()

    window.addEventListener('resize', onWindowResize)
  }

  function onWindowResize() {
    const canvas = el.value
    if (!canvas) return
    canvas.width = canvas.parentElement.clientWidth - 32
    canvas.height = canvas.parentElement.clientHeight - 32
    camera.aspect = canvas.width / canvas.height
    camera.updateProjectionMatrix()

    renderer.setSize(canvas.width, canvas.height)
  }
}

function addFlowingLine(scene: THREE.Scene, points: THREE.Vector3[]) {
  // 生成轨迹线line
  const curvePath = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 0; i < points.length - 1; i++) {
    const singleLine = new THREE.LineCurve3(points[i], points[i + 1])
    curvePath.add(singleLine)
  }
  const linePoints = curvePath.getSpacedPoints(2000) // 将曲线细分出更多的的点

  // 生成那道拖尾的光flowingLine
  const flowingLineGeometry = new THREE.BufferGeometry()
  const flowingLineLength = 2 // 那道拖尾的光的长度（即占用了轨迹线上多少个点）
  let lineIndex = 0 // 拖尾的光从轨迹线的第一个点位开始流动

  const flowingLinePoints = linePoints
    .slice(lineIndex, lineIndex + flowingLineLength)
    .map((item) => item.clone()) // 拖尾的光对应的那段轨迹线

  flowingLineGeometry.setFromPoints(flowingLinePoints)
  const flowingLineMaterial = new THREE.PointsMaterial({
    color: 0xfff000,
    size: 2,
  })

  const flowingLine = new THREE.Points(flowingLineGeometry, flowingLineMaterial)
  scene.add(flowingLine)

  return {
    update: () => {
      // 每隔一段时间不断在轨迹线上向前取线段从而生成拖尾的光对应的一个个点位
      if (lineIndex > linePoints.length - flowingLineLength) {
        lineIndex = 0
      }
      lineIndex += 1
      const newFlowingLinePoints = linePoints
        .slice(lineIndex, lineIndex + flowingLineLength)
        .map((item) => item.clone())
      // 为拖尾的光设置新的点位从而实现流动效果
      flowingLine.geometry.setFromPoints(newFlowingLinePoints)
      flowingLine.geometry.computeBoundingSphere()
    },
  }
}
