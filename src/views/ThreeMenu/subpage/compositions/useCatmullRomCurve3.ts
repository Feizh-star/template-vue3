import type { Ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { KMZLoader } from 'three/addons/loaders/KMZLoader.js'

export function useCatmullRomCurve3({ el }: { el: Ref<HTMLCanvasElement | null> }) {
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

    camera = new THREE.PerspectiveCamera(35, canvas.width / canvas.height, 1, 500)

    camera.position.x = 10
    camera.position.y = 8
    camera.position.z = 10

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

    const texture = new THREE.TextureLoader().load(
      new URL('../assets/line.png', import.meta.url).href
    )
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping //每个都重复
    texture.repeat.set(1, 1)
    texture.needsUpdate = true

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
    })

    const points = [
      new THREE.Vector3(3, 0, 3),
      new THREE.Vector3(-3, 0, 3),
      new THREE.Vector3(-3, 0, -3),
      new THREE.Vector3(3, 0, -3),
      new THREE.Vector3(3, 0, 3),
    ]
    //创建曲线路径
    const curvePath = new THREE.CurvePath<THREE.Vector3>()

    for (let i = 0; i < points.length - 1; i++) {
      const singleLine = new THREE.LineCurve3(points[i], points[i + 1])
      curvePath.add(singleLine)
    }

    // 创建管道
    const tubeGeometry = new THREE.TubeGeometry(curvePath, 80, 0.1, 8, false)

    const mesh = new THREE.Mesh(tubeGeometry, material)

    scene.add(mesh)
    function animate() {
      // 一定要在此函数中调用
      if (texture) texture.offset.x -= 0.01
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
