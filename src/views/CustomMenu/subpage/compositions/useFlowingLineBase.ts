import type { Ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { KMZLoader } from 'three/addons/loaders/KMZLoader.js'

export function useSquare({ el }: { el: Ref<HTMLCanvasElement | null> }) {
  let camera, scene, renderer

  onMounted(() => {
    init()
  })

  function init() {
    const canvas = el.value
    if (!canvas) return
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    // 创建场景
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x999999) // 设置场景背景颜色

    // 创建平行光源
    const light = new THREE.DirectionalLight(0xffffff, 3)
    light.position.set(0.5, 1.0, 0.5).normalize()

    scene.add(light)

    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambient)

    camera = new THREE.PerspectiveCamera(35, canvas.width / canvas.height, 1, 500)

    camera.position.x = 25
    camera.position.y = 20
    camera.position.z = 25

    scene.add(camera)

    const grid = new THREE.GridHelper(50, 50, 0xffffff, 0x7b7b7b)
    scene.add(grid)

    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(
      canvas.width / window.devicePixelRatio,
      canvas.height / window.devicePixelRatio
    )

    const loader = new KMZLoader()
    loader.load(new URL('../assets/Box.kmz', import.meta.url).href, function (kmz) {
      kmz.scene.position.y = 0.5
      scene.add(kmz.scene)
      render()
    })

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = true
    controls.enableRotate = true
    controls.enableZoom = true
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    }
    controls.addEventListener('change', render)
    controls.update()

    const points = [
      new THREE.Vector3(10, 0, 10),
      new THREE.Vector3(-10, 0, 10),
      new THREE.Vector3(-10, 0, -10),
      new THREE.Vector3(10, 0, -10),
      new THREE.Vector3(10, 0, 10),
    ]

    const trackLine = new THREE.BufferGeometry()
    trackLine.setFromPoints(points)
    const trackLineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff })
    const line = new THREE.Line(trackLine, trackLineMaterial)
    scene.add(line)

    const flowingLine = addFlowingLine(scene, points)

    function animate() {
      // 一定要在此函数中调用
      if (flowingLine) flowingLine.update()
      render()
      requestAnimationFrame(animate)
    }
    animate()

    window.addEventListener('resize', onWindowResize)
  }

  function onWindowResize() {
    const canvas = el.value
    if (!canvas) return
    canvas.width = canvas.parentElement.clientWidth - 32
    canvas.height = canvas.parentElement.clientHeight - 32
    console.log(window.devicePixelRatio)
    camera.aspect = canvas.width / canvas.height
    camera.updateProjectionMatrix()

    renderer.setSize(canvas.width, canvas.height)

    render()
  }

  function render() {
    renderer.render(scene, camera)
  }
}
function addFlowingLine(scene: THREE.Scene, points: THREE.Vector3[]) {
  // 生成轨迹线line
  const curvePath = new THREE.CurvePath()
  for (let i = 0; i < points.length - 1; i++) {
    const singleLine = new THREE.LineCurve3(points[i], points[i + 1])
    curvePath.add(singleLine)
  }
  const linePoints = curvePath.getSpacedPoints(1000) // 将曲线细分出更多的的点

  // 生成那道拖尾的光flowingLine
  const flowingLineGeometry = new THREE.BufferGeometry()
  const flowingLineLength = 50 // 那道拖尾的光的长度（即占用了轨迹线上多少个点）
  let lineIndex = 0 // 拖尾的光从轨迹线的第一个点位开始流动

  let flowingLinePoints = linePoints.slice(lineIndex, lineIndex + flowingLineLength) // 拖尾的光对应的那段轨迹线

  const flowingLineCurve = new THREE.CurvePath()
  for (let i = 0; i < flowingLinePoints.length - 1; i++) {
    const singleLine = new THREE.LineCurve3(points[i], points[i + 1])
    flowingLineCurve.add(singleLine)
  }
  flowingLinePoints = flowingLineCurve.getSpacedPoints(100) // 将拖尾的光它自己的曲线细分出更多的点方便后续设置一个个点串联成拖尾的光线

  flowingLineGeometry.setFromPoints(flowingLinePoints)
  const scale1 = []
  for (let i = 0; i < flowingLinePoints.length; i++) {
    scale1.push((i + 1) / flowingLinePoints.length)
  }
  flowingLineGeometry.attributes.scale1 = new THREE.BufferAttribute(new Float32Array(scale1), 1) // 使拖尾的光串联的点呈现大小比例的变化从而形成拖尾效果
  const flowingLineMaterial = new THREE.PointsMaterial({
    color: 0xfff000,
    size: 0.5,
  })
  flowingLineMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        `
      attribute float scale1;
      void main() {
      `
      )
      .replace(
        'gl_PointSize = size;',
        `
      gl_PointSize = size * scale1;
      `
      )
  }
  const flowingLine = new THREE.Points(flowingLineGeometry, flowingLineMaterial)
  scene.add(flowingLine)

  return {
    update: () => {
      // 每隔一段时间不断在轨迹线上向前取线段从而生成拖尾的光对应的一个个点位
      if (lineIndex > linePoints.length - flowingLineLength) {
        lineIndex = 0
      }
      lineIndex += 1
      const newFlowingLinePoints = linePoints.slice(lineIndex, lineIndex + flowingLineLength)

      const newFlowingLineCurve = new THREE.CurvePath()
      for (let i = 0; i < newFlowingLinePoints.length - 1; i++) {
        const singleLine = new THREE.LineCurve3(
          newFlowingLinePoints[i],
          newFlowingLinePoints[i + 1]
        )
        newFlowingLineCurve.add(singleLine)
      }
      const flowingLinePointsTween = newFlowingLineCurve.getSpacedPoints(100)

      // 为拖尾的光设置新的点位从而实现流动效果
      flowingLine.geometry.setFromPoints(flowingLinePointsTween)
    },
  }
}
