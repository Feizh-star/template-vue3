import type { Ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { KMZLoader } from 'three/addons/loaders/KMZLoader.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { createGradient, hexToRgb, rgbNormalized } from '@/utils/colorGradient'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
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

    // const axesHelper = new THREE.AxesHelper(50)
    // scene.add(axesHelper)

    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(
      canvas.width / window.devicePixelRatio,
      canvas.height / window.devicePixelRatio
    )

    // new THREE.TextureLoader().load(
    //   new URL('../assets/sprite.png', import.meta.url).href,
    //   (loadTexture) => {
    //     const material = new THREE.SpriteMaterial({ map: loadTexture })
    //     const sWidth = material.map.image.width
    //     const sHeight = material.map.image.height
    //     const sprite = new THREE.Sprite(material)
    //     sprite.center.set(0.5, 0.5)
    //     sprite.scale.set(sWidth / 8, sHeight / 8, 1)
    //     sprite.position.set(-0.3, 1, 3)
    //     scene.add(sprite)
    //   }
    // )
    // const map = new THREE.TextureLoader().load(
    //   new URL('../assets/sprite.png', import.meta.url).href
    // )
    // const material = new THREE.SpriteMaterial({ map: map })
    // const sprite = new THREE.Sprite(material)
    // sprite.center.set(0.5, 0.5)
    // sprite.scale.set(15, 15, 15)
    // sprite.position.set(-0.3, 1, 3)
    // scene.add(sprite)
    // console.log(sprite)

    let mixer: THREE.AnimationMixer | null = null
    let previousTime = 0
    const modelMap: any = new WeakMap()
    const clock = new THREE.Clock()
    const loader = new GLTFLoader()
    loader.load(
      new URL('../assets/smol_ame_in_an_upcycled_terrarium_hololiveen.glb', import.meta.url).href,
      function (gltf) {
        console.log(gltf)
        gltf.scene.scale.set(5, 5, 5)
        gltf.scene.rotation.set(0, 0, 0)
        scene.add(gltf.scene)
        // modelObj = gltf.scene
        const mapChildrenToModel = (model: any, arr: any[], childMap: WeakMap<any, any>) => {
          for (const item of arr) {
            childMap.set(item, model)
            if (item.children) {
              mapChildrenToModel(model, item.children, childMap)
            }
          }
        }
        modelMap.set(gltf.scene, gltf)
        mapChildrenToModel(gltf, gltf.scene.children, modelMap)

        mixer = new THREE.AnimationMixer(gltf.scene)
        const action = mixer.clipAction(gltf.animations[0])
        action.play()
      },
      undefined,
      function (error) {
        console.error(error)
      }
    )

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    canvas.addEventListener('click', onMouseMove, false)
    function onMouseMove(event) {
      // 更新鼠标位置
      mouse.x = ((event.clientX - canvas.getBoundingClientRect().left) / canvas.clientWidth) * 2 - 1
      mouse.y =
        -((event.clientY - canvas.getBoundingClientRect().top) / canvas.clientHeight) * 2 + 1
      // 将鼠标位置转换为世界坐标
      raycaster.setFromCamera(mouse, camera)

      // 计算物体和鼠标的交点
      const intersects = raycaster.intersectObjects(scene.children)
      const models = intersects.map((item) => modelMap.get(item.object)).filter((item) => item)
      const model = [...new Set(models)]
      console.log(model)
    }

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
    const positions1: [number, number, number][] = [
      [15, 0, 15],
      [15, 0, -15],
      [-15, 0, -15],
      [-15, 0, 15],
      [15, 0, 15],
    ]

    const color = ['#53ffc1', '#ff5600']
    const lines = [
      {
        id: 2,
        path: positions,
        lineMaterial: { color: color[0] },
        effect: {
          enable: true,
          size: 2.5,
          colorStop: [
            { color: '#ffffffff', percent: 0 },
            { color: `${color[0]}ff`, percent: 0.15 },
            { color: `${color[0]}80`, percent: 0.4 },
            { color: `${color[0]}00`, percent: 1 },
          ],
        },
      },
      {
        id: 5,
        path: positions1,
        lineMaterial: { color: color[1] },
        effect: {
          enable: true,
          size: 2.5,
          colorStop: [
            { color: '#ffffffff', percent: 0 },
            { color: `${color[1]}ff`, percent: 0.15 },
            { color: `${color[1]}80`, percent: 0.4 },
            { color: `${color[1]}00`, percent: 1 },
          ],
        },
      },
    ]
    const effectLines = lines.map((item) => new FlowLine3D({ ...item, canvas }).addTo(scene))
    console.log(effectLines)
    // setTimeout(() => {
    //   trackLine.setEffect({
    //     enable: true,
    //   })
    // }, 3000)

    function animate() {
      // 一定要在此函数中调用
      effectLines.forEach((item) => {
        item.effectRun()
      })
      const elapsedTime = clock.getElapsedTime()
      const deltaTime = elapsedTime - previousTime
      previousTime = elapsedTime
      // update mixer
      if (mixer) {
        mixer.update(deltaTime)
      }
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
