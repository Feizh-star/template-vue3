import type { Ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { KMZLoader } from 'three/addons/loaders/KMZLoader.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { createGradient, hexToRgb, rgbNormalized } from '@/utils/colorGradient'

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
    scene.background = new THREE.Color(0x1a212e) // 设置场景背景颜色

    // 创建环境光
    const ambient = new THREE.AmbientLight(0xffffff, 3)
    scene.add(ambient)

    camera = new THREE.PerspectiveCamera(25, canvas.width / canvas.height, 0.1, 1000)

    camera.position.x = 100
    camera.position.y = 100
    camera.position.z = 100

    scene.add(camera)

    const axesHelper = new THREE.AxesHelper(50)
    scene.add(axesHelper)

    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(
      canvas.width / window.devicePixelRatio,
      canvas.height / window.devicePixelRatio
    )

    new THREE.TextureLoader().load(
      new URL('../assets/sprite.png', import.meta.url).href,
      (loadTexture) => {
        const material = new THREE.SpriteMaterial({ map: loadTexture })
        const sWidth = material.map.image.width
        const sHeight = material.map.image.height
        const sprite = new THREE.Sprite(material)
        sprite.center.set(0.5, 0.5)
        sprite.scale.set(sWidth / 8, sHeight / 8, 1)
        sprite.position.set(-0.3, 1, 3)
        scene.add(sprite)
      }
    )

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

    const positions = [
      [30, 0, 30],
      [-30, 0, 30],
      [-30, 0, -30],
      [30, 0, -30],
      [30, 0, 30],
    ]
    const points = positions.map((item) => new THREE.Vector3(...item))

    const trackLine = new LineGeometry()
    trackLine.setPositions(positions.flat())

    const trackLineMaterial = new LineMaterial({
      color: 0x53ffc1,
      linewidth: 2, // in world units with size attenuation, pixels otherwise
      //resolution:  // to be set by renderer, eventually
      dashed: false,
      alphaToCoverage: true,
    })
    const line = new Line2(trackLine, trackLineMaterial)
    line.computeLineDistances()
    line.scale.set(1, 1, 1)
    scene.add(line)

    const flowingLine = addFlowingLine(scene, points)

    function animate() {
      // 一定要在此函数中调用
      if (flowingLine) flowingLine.update()
      trackLineMaterial.resolution.set(canvas.width, canvas.height)
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
  const curvePath = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 0; i < points.length - 1; i++) {
    const singleLine = new THREE.LineCurve3(points[i], points[i + 1])
    curvePath.add(singleLine)
  }
  const linePoints = curvePath.getSpacedPoints(1000) // 将曲线细分出更多的的点
  linePoints.unshift(...new Array(50).fill(linePoints[0]))

  // 生成那道拖尾的光flowingLine
  const flowingLineGeometry = new THREE.BufferGeometry()
  const flowingLineLength = 50 // 那道拖尾的光的长度（即占用了轨迹线上多少个点）
  let lineIndex = 0 // 拖尾的光从轨迹线的第一个点位开始流动

  let flowingLinePoints = linePoints.slice(lineIndex, lineIndex + flowingLineLength) // 拖尾的光对应的那段轨迹线

  const flowingLineCurve = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 0; i < flowingLinePoints.length - 1; i++) {
    const singleLine = new THREE.LineCurve3(points[i], points[i + 1])
    flowingLineCurve.add(singleLine)
  }
  flowingLinePoints = flowingLineCurve.getSpacedPoints(100) // 将拖尾的光它自己的曲线细分出更多的点方便后续设置一个个点串联成拖尾的光线

  flowingLineGeometry.setFromPoints(flowingLinePoints)
  const scale1 = []
  for (let i = 0; i < flowingLinePoints.length; i++) {
    const sle = (i + 1) / flowingLinePoints.length
    scale1.push(sle > 0.8 ? 1 : sle)
  }
  flowingLineGeometry.attributes.scale1 = new THREE.BufferAttribute(new Float32Array(scale1), 1) // 使拖尾的光串联的点呈现大小比例的变化从而形成拖尾效果
  const flowingLineMaterial = new THREE.PointsMaterial({
    // color: 0xfff000,
    vertexColors: true, // 使用顶点颜色
    size: 2,
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

  // 为每一个顶点设置颜色
  const colorGradient = createGradient([
    { color: '#53ffc1', percent: 0 },
    { color: '#53ffc1', percent: 0.85 },
    { color: '#ffffff', percent: 1 },
  ])
  const colors: number[] = []
  const count = flowingLineGeometry.getAttribute('position').count
  for (let i = 0; i < count; i++) {
    const percent = i / count //点索引值相对所有点数量的百分比
    //根据顶点位置顺序大小设置颜色渐变
    const c = colorGradient.getColor(percent) //颜色插值计算
    const rgbColor = rgbNormalized(hexToRgb(c))
    colors.push(rgbColor[0], rgbColor[1], rgbColor[2])
  }
  flowingLineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

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
      const newFlowingLineCurve = new THREE.CurvePath<THREE.Vector3>()
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
      flowingLine.geometry.computeBoundingSphere()
    },
  }
}
