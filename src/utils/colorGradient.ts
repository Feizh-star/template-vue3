export function createGradient(colors: { color: string; percent: number }[]) {
  if (colors.length < 2) {
    throw new Error('Colors there are at least two colors!')
  }
  if (
    !colors.every(
      (item) => /^#[0-9a-fA-F]+/.test(item.color) && new Set([7, 9]).has(item.color.length)
    )
  ) {
    throw new Error('Color value must be #xxxxxx or #xxxxxxxx!')
  }
  function getColor(percent: number) {
    if (percent <= 0) return colors[0].color
    if (percent >= 1) return colors[colors.length - 1].color

    let lowerIndex = 0
    let upperIndex = colors.length - 1

    for (let i = 0; i < colors.length - 1; i++) {
      if (percent >= colors[i].percent && percent <= colors[i + 1].percent) {
        lowerIndex = i
        upperIndex = i + 1
        break
      }
    }

    const lowerColor = colors[lowerIndex].color
    const upperColor = colors[upperIndex].color
    const lowerPercent = colors[lowerIndex].percent
    const upperPercent = colors[upperIndex].percent

    const result: string[] = []
    const percentInRange = (percent - lowerPercent) / (upperPercent - lowerPercent)
    const r = Math.round(
      parseInt(lowerColor.substring(1, 3), 16) * (1 - percentInRange) +
        parseInt(upperColor.substring(1, 3), 16) * percentInRange
    )
    result.push(`${r.toString(16).padStart(2, '0')}`)
    const g = Math.round(
      parseInt(lowerColor.substring(3, 5), 16) * (1 - percentInRange) +
        parseInt(upperColor.substring(3, 5), 16) * percentInRange
    )
    result.push(`${g.toString(16).padStart(2, '0')}`)
    const b = Math.round(
      parseInt(lowerColor.substring(5, 7), 16) * (1 - percentInRange) +
        parseInt(upperColor.substring(5, 7), 16) * percentInRange
    )
    result.push(`${b.toString(16).padStart(2, '0')}`)

    if (lowerColor.length === 9 || upperColor.length === 9) {
      const lowerColorA = lowerColor.length === 9 ? parseInt(lowerColor.substring(7, 9), 16) : 255
      const upperColorA = upperColor.length === 9 ? parseInt(upperColor.substring(7, 9), 16) : 255
      const a = Math.round(lowerColorA * (1 - percentInRange) + upperColorA * percentInRange)
      result.push(`${a.toString(16).padStart(2, '0')}`)
    }

    return `#${result.join('')}`
  }

  return {
    getColor,
  }
}

export function hexToRgb(hex: string) {
  if (!/^#[0-9a-fA-F]+/.test(hex) || !new Set([7, 9]).has(hex.length)) {
    throw new Error('Color value must be #xxxxxx or #xxxxxxxx!')
  }
  // 去除 # 号
  hex = hex.replace(/^#/, '')
  const result: number[] = []
  // 分别提取红、绿、蓝通道的值
  result.push(parseInt(hex.substring(0, 2), 16))
  result.push(parseInt(hex.substring(2, 4), 16))
  result.push(parseInt(hex.substring(4, 6), 16))
  if (hex.length === 9) {
    result.push(parseInt(hex.substring(7, 9), 16))
  }
  // 返回结果数组
  return result
}

export function rgbNormalized(rgba: number[], p = 2) {
  if (!new Set([3, 4]).has(rgba.length)) {
    throw new Error('Color value must be an array with 3 or 4 elements!')
  }
  if (!rgba.every((item) => item >= 0 && item <= 255 && item % 1 === 0)) {
    throw new Error('Rgba values should be integers between 0 and 255!')
  }
  const powValue = Math.pow(10, p)
  return rgba.map((item) => Math.round((item / 255) * powValue) / powValue)
}
