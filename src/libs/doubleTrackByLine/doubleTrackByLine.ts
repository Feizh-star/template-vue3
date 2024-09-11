import {
  getPointDimensionality,
  vectorDiff,
  getVectorByPoint,
  vectorSum,
  unitVector,
  vectorProduct,
  vectorScale,
  radialVectorTool,
  cosOfVectors,
  halfSin,
  isZeroVector,
  straightTool,
} from './tools/vector'

/*
  根据平面上的一条线（一系列点），得到两条轨道
*/
export interface IDoubleTrackByLineOption {
  distance: number | ((trackIndex: 1 | 2, index: number, point: number[], line: number[][]) => number),
  straightNormal?: number[]
}
export function doubleTrackByLine(line: number[][], { distance, straightNormal }: IDoubleTrackByLineOption) {
  if (straightNormal && straightNormal.length !== 3) {
    throw new Error('平面法向量必须为三维向量！')
  }
  line = removeRepeatPointTool(line)
  if (line.length < 2) {
    throw new Error('线至少需要两个（不重叠的）点！')
  }
  const dimen = getPointDimensionality(line)
  if (dimen === -1) {
    throw new Error('线上的点维度不统一！')
  }
  if (dimen === 2) {
    line = line.map(item => [...item, 0])
  }
  const length = line.length
  const track1: number[][] = []
  const track2: number[][] = []
  const lineWithBothSize = [
    vectorDiff(line[0], vectorDiff(line[1], line[0])),
    ...line,
    vectorSum(line[length - 1], vectorDiff(line[length - 1], line[length - 2])),
  ]
  let isStraight = false
  let pIndex = 0
  while (pIndex < line.length) {
    const currentPoint = line[pIndex] // 在lineWithBothSize中，当前点的索引是pIndex + 1
    const bspIndex = pIndex + 1
    // 计算当前点和 与它相邻最近的不在一条直线上的点 组成的平面的法向量，考虑头尾补上的点
    const currentPointStraightInFull = straightTool(currentPoint, lineWithBothSize.slice(0, bspIndex), lineWithBothSize.slice(bspIndex + 1, lineWithBothSize.length), dimen)
    // 如果这条线是直线，那第一个点在整条线上的法向量就会是零向量，直接结束循环，后面处理直线的情况
    if (isZeroVector(currentPointStraightInFull)) {
      isStraight = true
      break
    }
    if (!straightNormal) {
      straightNormal = unitVector([0, 0, 0], currentPointStraightInFull)
    }
    // 计算当前点相邻两个向量的法向量
    const currentPointStraight = vectorProduct(getVectorByPoint(currentPoint, lineWithBothSize[pIndex]), getVectorByPoint(currentPoint, lineWithBothSize[bspIndex + 1]))
    let radialVector: number[] = [] // 径向向量
    let halfSinValue: number = 1
    if (isZeroVector(currentPointStraight)) {
      // 相邻三点成一条直线的情况，0或180度或360度
      radialVector = vectorProduct(getVectorByPoint(currentPoint, lineWithBothSize[bspIndex + 1]), straightNormal)
    } else {
      // 相邻三点成一个夹角的情况，不是0或180度或360度
      // 计算 折线所在平面的法向量 与 当前相邻两个向量的叉积 的夹角cos值
      const cosVal = cosOfVectors(straightNormal, currentPointStraightInFull)
      // 拐角的内角平分线向量
      const angularBisector = radialVectorTool(lineWithBothSize.slice(bspIndex - 1, bspIndex + 2))
      // 折线所在平面的法向量 与 当前相邻两个向量的叉积 的夹角cos值：大于0，逆时针拐点，小于0，顺时针拐点
      const dirFlag = cosVal > 0 ? -1 : 1
      radialVector = angularBisector.map(num => num * dirFlag)
      // 计算半角正弦
      halfSinValue = halfSin(getVectorByPoint(currentPoint, lineWithBothSize[pIndex]), getVectorByPoint(currentPoint, lineWithBothSize[bspIndex + 1]))
    }
    const unitRadialVector = unitVector([0, 0, 0], radialVector) // 单位径向向量
    const radialVectorModule1 = distanceIsNumber(distance) ? distance / halfSinValue : distance(1, pIndex, currentPoint, line) // 径向向量的模
    const radialVectorModule2 = distanceIsNumber(distance) ? distance / halfSinValue : distance(2, pIndex, currentPoint, line) // 径向向量的模
    track1.push(vectorSum(currentPoint, vectorScale(unitRadialVector, radialVectorModule1)))
    track2.push(vectorDiff(currentPoint, vectorScale(unitRadialVector, radialVectorModule2)))
    pIndex++
  }
  if (isStraight) {
    if (!straightNormal) {
      throw new Error('当前折线是一条直线，但是缺少它所处平面的法向量')
    }
    const unitStraight = unitVector([0, 0, 0], straightNormal)
    const unitRadialVector = unitVector([0, 0, 0], vectorProduct(getVectorByPoint(line[0], line[1]), unitStraight))
    for (let i = 1; i < lineWithBothSize.length - 1; i++) {
      const d1 = distanceIsNumber(distance) ? distance : distance(1, i - 1, line[i - 1], line)
      const d2 = distanceIsNumber(distance) ? distance : distance(2, i - 1, line[i - 1], line)
      track1.push(vectorSum(lineWithBothSize[i], vectorScale(unitRadialVector, d1)))
      track2.push(vectorDiff(lineWithBothSize[i], vectorScale(unitRadialVector, d2)))
    }
  }
  return {
    track1,
    track2
  }
}

/* 去掉重叠的点 */
function removeRepeatPointTool(l: number[][]) {
  let unique = l[0]
  const result: number[][] = [unique]
  for (let i = 1; i < l.length; i++) {
    if (l[i].every((num, pi) => Math.abs(num - unique[pi]) <= Number.EPSILON)) {
      continue
    }
    unique = l[i]
    result.push(unique)
  }
  return result
}

/* 区分距离参数是否为number */
function distanceIsNumber(dis: IDoubleTrackByLineOption['distance']): dis is number {
  return typeof dis === 'number'
}
