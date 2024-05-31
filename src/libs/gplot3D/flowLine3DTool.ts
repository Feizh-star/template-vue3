import * as THREE from 'three'
import { createGradient, hexToRgb, rgbNormalized } from './colorGradient'

// 对点进行插值，使线更加平滑
export function getTweenPoint(points: THREE.Vector3[], magnification = 1) {
  const curvePath = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 0; i < points.length - 1; i++) {
    curvePath.add(new THREE.LineCurve3(points[i], points[i + 1]))
  }
  return curvePath.getSpacedPoints(points.length * Math.round(magnification))
}

// 更新几何体的位置
export function updatePositions(
  geometry: THREE.BufferGeometry<THREE.NormalBufferAttributes>,
  points: THREE.Vector3[],
  index: number,
  length: number
) {
  const flowingLinePointsTween = getTweenPoint(points.slice(index, index + length), 2)
  geometry.setFromPoints(flowingLinePointsTween)
  return flowingLinePointsTween
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

// 设置特效的缩放
export function setFlowPointScale(
  geometry: THREE.BufferGeometry<THREE.NormalBufferAttributes>,
  flowPoints: THREE.Vector3[],
  attrName: string,
  scale: (index: number, length: number) => number
) {
  const scaleValue = []
  for (let i = 0; i < flowPoints.length; i++) {
    const sle = scale(i, flowPoints.length)
    scaleValue.push(sle)
  }
  // 使拖尾的光串联的点呈现大小比例的变化从而形成拖尾效果
  geometry.attributes[attrName] = new THREE.BufferAttribute(new Float32Array(scaleValue), 1)
}

// 将纯色变成渐变色，并反向成为适合geometry使用的颜色（由于尾部是特效的第一个点，相当于头部）
export function handleColorStop(color: string, colorStop: { color: string; percent: number }[]) {
  let stops: { color: string; percent: number }[] = []
  if (colorStop && colorStop.length > 0) {
    stops = [...colorStop].reverse()
  } else {
    stops = [
      { color: color, percent: 0 },
      { color: color, percent: 1 },
    ]
  }
  return stops.map((item, index, arr) => {
    let p = Math.abs(arr[index].percent)
    p = p > 1 ? p % 1 : p
    return {
      ...item,
      percent: 1 - p,
    }
  })
}
