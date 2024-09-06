/*
  !!!!!重要，需要考虑折线前进的方向，可以通过前进方向上的切向量和法向量来确定前进方向（方向向量），切向量可以通过bc - ba得到
  !!!!!切向量和法向量的向量积将永远朝向折线前进方向一侧，角平分线向量与这个向量方向相同时，夹角小于180度，否则夹角大于180度
  根据一条线（一系列点），得到两条轨道
*/
export function doubleTrackByLine(line: number[][], d: number, straightNormal: number[] = [0, 1, 0]) {
  line = removeRepeatPointTool(line)
  if (line.length < 2) {
    throw new Error('线至少需要两个（不重叠的）点！')
  }
  const dimen = getPointDimensionality(line)
  if (dimen === -1) {
    throw new Error('线上的点维度不统一！')
  }
  const length = line.length
  const track1: number[][] = []
  const track2: number[][] = []
  const lineWithBothSize = [
    vectorDiff(vectorDiff(line[0], line[1]), line[0]),
    ...line,
    vectorSum(line[length - 1], vectorDiff(line[length - 2], line[length - 1])),
  ]
  let isStraight = false
  let pIndex = 0
  while (pIndex < line.length) {
    const currentPoint = line[pIndex] // 在lineWithBothSize中，当前点的索引是pIndex + 1
    const bspIndex = pIndex + 1
    // 计算当前点在整条线上的法向量，考虑头尾补上的点
    const currentPointStraightInFull = straightTool(currentPoint, lineWithBothSize.slice(0, bspIndex), lineWithBothSize.slice(bspIndex + 1, lineWithBothSize.length), dimen)
    // 如果这条线是直线，那第一个点在整条线上的法向量就会是零向量，直接结束循环，后面处理直线的情况
    if (isZeroVector(currentPointStraightInFull)) {
      isStraight = true
      break
    }
    // 计算当前点相邻两个向量的法向量
    const currentPointStraight = vectorProduct(vectorDiff(currentPoint, lineWithBothSize[pIndex]), vectorDiff(currentPoint, lineWithBothSize[bspIndex + 1]))
    let radialVector: number[] = [] // 径向向量
    let radialVectorModule = 1 // 径向向量的模
    if (isZeroVector(currentPointStraight)) {
      // 相邻三点成一条直线的情况
      radialVector = vectorProduct(vectorDiff(currentPoint, lineWithBothSize[bspIndex + 1]), currentPointStraightInFull)
    } else {
      // 相邻三点成一个夹角的情况
      radialVector = radialVectorInside(lineWithBothSize.slice(bspIndex - 1, bspIndex + 2))
      // 需要根据距离计算径向向量的模

    }
    const unitRadialVector = unitVector([0, 0, 0], radialVector) // 单位径向向量
    track1.push(vectorSum(currentPoint, vectorScale(unitRadialVector, radialVectorModule)))
    track2.push(vectorDiff(currentPoint, vectorScale(unitRadialVector, radialVectorModule)))
    pIndex++
  }
  if (isStraight) {
    const unitStraight = unitVector([0, 0, 0], straightNormal)
    const unitRadialVector = unitVector([0, 0, 0], vectorProduct(vectorDiff(line[0], line[1]), unitStraight))
    for (let i = 1; i < lineWithBothSize.length - 1; i++) {
      track1.push(vectorSum(lineWithBothSize[i], vectorScale(unitRadialVector, d)))
      track2.push(vectorDiff(lineWithBothSize[i], vectorScale(unitRadialVector, d)))
    }
  }
  return {
    track1,
    track2
  }
}

/* 计算线上的一个点和 与它相邻最近的不在一条直线上的点 组成的平面的法向量 */
const isZeroVector = (v: number[]) => v.every(n => n < Number.EPSILON)
function straightTool(point: number[], prev: number[][], next: number[][], dimensionality: number) {
  let prevPointer = prev.length - 1
  let nextPointer = 0
  let result = new Array(dimensionality).fill(0)
  while(1) {
    const prevVector = vectorDiff(point, prev[prevPointer])
    const nextVector = vectorDiff(point, next[nextPointer])
    result = vectorProduct(prevVector, nextVector)
    if (!isZeroVector(result)) {
      break
    }
    if (nextPointer < next.length - 1) {
      nextPointer++
    } else if (prevPointer > 0) {
      prevPointer--
    } else {
      break
    }
  }
  return result
}
/* 去掉重叠的点 */
function removeRepeatPointTool(l: number[][]) {
  let unique = l[0]
  const result: number[][] = [unique]
  for (let i = 1; i < l.length; i++) {
    if (l[i].every((num, pi) => Math.abs(num - unique[pi]) < Number.EPSILON)) {
      continue
    }
    unique = l[i]
    result.push(unique)
  }
  return result
}

/* 判断点的维度相等：全二维返回2，全三维返回3，其他返回-1 */
function getPointDimensionality(line: number[][]) {
  if (line.length === 0) return -1
  const firstLength = line[0].length
  if (!new Set([2, 3]).has(firstLength)) return -1
  return line.every(p => p.length === firstLength) ? firstLength : -1
}

/* 计算两个向量的差向量 */
function vectorDiff(a: number[], b: number[]) {
  const dimen = getPointDimensionality([a, b])
  if (dimen === -1) {
    throw new Error('两个向量维度不统一！')
  }
  return b.map((num, pi) => num - a[pi])
}

/* 计算两个向量的和向量 */
function vectorSum(a: number[], b: number[]) {
  const dimen = getPointDimensionality([a, b])
  if (dimen === -1) {
    throw new Error('两个向量维度不统一！')
  }
  return b.map((num, pi) => num + a[pi])
}

/* 计算点A到点B的单位向量 */
function unitVector(a: number[], b: number[]) {
  const dimen = getPointDimensionality([a, b])
  if (dimen === -1) {
    throw new Error('两个点维度不统一！')
  }
  const vector = new Array(dimen).fill(0).map((item, index) => b[index] - a[index])
  const module = Math.sqrt(vector.reduce((c, v) => c + Math.pow(v, 2), 0))
  if (module < Number.EPSILON) {
    return new Array(dimen).fill(0) // 模几乎为0，认为两个点在同一个位置
  }
  return vector.map(di => di / module)
}

/* 计算两个三维向量的向量积（叉积） */
function vectorProduct(a: number[], b: number[]) {
  a = new Array(3).fill(0).map((num, pi) => a[pi] || num)
  b = new Array(3).fill(0).map((num, pi) => b[pi] || num)
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

/* 计算向量乘以一个数 */
function vectorScale(a: number[], s: number) {
  return a.map(num => num * s)
}

/* 计算两个向量角平分线上朝内侧的向量 */
function radialVectorInside(points: number[][]) {
  const baUnit = unitVector(points[1], points[0])
  const bcUnit = unitVector(points[1], points[2])
  const sum = vectorSum(baUnit, bcUnit)
  return sum
}

/* 计算两个向量的夹角 */
function degreeInVector(points: number[][]) {
  if (points.length !== 3) {
    throw new Error('需要三个点！')
  }
  const dimen = getPointDimensionality(points)
  if (dimen === -1) {
    throw new Error('三个点维度不统一！')
  }
  const ba = points[0].map((num, pi) => num - points[1][pi])
  const bc = points[2].map((num, pi) => num - points[1][pi])
  const dotProduct = ba.map((num, pi) => num * bc[pi]).reduce((c, v) => c + v)
  const baModule = Math.sqrt(ba.reduce((c, v) => c + Math.pow(v, 2), 0))
  const bcModule = Math.sqrt(bc.reduce((c, v) => c + Math.pow(v, 2), 0))
  const module = baModule * bcModule
  if (module === 0) {
    throw new Error('至少一个向量模为0！')
  }
  const cosVal = dotProduct / (baModule * bcModule)
  const sinVal = Math.sqrt(1 - Math.pow(cosVal, 2))
  // const halfCosVal = Math.sqrt((1 + cosVal) / 2)
  // const halfSinVal = Math.sqrt((1 - cosVal) / 2)
  return {
    sin: Math.sqrt(1 - Math.pow(cosVal, 2)),
    cos: cosVal
  }
}
/* 半角余弦 */
// const halfCos = (cos) => Math.acos(cos)
