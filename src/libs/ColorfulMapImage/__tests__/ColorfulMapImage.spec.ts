import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type maplibregl from 'maplibre-gl'
import { ColorfulMapImage } from '../ColorfulMapImage'
import type { IColorfulMapImageOptions } from '../types'

const images: HTMLImageElement[] = []
const pixelReads: number[][] = []
const contexts = new WeakMap<HTMLCanvasElement, ReturnType<typeof createContext>>()

function createContext(canvas: HTMLCanvasElement) {
  let pixel = Number(canvas.dataset.pixel || 8)
  return {
    canvas,
    drawImage: vi.fn((source: HTMLImageElement | HTMLCanvasElement) => {
      pixel = Number(source.dataset.pixel || 8)
      canvas.dataset.pixel = String(pixel)
    }),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillRect: vi.fn(),
    fillStyle: '',
    getImageData: vi.fn((x: number, y: number) => {
      pixelReads.push([x, y, canvas.width, canvas.height])
      return { data: new Uint8ClampedArray([pixel, 0, 0, 0]) }
    }),
  }
}

function canvas(pixel = 8) {
  const source = document.createElement('canvas')
  source.width = source.height = 2
  source.dataset.pixel = String(pixel)
  return source
}

function load(image: HTMLImageElement, pixel = 16) {
  Object.defineProperties(image, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: 2 },
    naturalHeight: { configurable: true, value: 2 },
  })
  image.dataset.pixel = String(pixel)
  image.dispatchEvent(new Event('load'))
}

function createGL() {
  let unit = 0
  const bound = new Map<number, unknown>()
  const uploads: { unit: number; source: HTMLCanvasElement | HTMLImageElement }[] = []
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    TEXTURE0: 10,
    TEXTURE1: 11,
    TEXTURE2: 12,
    TEXTURE_2D: 20,
    UNPACK_FLIP_Y_WEBGL: 21,
    TEXTURE_MIN_FILTER: 22,
    TEXTURE_MAG_FILTER: 23,
    NEAREST: 24,
    LINEAR: 25,
    TEXTURE_WRAP_S: 26,
    TEXTURE_WRAP_T: 27,
    CLAMP_TO_EDGE: 28,
    RGBA: 29,
    UNSIGNED_BYTE: 30,
    ARRAY_BUFFER: 31,
    FLOAT: 32,
    STATIC_DRAW: 33,
    TRIANGLE_STRIP: 34,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => 'compile failure'),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => 'link failure'),
    deleteProgram: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    deleteBuffer: vi.fn(),
    createVertexArray: vi.fn(() => ({})),
    bindVertexArray: vi.fn(),
    deleteVertexArray: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    getUniformLocation: vi.fn((_program: unknown, name: string) => name),
    useProgram: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    uniform4f: vi.fn(),
    uniform2f: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    drawArrays: vi.fn(),
    createTexture: vi.fn(() => ({})),
    deleteTexture: vi.fn(),
    pixelStorei: vi.fn(),
    activeTexture: vi.fn((value: number) => {
      unit = value - 10
    }),
    bindTexture: vi.fn((_target: number, texture: unknown) => {
      bound.set(unit, texture)
    }),
    texParameteri: vi.fn(),
    texImage2D: vi.fn((...args: unknown[]) => {
      uploads.push({ unit, source: args[5] as HTMLCanvasElement | HTMLImageElement })
    }),
  }
  return { gl, bound, uploads }
}

function setup(patch: Partial<IColorfulMapImageOptions> = {}, attach = true) {
  const { gl, bound, uploads } = createGL()
  const layer = new ColorfulMapImage({
    img: canvas(),
    latmin: 0,
    latmax: 10,
    lonmin: 0,
    lonmax: 10,
    scale: { r: 1, g: 1, b: 1, a: 1 },
    colors: { r: [0, 255], g: [0, 0], b: [255, 0], v: [0, 10], o: [1, 1] },
    getGrid: true,
    interval: 1,
    ...patch,
  })
  const webgl = gl as unknown as WebGL2RenderingContext
  const map = {
    triggerRepaint: vi.fn(),
    moveLayer: vi.fn(),
    getCenter: vi.fn(() => ({ lng: 0 })),
    getRenderWorldCopies: vi.fn(() => false),
    addLayer: vi.fn((): void => layer.onAdd(map as unknown as maplibregl.Map, webgl)),
    removeLayer: vi.fn((): void => layer.onRemove(map as unknown as maplibregl.Map, webgl)),
  }
  const add = () => layer.addTo(map as unknown as maplibregl.Map)
  const frame = () =>
    layer.render(webgl, {
      defaultProjectionData: { mainMatrix: new Float32Array(16) },
    } as maplibregl.CustomRenderMethodInput)
  const uniform = (name: string) =>
    gl.uniform4f.mock.calls
      .filter((call) => call[0] === name)
      .slice(-1)[0]
      ?.slice(1)
  if (attach) add()
  return { layer, gl, webgl, map, frame, add, uniform, bound, uploads }
}

beforeEach(() => {
  images.length = 0
  pixelReads.length = 0
  vi.stubGlobal(
    'Image',
    vi.fn(() => {
      const image = document.createElement('img')
      Object.defineProperty(image, 'complete', { configurable: true, value: false })
      images.push(image)
      return image
    })
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement
  ) {
    if (!contexts.has(this)) contexts.set(this, createContext(this))
    return contexts.get(this)! as unknown as CanvasRenderingContext2D
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ColorfulMapImage unified options', () => {
  it('initializes through the first frame and exposes only the unified parameter API', () => {
    const { layer, frame, gl } = setup()
    expect(gl.texImage2D).not.toHaveBeenCalled()
    expect(layer.getGridDataByLatLon(1, 1)).toBeNull()
    frame()
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(8)
    expect(gl.bufferData).toHaveBeenCalledTimes(1)
    for (const name of [
      'changeImage',
      'changeAll',
      'changeImageArea',
      'changeColors',
      'changeLinear',
      'changeGrid',
      'setGetGrid',
    ]) {
      expect(name in layer).toBe(false)
    }
  })

  it('applies options submitted before addTo through the same pipeline', () => {
    const { layer, add, frame, uniform } = setup({}, false)
    expect(layer.setOption({ img: '/before.png', latmin: 2, getGrid: false })).toBe(layer)
    expect(images).toHaveLength(0)
    add()
    expect(images[0].getAttribute('src')).toBe('/before.png')
    load(images[0])
    frame()
    expect(uniform('tbound')).toEqual([2, 10, 0, 10])
    expect(layer.getGridDataByLatLon(3, 3)).toBeNull()
  })

  it('batches immediate changes, ignores undefined and accepts false and zero', () => {
    const { layer, gl, frame, uniform, uploads } = setup({
      grid: true,
      linear: 1,
      minOpacity: true,
    })
    frame()
    const count = uploads.length
    gl.bufferData.mockClear()
    layer.setOption({ latmin: 1, grid: false, linear: 0, minOpacity: false, latmax: undefined })
    layer.setOption({ lonmin: 2, lonmax: 8 })
    expect(uniform('tbound')).toEqual([0, 10, 0, 10])
    frame()
    expect(uniform('tbound')).toEqual([1, 10, 2, 8])
    expect(gl.bufferData).toHaveBeenCalledTimes(1)
    expect(uploads.length - count).toBe(1) // Only the color ramp needs an upload.
    expect(gl.uniform1i).toHaveBeenCalledWith('tminOpacity', 0)
    expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  })

  it('keeps the same opacity function and alpha calculation when toggling cut', () => {
    const { layer, frame, gl } = setup({ minOpacity: true, cut: true, cutUrl: '/mask.png' })
    load(images[0])
    frame()
    layer.setOption({ cut: false })
    frame()

    const fragments = gl.shaderSource.mock.calls
      .map(([, source]) => String(source))
      .filter((source) => source.includes('out vec4 outColor;'))
    expect(fragments).toHaveLength(3)
    const opacity = fragments.map((source) => ({
      helper: source.match(/float minimumOpacity\([\s\S]*?\n\}/)?.[0],
      alpha: source.match(/if \(tminOpacity\) \{([\s\S]*?)\}/)?.[1],
    }))
    expect(opacity[0].helper).toBeDefined()
    expect(opacity[0].alpha).toContain('minimumOpacity(')
    expect(opacity[1]).toEqual(opacity[0])
    expect(opacity[2]).toEqual(opacity[0])
    expect(gl.uniform1i).toHaveBeenLastCalledWith('u_color', 1)
    expect(gl.uniform1i).toHaveBeenCalledWith('tminOpacity', 1)
  })

  it('waits for img before committing ALL main fields, including colors and grid', () => {
    const { layer, frame, uniform, gl, uploads, bound } = setup()
    frame()
    const previousTexture = bound.get(0)
    const count = uploads.length
    layer.setOption({
      img: '/new.png',
      latmin: 2,
      scale: { r: 2, g: 2, b: 2, a: 2 },
      interval: 2,
      grid: true,
      flipy: 1,
      minOpacity: true,
      beforeId: 'labels',
      linear: 1,
      colors: { r: [255, 0], g: [0, 255], b: [0, 0], v: [20, 30], o: [1, 1] },
    })
    frame()
    expect(uniform('tbound')).toEqual([0, 10, 0, 10])
    expect(uniform('scale')).toEqual([1, 1, 1, 1])
    expect(uploads).toHaveLength(count)
    expect(bound.get(0)).toBe(previousTexture)
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(8)
    load(images[0], 24)
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(8)
    frame()
    expect(uniform('tbound')).toEqual([2, 10, 0, 10])
    expect(uniform('scale')).toEqual([2, 2, 2, 2])
    expect(layer.getGridDataByLatLon(4, 4)?.data).toBe(12)
    expect(pixelReads.slice(-1)[0]).toEqual([2, 1, 2, 2])
    expect(uploads.filter((upload) => upload.unit === 0).slice(-1)[0].source).toBe(images[0])
    expect(gl.uniform2f).toHaveBeenLastCalledWith('vrange', 20, 35)
    expect(gl.pixelStorei).toHaveBeenCalledWith(gl.UNPACK_FLIP_Y_WEBGL, 1)
  })

  it('supports changing img alone while keeping the other options', () => {
    const { layer, frame, uniform, uploads } = setup()
    frame()
    const rampCount = uploads.filter((upload) => upload.unit === 1).length
    layer.setOption({ img: '/alone.png' })
    frame()
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(8)
    load(images[0], 40)
    frame()
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(40)
    expect(uniform('tbound')).toEqual([0, 10, 0, 10])
    expect(uploads.filter((upload) => upload.unit === 1)).toHaveLength(rampCount)
  })

  it('merges edits during loading and ignores superseded images', () => {
    const { layer, frame, uniform } = setup()
    frame()
    layer.setOption({ img: '/a.png', latmin: 1 })
    layer.setOption({ linear: 1, latmax: 8 })
    layer.setOption({ img: '/b.png', lonmin: 2 })
    load(images[0], 40)
    frame()
    expect(uniform('tbound')).toEqual([0, 10, 0, 10])
    load(images[1], 24)
    frame()
    expect(uniform('tbound')).toEqual([1, 8, 2, 10])
    expect(layer.getGridDataByLatLon(3, 3)?.data).toBe(24)
    load(images[0], 80)
    frame()
    expect(layer.getGridDataByLatLon(3, 3)?.data).toBe(24)
  })

  it('commits the latest edits even after loading finishes but before the frame', () => {
    const { layer, frame, uniform } = setup()
    frame()
    layer.setOption({ img: '/a.png', latmin: 1 })
    load(images[0])
    layer.setOption({ latmin: 3 })
    frame()
    expect(uniform('tbound')).toEqual([3, 10, 0, 10])
  })

  it('keeps the main and cut groups independent in both directions', () => {
    const { layer, frame, uniform, gl } = setup()
    frame()
    layer.setOption({
      img: '/new.png',
      latmin: 2,
      cutUrl: '/mask.png',
      cut: true,
      cutlatmin: 0,
      cutlatmax: 10,
      cutlonmin: 0,
      cutlonmax: 10,
    })
    load(images[1])
    frame()
    expect(uniform('tbound')).toEqual([0, 10, 0, 10])
    expect(uniform('cutArea')).toEqual([0, 10, 0, 10])
    expect(gl.createProgram).toHaveBeenCalledTimes(2)
    layer.setOption({ cutlatmin: 1 })
    frame()
    expect(uniform('cutArea')).toEqual([1, 10, 0, 10])
    load(images[0])
    frame()
    expect(uniform('tbound')).toEqual([2, 10, 0, 10])
    layer.setOption({ cutUrl: '/mask-b.png', cutlatmin: 3, scale: { r: 2, g: 1, b: 1, a: 1 } })
    frame()
    expect(uniform('cutArea')).toEqual([1, 10, 0, 10])
    expect(uniform('scale')).toEqual([2, 1, 1, 1])
    layer.setOption({ cutlatmax: 8 })
    load(images[2])
    frame()
    expect(uniform('cutArea')).toEqual([3, 8, 0, 10])
  })

  it.each(['main', 'mask'])(
    'waits for both textures when %s loads first with cut enabled',
    (first) => {
      const { frame, gl, uniform, map } = setup({
        img: '/data.png',
        cut: true,
        cutUrl: '/mask.png',
        cutlatmin: 0,
        cutlatmax: 10,
        cutlonmin: 0,
        cutlonmax: 10,
      })
      load(images[first === 'main' ? 0 : 1])
      frame()
      frame()
      expect(gl.drawArrays).not.toHaveBeenCalled()
      const repaintCount = map.triggerRepaint.mock.calls.length
      load(images[first === 'main' ? 1 : 0])
      expect(map.triggerRepaint.mock.calls.length).toBeGreaterThan(repaintCount)
      frame()
      expect(gl.drawArrays).toHaveBeenCalledOnce()
      expect(gl.uniform1i).toHaveBeenCalledWith('cutImg', 2)
      expect(uniform('cutArea')).toEqual([0, 10, 0, 10])
    }
  )

  it('pauses uncut drawing while enabling cut, even with a disabled cached mask', () => {
    const { layer, frame, gl, bound } = setup({ cut: false, cutUrl: '/cached.png' })
    load(images[0])
    frame()
    expect(gl.drawArrays).toHaveBeenCalledOnce()
    gl.drawArrays.mockClear()
    layer.setOption({
      cut: true,
      cutUrl: '/new.png',
      cutlatmin: 0,
      cutlatmax: 10,
      cutlonmin: 0,
      cutlonmax: 10,
    })
    frame()
    expect(gl.drawArrays).not.toHaveBeenCalled()
    load(images[1])
    frame()
    expect(gl.drawArrays).toHaveBeenCalledOnce()
    expect(bound.get(2)).toBeTruthy()
    expect(gl.uniform1i).toHaveBeenCalledWith('cutImg', 2)
  })

  it.each(['load', 'shader'])(
    'resumes the previous uncut frame when enabling cut fails during %s preparation',
    (failure) => {
      const { layer, frame, gl } = setup({ cut: false, cutUrl: '/cached.png' })
      load(images[0])
      frame()
      gl.drawArrays.mockClear()
      gl.uniform1i.mockClear()
      layer.setOption({ cut: true, cutUrl: '/new.png' })
      frame()
      expect(gl.drawArrays).not.toHaveBeenCalled()

      if (failure === 'load') images[1].dispatchEvent(new Event('error'))
      else {
        load(images[1])
        gl.getShaderParameter.mockReturnValueOnce(false)
      }
      frame()
      expect(gl.drawArrays).toHaveBeenCalledOnce()
      expect(gl.uniform1i).not.toHaveBeenCalledWith('cutImg', 2)
      expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(8)
    }
  )

  it('keeps a committed cut requirement while a disabling replacement is pending', () => {
    const { layer, frame, gl } = setup({ cut: true, cutUrl: '/bad.png' })
    images[0].dispatchEvent(new Event('error'))
    frame()
    layer.setOption({ cut: false, cutUrl: '/replacement.png' })
    frame()
    expect(gl.drawArrays).not.toHaveBeenCalled()
    load(images[1])
    frame()
    expect(gl.drawArrays).toHaveBeenCalledOnce()
    expect(gl.uniform1i).not.toHaveBeenCalledWith('cutImg', 2)
  })

  it('keeps initial cut hidden after mask failure and recovers when retried or disabled', () => {
    const { layer, frame, gl } = setup({ cut: true, cutUrl: '/bad.png' })
    images[0].dispatchEvent(new Event('error'))
    frame()
    expect(gl.drawArrays).not.toHaveBeenCalled()
    layer.setOption({ cutUrl: '/retry.png' })
    frame()
    expect(gl.drawArrays).not.toHaveBeenCalled()
    load(images[1])
    frame()
    expect(gl.drawArrays).toHaveBeenCalledOnce()
    layer.setOption({ cut: false })
    frame()
    expect(gl.drawArrays).toHaveBeenCalledTimes(2)
    expect(gl.createProgram).toHaveBeenCalledTimes(3)
  })

  it('continues clipped drawing with an active mask while a replacement is loading', () => {
    const { layer, frame, gl, bound, uniform } = setup({
      cut: true,
      cutUrl: '/old.png',
      cutlatmin: 0,
      cutlatmax: 10,
      cutlonmin: 0,
      cutlonmax: 10,
    })
    load(images[0])
    frame()
    const oldTexture = bound.get(2)
    layer.setOption({ cutUrl: '/new.png', cutlatmin: 2, img: canvas(32) })
    frame()
    expect(gl.drawArrays).toHaveBeenCalledTimes(2)
    expect(bound.get(2)).toBe(oldTexture)
    expect(uniform('cutArea')).toEqual([0, 10, 0, 10])
    load(images[1])
    frame()
    expect(gl.drawArrays).toHaveBeenCalledTimes(3)
    expect(bound.get(2)).not.toBe(oldTexture)
    expect(uniform('cutArea')).toEqual([2, 10, 0, 10])
  })

  it('waits for cutUrl even when disabling cut, then toggles using the cached mask', () => {
    const { layer, frame, gl } = setup({ cutUrl: '/mask.png', cut: true })
    load(images[0])
    frame()
    expect(gl.createProgram).toHaveBeenCalledTimes(2)
    layer.setOption({ cutUrl: '/other.png', cut: false })
    frame()
    expect(gl.createProgram).toHaveBeenCalledTimes(2)
    load(images[1])
    frame()
    expect(gl.createProgram).toHaveBeenCalledTimes(3)
    layer.setOption({ cut: true })
    frame()
    expect(gl.createProgram).toHaveBeenCalledTimes(4)
    expect(images).toHaveLength(2)
    layer.setOption({ cut: false })
    frame()
    expect(gl.createProgram).toHaveBeenCalledTimes(5)
  })

  it('ignores old mask results and clears masks with an empty URL', () => {
    const { layer, frame, gl, uploads } = setup({ cut: true, cutUrl: '/a.png' })
    layer.setOption({ cutUrl: '/b.png' })
    load(images[0])
    frame()
    expect(gl.createProgram).toHaveBeenCalledTimes(1)
    load(images[1])
    frame()
    expect(uploads.filter((upload) => upload.unit === 2)).toHaveLength(1)
    layer.setOption({ cutUrl: '' })
    frame()
    expect(gl.createProgram).toHaveBeenCalledTimes(3)
    layer.setOption({ cut: true })
    frame()
    expect(images).toHaveLength(2)
    expect(gl.createProgram).toHaveBeenCalledTimes(3)
  })

  it('rolls back only the failed main group and continues with immediate updates', () => {
    const { layer, frame, uniform } = setup()
    frame()
    layer.setOption({ img: '/bad.png', latmin: 5, scale: { r: 2, g: 2, b: 2, a: 2 }, cutlonmin: 3 })
    images[0].dispatchEvent(new Event('error'))
    frame()
    expect(uniform('tbound')).toEqual([0, 10, 0, 10])
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(8)
    layer.setOption({
      img: '/good.png',
      cut: true,
      cutUrl: '/mask.png',
      cutlatmin: 0,
      cutlatmax: 10,
      cutlonmax: 10,
    })
    load(images[1])
    load(images[2])
    frame()
    expect(uniform('scale')).toEqual([1, 1, 1, 1])
    expect(uniform('cutArea')).toEqual([0, 10, 3, 10])
    layer.setOption({ latmin: 2 })
    frame()
    expect(uniform('tbound')).toEqual([2, 10, 0, 10])
  })

  it('retains the previous mask on failure without blocking the main group', () => {
    const { layer, frame, uniform, gl } = setup({ cut: true, cutUrl: '/a.png', cutlatmin: 1 })
    load(images[0])
    frame()
    layer.setOption({ cutUrl: '/bad.png', cut: false, cutlatmin: 5, latmin: 2 })
    images[1].dispatchEvent(new Event('error'))
    frame()
    expect(uniform('tbound')).toEqual([2, 10, 0, 10])
    expect(uniform('cutArea')?.[0]).toBe(1)
    expect(gl.createProgram).toHaveBeenCalledTimes(2)
  })

  it('does not draw on initial image failure and can recover', () => {
    const { layer, frame, gl } = setup({ img: '/bad.png' })
    images[0].dispatchEvent(new Event('error'))
    frame()
    expect(gl.drawArrays).not.toHaveBeenCalled()
    expect(layer.getGridDataByLatLon(1, 1)).toBeNull()
    layer.setOption({ img: canvas(32) })
    frame()
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(32)
    expect(gl.bufferData).toHaveBeenCalledTimes(1)
  })

  it('retains the previous data on upload failure and releases the failed texture', () => {
    const { layer, frame, gl, bound, uniform } = setup()
    frame()
    const oldTexture = bound.get(0)
    layer.setOption({ img: canvas(32), latmin: 2 })
    gl.texImage2D.mockImplementationOnce(() => {
      throw new Error('upload failure')
    })
    frame()
    expect(bound.get(0)).toBe(oldTexture)
    expect(gl.deleteTexture).toHaveBeenCalledTimes(1)
    expect(uniform('tbound')).toEqual([0, 10, 0, 10])
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(8)
  })

  it('rolls back a mask if its shader cannot be compiled', () => {
    const { layer, frame, gl } = setup()
    frame()
    layer.setOption({ cut: true, cutUrl: '/mask.png' })
    load(images[0])
    gl.getShaderParameter.mockReturnValueOnce(false)
    frame()
    expect(gl.drawArrays).toHaveBeenCalledTimes(2)
    expect(gl.deleteTexture).toHaveBeenCalledTimes(1)
    layer.setOption({ cut: false })
    frame()
    expect(gl.createProgram).toHaveBeenCalledTimes(1)
  })

  it('refreshes a Canvas with the same reference, then flips using the cached snapshot', () => {
    const source = canvas()
    const { layer, frame, uploads, gl } = setup({ img: source })
    frame()
    source.dataset.pixel = '32'
    layer.setOption({ img: source })
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(8)
    frame()
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(32)
    const beforeFlip = uploads.filter((upload) => upload.unit === 0).slice(-1)[0].source
    source.dataset.pixel = '64'
    layer.setOption({ flipy: 1 })
    frame()
    expect(uploads.filter((upload) => upload.unit === 0).slice(-1)[0].source).toBe(beforeFlip)
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(32)
    expect(gl.pixelStorei).toHaveBeenCalledWith(gl.UNPACK_FLIP_Y_WEBGL, 1)
    expect(images).toHaveLength(0)
  })

  it('reloads explicitly submitted identical URLs', () => {
    const { layer, frame } = setup({ img: '/a.png', cutUrl: '/mask.png' })
    load(images[0])
    load(images[1])
    frame()
    layer.setOption({ img: '/a.png', cutUrl: '/mask.png' })
    expect(images).toHaveLength(4)
  })

  it('uses Image listeners without overwriting existing handlers and uses natural dimensions', () => {
    const image = document.createElement('img')
    Object.defineProperty(image, 'complete', { configurable: true, value: false })
    image.width = 200
    const onload = vi.fn()
    image.onload = onload
    const { layer, frame, uploads } = setup({ img: image })
    load(image)
    frame()
    expect(image.onload).toBe(onload)
    expect(onload).toHaveBeenCalledOnce()
    expect(uploads.find((upload) => upload.unit === 0)?.source).toBe(image)
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(16)
    expect(pixelReads.slice(-1)[0]).toEqual([1, 1, 2, 2])
    const other = document.createElement('img')
    Object.defineProperty(other, 'complete', { configurable: true, value: false })
    layer.setOption({ img: other, latmin: 3 })
    other.dispatchEvent(new Event('error'))
    frame()
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(16)
  })

  it('applies a preloaded Image on the next frame', () => {
    const image = document.createElement('img')
    load(image, 40)
    const { layer, frame } = setup({ img: image })
    expect(layer.getGridDataByLatLon(1, 1)).toBeNull()
    frame()
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(40)
  })

  it('uses useCros for each URL load without reloading on a standalone change', () => {
    const { layer, frame } = setup({ img: '/a.png' })
    expect(images[0].getAttribute('crossorigin')).toBeNull()
    layer.setOption({ useCros: true })
    expect(images).toHaveLength(1)
    load(images[0])
    frame()
    layer.setOption({ img: '/b.png' })
    expect(images[1].crossOrigin).toBe('anonymous')
    layer.setOption({ img: '/c.png', useCros: false, cutUrl: '/mask.png' })
    expect(images[2].getAttribute('crossorigin')).toBeNull()
    expect(images[3].crossOrigin).toBe('anonymous')
  })

  it('copies nested option values and changes the query switch in the same frame', () => {
    const { layer, frame, uniform } = setup()
    frame()
    const scale = { r: 2, g: 2, b: 2, a: 2 }
    const colors = { r: [0, 255], g: [0, 0], b: [0, 0], v: [20, 30], o: [1, 1] }
    layer.setOption({ scale, colors, getGrid: false })
    scale.r = 8
    colors.v[0] = 100
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(8)
    frame()
    expect(uniform('scale')).toEqual([2, 2, 2, 2])
    expect(layer.getGridDataByLatLon(1, 1)).toBeNull()
    layer.setOption({ getGrid: true })
    frame()
    expect(layer.getGridDataByLatLon(1, 1)?.data).toBe(4)
  })

  it('moves the layer without changing its id and waits when the main image is pending', () => {
    const { layer, frame, map } = setup({ beforeId: 'labels' })
    expect(layer.id).not.toBe('labels')
    const id = layer.id
    expect(map.addLayer).toHaveBeenCalledWith(layer, 'labels')
    frame()
    layer.setOption({ beforeId: 'roads' })
    frame()
    expect(map.moveLayer).toHaveBeenCalledWith(id, 'roads')
    layer.setOption({ img: '/a.png', beforeId: 'top' })
    frame()
    expect(map.moveLayer).toHaveBeenCalledTimes(1)
    load(images[0])
    frame()
    expect(map.moveLayer).toHaveBeenLastCalledWith(id, 'top')
    expect(layer.id).toBe(id)
  })

  it('invalidates removed requests and reinitializes the latest target on readd', () => {
    const { layer, frame, webgl, map, add, gl, uniform } = setup()
    frame()
    layer.setOption({ img: '/pending.png', latmin: 2, cutUrl: '/mask.png' })
    layer.onRemove(map as unknown as maplibregl.Map, webgl)
    expect(layer.getGridDataByLatLon(1, 1)).toBeNull()
    const count = gl.texImage2D.mock.calls.length
    load(images[0])
    load(images[1])
    frame()
    expect(gl.texImage2D).toHaveBeenCalledTimes(count)
    layer.setOption({ latmax: 8 })
    add()
    load(images[2])
    load(images[3])
    frame()
    expect(uniform('tbound')).toEqual([2, 8, 0, 10])
  })

  it('makes destruction idempotent and ignores subsequent updates and callbacks', () => {
    const { layer, frame, map, gl, add } = setup({ img: '/a.png', cutUrl: '/mask.png' })
    layer.destroy()
    layer.destroy()
    const count = map.triggerRepaint.mock.calls.length
    load(images[0])
    load(images[1])
    layer.setOption({ img: '/b.png' })
    add()
    frame()
    expect(images).toHaveLength(2)
    expect(map.removeLayer).toHaveBeenCalledOnce()
    expect(map.addLayer).toHaveBeenCalledOnce()
    expect(map.triggerRepaint).toHaveBeenCalledTimes(count)
    expect(gl.texImage2D).not.toHaveBeenCalled()
  })
})
