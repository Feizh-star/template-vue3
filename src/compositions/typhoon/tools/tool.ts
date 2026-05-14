// 台风路径颜色，参考中央台图例
export function getTyphoonColor(level: string) {
  let color
  switch (level) {
    case 'TD': //热带低压 6~7
      color = '#eed139'
      break
    case 'TS': //热带风暴 8~9
      color = '#0000ff'
      break
    case 'STS': //强热带风暴 10~11
      color = '#0f8000'
      break
    case 'TY': //台风 12~13
      color = '#fe9c45'
      break
    case 'STY': //强台风 14~15
      color = '#fe00fe'
      break
    case 'Super TY': // 14~15
      color = '#fe0000'
      break
    case '超强台风(Super TY)':
      color = '#fe0000'
      break
    default:
      color = '#000000'
      break
  }
  return {
    color,
    rgba: convertColorToRgba(color),
  }
}

const hexColorRegs = [/^[0-9a-fA-f]{3}$/, /^[0-9a-fA-f]{6}$/, /^[0-9a-fA-f]{8}$/]
export function convertColorToRgba(color: string): [number, number, number, number] {
  let hex = color.replace('#', '')
  if (!hexColorRegs.some((reg) => reg.test(hex))) {
    console.warn('颜色格式错误', color)
    return [0, 0, 0, 0]
  }
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }

  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255

  return [r, g, b, a]
}

interface IGetPointImage {
  radius: number
  strokeWidth: number
  fillColor: string
  borderColor: string
}
/**
 *
 * @param param0 IGetPointImage
 * @returns
 * @test
    const img = document.createElement('img')
    img.style.position = 'fixed'
    img.style.top = '50%'
    img.style.left = '50%'
    img.style.transform = 'translate(-50%, -50%)'
    const src = getPointImage({
      radius: 10,
      strokeWidth: 2,
      fillColor: '#0000ff',
      borderColor: '#ffffff',
    })
    img.src = src
    document.body.appendChild(img)
 */
export function getPointImage({ radius, strokeWidth, fillColor, borderColor }: IGetPointImage) {
  const canvas = document.createElement('canvas') as HTMLCanvasElement
  canvas.width = radius * 2
  canvas.height = radius * 2
  const cx = radius
  const cy = radius
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = borderColor
  ctx.fill()
  radius -= strokeWidth
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = fillColor
  ctx.fill()
  return canvas.toDataURL()
}

export function getTyphoonLevel(level: string) {
  let label
  switch (level) {
    case 'TD': //热带低压 6~7
      label = '热带低压'
      break
    case 'TS': //热带风暴 8~9
      label = '热带风暴'
      break
    case 'STS': //强热带风暴 10~11
      label = '强热带风暴'
      break
    case 'TY': //台风 12~13
      label = '台风'
      break
    case 'STY': //强台风 14~15
      label = '强台风'
      break
    case 'Super TY': // 14~15
      label = '超强台风'
      break
    case '超强台风(Super TY)':
      label = '超强台风'
      break
    default:
      label = ''
      break
  }
  return label
}

// 获取风向
export function getWindDirect(c?: number) {
  if (typeof c === 'undefined' || c > 9999) {
    return ['', '']
  }
  if (c < 11.25) {
    return ['N', '北']
  } else if (c < 33.75) {
    return ['NNE', '北东北']
  } else if (c < 56.25) {
    return ['NE', '东北']
  } else if (c < 78.75) {
    return ['ENE', '东东北']
  } else if (c < 101.25) {
    return ['E', '东']
  } else if (c < 123.75) {
    return ['ESE', '东东南']
  } else if (c < 146.25) {
    return ['SE', '东南']
  } else if (c < 168.25) {
    return ['SSE', '南东南']
  } else if (c < 191.25) {
    return ['S', '南']
  } else if (c < 213.75) {
    return ['SSW', '南西南']
  } else if (c < 236.25) {
    return ['SW', '西南']
  } else if (c < 258.75) {
    return ['WSW', '西西南']
  } else if (c < 281.25) {
    return ['W', '西']
  } else if (c < 303.75) {
    return ['WNW', '西西北']
  } else if (c < 326.25) {
    return ['NW', '西北']
  } else if (c < 348.75) {
    return ['NNW', '北西北']
  } else {
    return ['N', '北']
  }
}
