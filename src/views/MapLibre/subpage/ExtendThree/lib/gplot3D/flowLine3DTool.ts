import * as THREE from 'three'
import { createGradient, hexToRgb, rgbNormalized } from './colorGradient'

// 对点进行插值，使线更加平滑
export function getTweenPoint(points: THREE.Vector3[], targetCount: number) {
  const curvePath = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 0; i < points.length - 1; i++) {
    curvePath.add(new THREE.LineCurve3(points[i], points[i + 1]))
  }
  return curvePath.getSpacedPoints(Math.round(targetCount))
}

// 设置几何体中点的初始位置
export function setInitialPosition(
  geometry: THREE.BufferGeometry<THREE.NormalBufferAttributes>,
  point: THREE.Vector3,
  length: number
) {
  const startPosition = new Array(length).fill([point.x, point.y, point.z]).flat()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(startPosition), 3))
}
// 更新几何体的位置
export function updatePositions(
  geometry: THREE.BufferGeometry<THREE.NormalBufferAttributes>,
  points: THREE.Vector3[],
  index: number,
  length: number
) {
  // 更新拖尾的位置
  const positions = geometry.attributes.position.array
  for (let i = 0; i < length; i++) {
    const offset = (index + i) % points.length
    const lastIndex = length - i - 1
    positions[lastIndex * 3] = points[offset].x
    positions[lastIndex * 3 + 1] = points[offset].y
    positions[lastIndex * 3 + 2] = points[offset].z
  }
  geometry.attributes.position.needsUpdate = true
}

// 设置几何体的渐变色
export function setGeometryColor(
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

// 设置特效的顶点尺寸
export function getFlowPointScale(
  length: number,
  size: number,
  scale: (size: number, index: number, length: number) => number
) {
  const sizeArray: number[] = []
  for (let i = 0; i < length; i++) {
    sizeArray.push(scale(size, i, length))
  }
  return new THREE.BufferAttribute(new Float32Array(sizeArray), 1)
}

// 将纯色变成渐变色，并强制加上透明度
export function handleColorStop(color: string, colorStop: { color: string; percent: number }[]) {
  let stops: { color: string; percent: number }[] = []
  if (colorStop && colorStop.length > 0) {
    stops = [...colorStop]
  } else {
    stops = [
      { color: color, percent: 0 },
      { color: color, percent: 1 },
    ]
  }
  stops.forEach((item) => {
    if (/^#[0-9a-fA-F]{7}$/.test(item.color)) {
      item.color = `${item.color}ff`
    }
  })
  return stops
}
