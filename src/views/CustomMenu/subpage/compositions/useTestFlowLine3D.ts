import type { Ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { KMZLoader } from 'three/addons/loaders/KMZLoader.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { createGradient, hexToRgb, rgbNormalized } from '@/utils/colorGradient'
import { FlowLine3D } from './flowLine3D'

export function useTestFlowLine3D({ el }: { el: Ref<HTMLCanvasElement | null> }) {
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

    const positions: [number, number, number][] = [
      [30, 0, 30],
      [-30, 0, 30],
      [-30, 0, -30],
      [30, 0, -30],
      [30, 0, 30],
    ]
    const points = positions.map((item) => new THREE.Vector3(...item))

    const trackLine = new FlowLine3D({ path: positions }).addTo(scene)

    // setTimeout(() => {
    //   trackLine.destory()
    // }, 3000)

    const flowingLine = addFlowingLine(scene, points)

    function animate() {
      // 一定要在此函数中调用
      if (flowingLine) flowingLine.update()
      trackLine.lineMaterial?.resolution.set(canvas.width, canvas.height)
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
  // 插值轨迹线line
  const linePoints = getTweenPoint(points, 200) // 将曲线细分出更多的的点
  linePoints.unshift(...new Array(50).fill(linePoints[0]))

  const scaleAttrName = 'scale1'
  const flowingLineLength = 50 // 那道拖尾的光的长度（即占用了轨迹线上多少个点）
  let lineIndex = 0 // 拖尾的光从轨迹线的第一个点位开始流动

  const flowingLineGeometry = new THREE.BufferGeometry()
  // 更新/初始化几何体的位置
  const flowingLinePoints = updatePositions(
    flowingLineGeometry,
    linePoints,
    lineIndex,
    flowingLineLength
  )
  // 为每一个点设置缩放
  setFlowPointScale(flowingLineGeometry, flowingLinePoints, scaleAttrName)
  // 为每一个顶点设置颜色
  setGeometryColor(flowingLineGeometry, [
    { color: '#53ffc100', percent: 0 },
    { color: '#53ffc180', percent: 0.6 },
    { color: '#53ffc1ff', percent: 0.85 },
    { color: '#ffffffff', percent: 1 },
  ])

  const flowingLineMaterial = new THREE.PointsMaterial({
    // color: 0xfff000,
    vertexColors: true, // 使用顶点颜色
    transparent: true, // 开启透明
    size: 2.5,
  })
  flowingLineMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        `
          attribute float ${scaleAttrName};
          void main() {
        `
      )
      .replace(
        'gl_PointSize = size;',
        `
          gl_PointSize = size * ${scaleAttrName};
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

      // 为拖尾的光设置新的点位从而实现流动效果
      updatePositions(flowingLine.geometry, linePoints, lineIndex, flowingLineLength)

      flowingLine.geometry.computeBoundingSphere()
    },
  }
}

function getTweenPoint(points: THREE.Vector3[], magnification = 1) {
  const curvePath = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 0; i < points.length - 1; i++) {
    const singleLine = new THREE.LineCurve3(points[i], points[i + 1])
    curvePath.add(singleLine)
  }
  return curvePath.getSpacedPoints(points.length * Math.round(magnification))
}

function updatePositions(
  geometry: THREE.BufferGeometry<THREE.NormalBufferAttributes>,
  points: THREE.Vector3[],
  index: number,
  length: number
) {
  const newFlowingLinePoints = points.slice(index, index + length)
  const flowingLinePointsTween = getTweenPoint(newFlowingLinePoints, 2)
  geometry.setFromPoints(flowingLinePointsTween)
  return flowingLinePointsTween
}

function setGeometryColor(
  geometry: THREE.BufferGeometry<THREE.NormalBufferAttributes>,
  colorStop: { color: string; percent: number }[]
) {
  const colorGradient = createGradient(colorStop)
  const colors: number[] = []
  const count = geometry.getAttribute('position').count
  let colorLength = 0
  for (let i = 0; i < count; i++) {
    const percent = i / count //点索引值相对所有点数量的百分比
    //根据顶点位置顺序大小设置颜色渐变
    const c = colorGradient.getColor(percent) //颜色插值计算
    const rgbColor = rgbNormalized(hexToRgb(c))
    if (colorLength === 0) colorLength = rgbColor.length
    colors.push(...rgbColor)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, colorLength))
}

function setFlowPointScale(
  geometry: THREE.BufferGeometry<THREE.NormalBufferAttributes>,
  flowPoints: THREE.Vector3[],
  attrName: string
) {
  const scaleValue = []
  for (let i = 0; i < flowPoints.length; i++) {
    const sle = (i + 1) / flowPoints.length
    scaleValue.push(sle)
  }
  // 使拖尾的光串联的点呈现大小比例的变化从而形成拖尾效果
  geometry.attributes[attrName] = new THREE.BufferAttribute(new Float32Array(scaleValue), 1)
}
