
/* 判断点的维度相等：全二维返回2，全三维返回3，其他返回-1 */
export function getPointDimensionality(line: number[][]) {
  if (line.length === 0) return -1
  const firstLength = line[0].length
  if (!new Set([2, 3]).has(firstLength)) return -1
  return line.every(p => p.length === firstLength) ? firstLength : -1
}

/* 计算两个向量的差向量 */
export function vectorDiff(a: number[], b: number[]) {
  const dimen = getPointDimensionality([a, b])
  if (dimen === -1) {
    throw new Error('两个向量维度不统一！')
  }
  return a.map((num, pi) => num - b[pi])
}
export function getVectorByPoint(a: number[], b: number[]) {
  return vectorDiff(b, a)
}

/* 计算两个向量的和向量 */
export function vectorSum(a: number[], b: number[]) {
  const dimen = getPointDimensionality([a, b])
  if (dimen === -1) {
    throw new Error('两个向量维度不统一！')
  }
  return b.map((num, pi) => num + a[pi])
}

/* 计算点A到点B的单位向量 */
export function unitVector(a: number[], b: number[]) {
  const dimen = getPointDimensionality([a, b])
  if (dimen === -1) {
    throw new Error('两个点维度不统一！')
  }
  const vector = new Array(dimen).fill(0).map((item, index) => b[index] - a[index])
  const module = Math.sqrt(vector.reduce((c, v) => c + Math.pow(v, 2), 0))
  if (module <= Number.EPSILON) {
    return new Array(dimen).fill(0) // 模几乎为0，认为两个点在同一个位置
  }
  return vector.map(di => di / module)
}

/* 计算两个三维向量的向量积（叉积） */
export function vectorProduct(a: number[], b: number[]) {
  a = new Array(3).fill(0).map((num, pi) => a[pi] || num)
  b = new Array(3).fill(0).map((num, pi) => b[pi] || num)
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

/* 计算向量乘以一个数 */
export function vectorScale(a: number[], s: number) {
  return a.map(num => num * s)
}

/* 计算两个向量角平分线上朝内角一侧的向量 */
export function radialVectorTool(points: number[][]) {
  const baUnit = unitVector(points[1], points[0])
  const bcUnit = unitVector(points[1], points[2])
  const sum = vectorSum(baUnit, bcUnit)
  return sum
}

/* 计算两个向量的夹角的余弦值 */
export function cosOfVectors(v1: number[], v2: number[]) {
  const dimen = getPointDimensionality([v1, v2])
  if (dimen === -1) {
    throw new Error('两个向量维度不统一！')
  }
  const dotProduct = v1.map((num, pi) => num * v2[pi]).reduce((c, v) => c + v)
  const baModule = Math.sqrt(v1.reduce((c, v) => c + Math.pow(v, 2), 0))
  const bcModule = Math.sqrt(v2.reduce((c, v) => c + Math.pow(v, 2), 0))
  const module = baModule * bcModule
  if (module === 0) {
    throw new Error('至少一个向量模为0！')
  }
  return dotProduct / (baModule * bcModule)
}

/* 计算两个向量的夹角的半角sin值 */
export function halfSin(v1: number[], v2: number[]) {
  const cosVal = cosOfVectors(v1, v2)
  const halfSinVal = Math.sqrt((1 - cosVal) / 2) // 可以直接取正，原角在0-360度，它的半角就在0-180度，正弦值必然为非负，且互补的角正弦值相等
  return halfSinVal
}

/* 是否为零向量 */
export function isZeroVector(v: number[]) {
  return v.every(n => Math.abs(n) <= Number.EPSILON)
}

/* 计算线上的一个点和 与它相邻最近的不在一条直线上的点 组成的平面的法向量 */
export function straightTool(point: number[], prev: number[][], next: number[][], dimensionality: number) {
  let prevPointer = prev.length - 1
  let nextPointer = 0
  let result = new Array(dimensionality).fill(0)
  while(1) {
    const prevVector = getVectorByPoint(prev[prevPointer], point)
    const nextVector = getVectorByPoint(point, next[nextPointer])
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
