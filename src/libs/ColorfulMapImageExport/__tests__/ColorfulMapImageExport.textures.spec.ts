import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getColorfulMapExportSize, renderColorfulMapImage } from '../ColorfulMapImageExport'
import type {
  IColorfulMapGeoBounds,
  IColorfulMapImageData,
  IColorfulMapImageExportOptions,
  IColorfulMapWorkerExportOptions,
} from '../ColorfulMapImageExport.types'

class TestImageData {
  constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
}

const bounds: IColorfulMapGeoBounds = { lonmin: 0, lonmax: 4, latmin: 0, latmax: 2 }
const projection = {
  id: 'EPSG:4326',
  forward: (lon: number, lat: number) => ({ x: lon, y: -lat }),
  inverse: (x: number, y: number) => ({ lon: x, lat: -y }),
}
const common = {
  scale: { r: 1, g: 0, b: 0, a: 0 },
  colors: { r: [0, 255], g: [0, 0], b: [255, 0], v: [0, 255], o: [1, 1] },
  linear: 1,
  projection,
  axes: { enabled: false, width: 4 },
  margin: 0,
}

function texture(
  extent: IColorfulMapGeoBounds,
  values: number[],
  width = 1,
  height = 1
): IColorfulMapImageData {
  return {
    ...extent,
    image: new TestImageData(
      new Uint8ClampedArray(values.flatMap((value) => [value, 0, 0, 255])),
      width,
      height
    ) as ImageData,
  }
}

const outputs = new Map<HTMLCanvasElement, Uint8ClampedArray>()

beforeEach(() => {
  outputs.clear()
  vi.stubGlobal('ImageData', TestImageData)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement
  ) {
    const canvas = this
    const pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4)
    outputs.set(canvas, pixels)
    const ctx = {
      canvas,
      fillStyle: '#ffffff',
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      fillRect() {
        const hex = this.fillStyle.slice(1)
        const color = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
        for (let i = 0; i < pixels.length; i += 4) pixels.set([...color, 255], i)
      },
      getImageData: () => ({ data: pixels, width: canvas.width, height: canvas.height }),
      putImageData: vi.fn(),
    }
    return ctx as unknown as CanvasRenderingContext2D
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function render(options: IColorfulMapImageExportOptions) {
  const result = await renderColorfulMapImage(options)
  const data = outputs.get(result.canvas as HTMLCanvasElement)!
  const pixels = Array.from({ length: result.height }, (_, y) =>
    Array.from({ length: result.width }, (_, x) => {
      const offset = (y * result.width + x) * 4
      return Array.from(data.slice(offset, offset + 4))
    })
  )
  return { result, pixels }
}

const blue = [0, 0, 255, 255]
const red = [255, 0, 0, 255]
const transparent = [0, 0, 0, 0]

describe('independent texture extents', () => {
  it('uses a single texture extent by default and matches a one-item array', async () => {
    const imageData = texture(bounds, [0, 255], 2, 1)
    const single = await render({ ...common, imageData })
    const multiple = await render({ ...common, imageData: [imageData], outputBounds: bounds })
    expect(single.result.width).toBe(4)
    expect(single.result.height).toBe(2)
    expect(multiple.pixels).toEqual(single.pixels)
    expect(single.pixels[0].map((pixel) => pixel[0])).toEqual([32, 96, 159, 223])
  })

  it('samples horizontal neighbors using each texture extent', async () => {
    const { pixels } = await render({
      ...common,
      imageData: [texture({ ...bounds, lonmax: 2 }, [0]), texture({ ...bounds, lonmin: 2 }, [255])],
      outputBounds: bounds,
    })
    expect(pixels).toEqual([
      [blue, blue, red, red],
      [blue, blue, red, red],
    ])
  })

  it('samples vertically separated textures with different dimensions and extents', async () => {
    const { pixels } = await render({
      ...common,
      imageData: [
        texture({ ...bounds, latmax: 1 }, [255, 255], 2, 1),
        texture({ ...bounds, latmin: 1 }, [0, 0], 1, 2),
      ],
      outputBounds: bounds,
    })
    expect(pixels).toEqual([
      [blue, blue, blue, blue],
      [red, red, red, red],
    ])
  })

  it('uses outputBounds for sizing without needing imageData', () => {
    const size = getColorfulMapExportSize({ ...common, outputBounds: bounds })
    expect(size).toEqual({ width: 4, height: 2, aspectRatio: 2 })
  })

  it('clips sampling to outputBounds and keeps uncovered regions transparent', async () => {
    const { pixels, result } = await render({
      ...common,
      imageData: [
        texture({ ...bounds, lonmin: -2, lonmax: 1 }, [255]),
        texture({ ...bounds, lonmin: 3, lonmax: 6 }, [0]),
        texture({ ...bounds, lonmin: 10, lonmax: 12 }, [255]),
      ],
      outputBounds: bounds,
    })
    expect(result.width).toBe(4)
    expect(pixels).toEqual([
      [red, transparent, transparent, blue],
      [red, transparent, transparent, blue],
    ])
  })

  it('keeps explicit outputBounds independent of a single texture', async () => {
    const { pixels } = await render({
      ...common,
      imageData: texture({ ...bounds, lonmax: 1 }, [255]),
      outputBounds: bounds,
    })
    expect(pixels[0]).toEqual([red, transparent, transparent, transparent])
  })

  it('sizes inline texture configurations without loading their images', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const single = getColorfulMapExportSize({
      ...common,
      imageData: { ...bounds, image: '/single.png' },
    })
    const multiple = getColorfulMapExportSize({
      ...common,
      imageData: [
        { ...bounds, image: '/west.png', lonmax: 2 },
        { ...bounds, image: '/east.png', lonmin: 2 },
      ],
      outputBounds: bounds,
    })
    expect(single).toEqual({ width: 4, height: 2, aspectRatio: 2 })
    expect(multiple).toEqual(single)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('makes below-minimum values transparent for both single and multiple textures', async () => {
    const imageData = texture(bounds, [5])
    const options = {
      ...common,
      colors: { ...common.colors, v: [10, 255] },
      minOpacity: true,
    }
    const single = await render({ ...options, imageData })
    const multiple = await render({ ...options, imageData: [imageData], outputBounds: bounds })
    expect(multiple.pixels).toEqual(single.pixels)
    expect(multiple.pixels[0][0]).toEqual(transparent)
  })

  it('gives later textures precedence in overlapping regions without blending values', async () => {
    const { pixels } = await render({
      ...common,
      imageData: [texture(bounds, [0]), texture({ ...bounds, lonmin: 2 }, [255])],
      outputBounds: bounds,
    })
    expect(pixels[0]).toEqual([blue, blue, red, red])
  })

  describe('minimum opacity fallback', () => {
    const opacityOptions = {
      ...common,
      colors: { ...common.colors, v: [10, 255] },
      minOpacity: true,
      background: '#204060',
    }

    it.each(['png', 'jpg'] as const)(
      'skips transparent samples through multiple overlapping textures in %s',
      async (format) => {
        const { pixels } = await render({
          ...opacityOptions,
          imageData: [
            texture(bounds, [255]),
            texture(bounds, [0, 128], 2, 1),
            texture(bounds, [0]),
          ],
          outputBounds: bounds,
          grid: true,
          format,
        })
        expect(pixels).toEqual([
          [red, red, [123, 0, 132, 255], [123, 0, 132, 255]],
          [red, red, [123, 0, 132, 255], [123, 0, 132, 255]],
        ])
      }
    )

    it.each(['png', 'jpg'] as const)(
      'keeps the background when every overlapping sample is discarded in %s',
      async (format) => {
        const { pixels } = await render({
          ...opacityOptions,
          imageData: [texture(bounds, [0]), texture(bounds, [5])],
          outputBounds: bounds,
          format,
        })
        const background = format === 'png' ? transparent : [32, 64, 96, 255]
        expect(pixels).toEqual([
          [background, background, background, background],
          [background, background, background, background],
        ])
      }
    )

    it.each(['png', 'jpg'] as const)(
      'retains configured opacity and later-texture precedence at the minimum in %s',
      async (format) => {
        const later = texture(bounds, [10])
        const options = {
          ...opacityOptions,
          colors: { ...opacityOptions.colors, o: [0.5, 0.5] },
          format,
        }
        const single = await render({ ...options, imageData: later })
        const multiple = await render({
          ...options,
          imageData: [texture(bounds, [255]), later],
          outputBounds: bounds,
        })
        expect(multiple.pixels).toEqual(single.pixels)
        if (format === 'png') {
          expect(multiple.pixels[0][0]).toEqual([0, 0, 255, 128])
        }
      }
    )
  })

  it('keeps later-texture precedence when minimum opacity is disabled', async () => {
    const { pixels } = await render({
      ...common,
      imageData: [texture(bounds, [255]), texture(bounds, [0])],
      outputBounds: bounds,
      minOpacity: false,
    })
    expect(pixels[0]).toEqual([blue, blue, blue, blue])
  })

  it.each([false, true])('preserves nearest-neighbor sampling with flipy: %s', async (flipy) => {
    const { pixels } = await render({
      ...common,
      imageData: [texture(bounds, [0, 64, 128, 255], 2, 2)],
      outputBounds: bounds,
      grid: true,
      flipy,
    })
    const rows = pixels.map((row) => row.map((pixel) => pixel[0]))
    expect(rows).toEqual(
      flipy
        ? [
            [0, 0, 64, 64],
            [128, 128, 255, 255],
          ]
        : [
            [128, 128, 255, 255],
            [0, 0, 64, 64],
          ]
    )
  })

  it('interpolates within each texture rather than across neighboring textures', async () => {
    const { pixels } = await render({
      ...common,
      imageData: [
        texture({ ...bounds, lonmax: 2 }, [0, 128], 2, 1),
        texture({ ...bounds, lonmin: 2 }, [128, 255], 2, 1),
      ],
      outputBounds: bounds,
    })
    expect(pixels[0].map((pixel) => pixel[0])).toEqual([32, 96, 160, 223])
  })

  it('applies one global cut to all textures', async () => {
    const { pixels } = await render({
      ...common,
      imageData: [texture(bounds, [0]), texture({ ...bounds, lonmin: 2 }, [255])],
      outputBounds: bounds,
      cut: { ...texture(bounds, [255, 0], 1, 2), outside: 'discard' },
    })
    expect(pixels).toEqual([
      [transparent, transparent, transparent, transparent],
      [blue, blue, red, red],
    ])
  })

  it('uses the JPG background for gaps and blends colored pixels against it', async () => {
    const { pixels } = await render({
      ...common,
      imageData: [texture({ ...bounds, lonmax: 1 }, [255])],
      outputBounds: bounds,
      format: 'jpg',
      background: '#204060',
      colors: { ...common.colors, o: [0.5, 0.5] },
    })
    expect(pixels[0]).toEqual([
      [144, 32, 48, 255],
      [32, 64, 96, 255],
      [32, 64, 96, 255],
      [32, 64, 96, 255],
    ])
  })

  it('allows an empty array with outputBounds to produce an empty plot', async () => {
    const { pixels } = await render({ ...common, imageData: [], outputBounds: bounds })
    expect(pixels).toEqual([
      [transparent, transparent, transparent, transparent],
      [transparent, transparent, transparent, transparent],
    ])
  })

  it.each([0, 1, 2])(
    'rejects an array of %i textures without outputBounds before loading images',
    async (count) => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      // @ts-expect-error Array input requires outputBounds even for zero or one texture.
      const options: IColorfulMapImageExportOptions = {
        ...common,
        imageData: Array.from({ length: count }, () => ({ ...bounds, image: '/data.png' })),
      }
      // @ts-expect-error Worker input also requires outputBounds for arrays.
      const workerOptions: IColorfulMapWorkerExportOptions = { ...options, imageData: [] }
      expect(workerOptions.imageData).toEqual([])
      expect(() => getColorfulMapExportSize(options)).toThrow(
        'outputBounds is required when imageData is an array.'
      )
      await expect(renderColorfulMapImage(options)).rejects.toThrow(
        'outputBounds is required when imageData is an array.'
      )
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(outputs.size).toBe(0)
    }
  )
})
