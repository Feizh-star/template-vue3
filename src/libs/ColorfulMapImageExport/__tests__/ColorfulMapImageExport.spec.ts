import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getColorfulMapExportSize,
  renderColorfulMapImage,
  webMercatorProjection,
} from '../ColorfulMapImageExport'
import type {
  ColorfulMapMargin,
  IColorfulMapImageExportOptions,
  IColorfulMapTitleOptions,
} from '../ColorfulMapImageExport.types'

const contexts: ReturnType<typeof createContext>[] = []

function createContext(canvas: HTMLCanvasElement) {
  const textStyles: {
    text: string
    font: string
    color: string
    align: string
    baseline: string
  }[] = []
  return {
    canvas,
    textStyles,
    font: '12px sans-serif',
    textBaseline: 'middle',
    textAlign: 'left',
    fillStyle: '',
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn<[number, number, number, number], void>(),
    fillText: vi.fn<[string, number, number], void>(function (
      this: { font: string; fillStyle: string; textAlign: string; textBaseline: string },
      text: string
    ) {
      textStyles.push({
        text,
        font: this.font,
        color: this.fillStyle,
        align: this.textAlign,
        baseline: this.textBaseline,
      })
    }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    putImageData: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(canvas.width * canvas.height * 4) })),
    measureText(text: string) {
      const halfHeight = Number(this.font.match(/[\d.]+/)?.[0] || 12) / 2
      return {
        width: text.length * halfHeight,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: text.length * halfHeight,
        actualBoundingBoxAscent: halfHeight,
        actualBoundingBoxDescent: halfHeight,
      }
    },
  }
}

beforeEach(() => {
  contexts.length = 0
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement
  ) {
    const ctx = createContext(this)
    contexts.push(ctx)
    return ctx as unknown as CanvasRenderingContext2D
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ColorfulMapImage export sizing', () => {
  it('derives the plot height from axes.width and the projected aspect ratio', () => {
    const result = getColorfulMapExportSize({
      imageData: { lonmin: 72, lonmax: 136, latmin: 17, latmax: 55 },
      margin: 0,
      axes: { enabled: false, width: 1200 },
      projection: webMercatorProjection,
    })

    expect(result.width).toBe(1200)
    expect(result.height).toBeGreaterThan(900)
    expect(result.aspectRatio).toBeGreaterThan(1)
  })

  it('accepts a switchable projection for axes.width sizing', () => {
    const equirectangular = {
      id: 'EPSG:4326',
      forward: (lon: number, lat: number) => ({ x: lon, y: -lat }),
      inverse: (x: number, y: number) => ({ lon: x, lat: -y }),
    }
    const result = getColorfulMapExportSize({
      imageData: { lonmin: 0, lonmax: 20, latmin: 10, latmax: 20 },
      margin: 0,
      axes: { enabled: false, width: 1000 },
      projection: equirectangular,
    })

    expect(result.width).toBe(1000)
    expect(result.height).toBe(500)
    expect(result.aspectRatio).toBe(2)
  })

  it('uses outputBounds for image sizing while keeping the data extent separate', () => {
    const result = getColorfulMapExportSize({
      imageData: { lonmin: 10, lonmax: 20, latmin: 10, latmax: 20 },
      outputBounds: { lonmin: 0, lonmax: 30, latmin: 0, latmax: 60 },
      margin: 0,
      axes: { enabled: false, width: 900 },
      projection: webMercatorProjection,
    })

    expect(result.width).toBe(900)
    const projectedWidth =
      webMercatorProjection.forward(30, 0).x - webMercatorProjection.forward(0, 0).x
    const projectedHeight =
      webMercatorProjection.forward(0, 0).y - webMercatorProjection.forward(0, 60).y
    expect(result.aspectRatio).toBeCloseTo(projectedWidth / projectedHeight)
  })

  it('adds CSS-style image margins around the coordinate plot', () => {
    const result = getColorfulMapExportSize({
      imageData: { lonmin: 10, lonmax: 20, latmin: 10, latmax: 20 },
      outputBounds: { lonmin: 0, lonmax: 20, latmin: 0, latmax: 10 },
      margin: [10, 20, 30, 40],
      axes: { width: 900 },
      projection: {
        id: 'EPSG:4326',
        forward: (lon: number, lat: number) => ({ x: lon, y: -lat }),
        inverse: (x: number, y: number) => ({ lon: x, lat: -y }),
      },
    })

    expect(result.width).toBe(960)
    expect(result.height).toBe(490)
  })

  it.each([
    { margin: 20, width: 940, height: 490 },
    { margin: [10, 20] as [number, number], width: 940, height: 470 },
  ])('expands $margin around the plot', ({ margin, width, height }) => {
    const result = getColorfulMapExportSize({
      imageData: { lonmin: 0, lonmax: 20, latmin: 0, latmax: 10 },
      margin,
      axes: { width: 900 },
      projection: {
        id: 'EPSG:4326',
        forward: (lon: number, lat: number) => ({ x: lon, y: -lat }),
        inverse: (x: number, y: number) => ({ lon: x, lat: -y }),
      },
    })

    expect(result.width).toBe(width)
    expect(result.height).toBe(height)
  })

  it('keeps the default plot width and image margins', () => {
    const result = getColorfulMapExportSize({
      imageData: { lonmin: 0, lonmax: 20, latmin: 0, latmax: 10 },
      projection: {
        id: 'EPSG:4326',
        forward: (lon: number, lat: number) => ({ x: lon, y: -lat }),
        inverse: (x: number, y: number) => ({ lon: x, lat: -y }),
      },
    })

    expect(result.width).toBe(1666)
    expect(result.height).toBe(866)
  })

  it('expands content to fit an enabled color scale', () => {
    const base = {
      imageData: { lonmin: 0, lonmax: 20, latmin: 0, latmax: 10 },
      axes: { width: 1000 },
      projection: {
        id: 'EPSG:4326',
        forward: (lon: number, lat: number) => ({ x: lon, y: -lat }),
        inverse: (x: number, y: number) => ({ lon: x, lat: -y }),
      },
    }

    const withoutScale = getColorfulMapExportSize(base)
    const withScale = getColorfulMapExportSize({
      ...base,
      colors: {
        r: [0, 128, 255],
        g: [0, 128, 255],
        b: [0, 128, 255],
        v: [0, 500, 1000],
        o: [1, 1, 1],
      },
      colorScale: { enabled: true },
    })

    expect(withScale.width).toBeGreaterThan(withoutScale.width)
    expect(withScale.height).toBe(withoutScale.height)
  })

  it('does not mutate image margin and is stable across repeated calls', () => {
    const margin: [number, number, number, number] = [10, 20, 30, 40]
    const options = {
      imageData: { lonmin: 0, lonmax: 20, latmin: 0, latmax: 10 },
      margin,
      axes: { width: 1000 },
      colors: {
        r: [0, 128, 255],
        g: [0, 128, 255],
        b: [0, 128, 255],
        v: [0, 500, 1000],
        o: [1, 1, 1],
      },
      colorScale: { enabled: true },
      projection: {
        id: 'EPSG:4326',
        forward: (lon: number, lat: number) => ({ x: lon, y: -lat }),
        inverse: (x: number, y: number) => ({ lon: x, lat: -y }),
      },
    }

    const first = getColorfulMapExportSize(options)
    const second = getColorfulMapExportSize(options)
    const withoutScale = getColorfulMapExportSize({ ...options, colorScale: undefined })

    expect(second.width).toBe(first.width)
    expect(margin).toEqual([10, 20, 30, 40])
    // Image margins stay outside the content bounds.
    expect(withoutScale.width).toBe(1000 + 20 + 40)
    expect(first.width - withoutScale.width).toBe(10 + 12 + 8 + 4 * 6)
  })

  it('uses colorScale.values for the label text instead of colors.v', () => {
    const base = {
      imageData: { lonmin: 0, lonmax: 20, latmin: 0, latmax: 10 },
      axes: { width: 1000 },
      colors: {
        r: [0, 128, 255],
        g: [0, 128, 255],
        b: [0, 128, 255],
        v: [0, 0, 0],
        o: [1, 1, 1],
      },
      projection: {
        id: 'EPSG:4326',
        forward: (lon: number, lat: number) => ({ x: lon, y: -lat }),
        inverse: (x: number, y: number) => ({ lon: x, lat: -y }),
      },
    }

    const fromColors = getColorfulMapExportSize({ ...base, colorScale: { enabled: true } })
    const fromValues = getColorfulMapExportSize({
      ...base,
      colorScale: { enabled: true, labels: [0, 1000, 2000] },
    })

    // wider labels ("2000" vs "0") widen the reserved scale band
    expect(fromValues.width).toBeGreaterThan(fromColors.width)
  })
})

const layoutOptions = {
  imageData: { lonmin: 0, lonmax: 20, latmin: 0, latmax: 10 },
  margin: 0,
  axes: { width: 100 },
  colors: { r: [0, 128, 255], g: [0, 128, 255], b: [0, 128, 255], v: [0, 5, 10], o: [1, 1, 1] },
  projection: {
    id: 'EPSG:4326',
    forward: (lon: number, lat: number) => ({ x: lon, y: -lat }),
    inverse: (x: number, y: number) => ({ lon: x, lat: -y }),
  },
}

describe('plot and color scale content bounds', () => {
  it('positions the measured scale at [plot width + 10, 10] by default', () => {
    // Scale width = 12 + 8 + 12; height = 3 * 16 + bottom 6, with no end label.
    expect(getColorfulMapExportSize({ ...layoutOptions, colorScale: {} })).toEqual({
      width: 142,
      height: 64,
      aspectRatio: 2,
    })
  })

  it.each([
    { position: [-40, 0], width: 140, height: 54 },
    { position: [120, 0], width: 152, height: 54 },
    { position: [0, 60], width: 100, height: 114 },
    { position: [0, -70], width: 100, height: 120 },
    { position: [-0.5, -0.5], width: 101, height: 55 },
  ])('unions content at $position in all directions', ({ position, width, height }) => {
    const size = getColorfulMapExportSize({
      ...layoutOptions,
      colorScale: { position: position as [number, number] },
    })
    expect(size.width).toBe(width)
    expect(size.height).toBe(height)
  })

  it('does not expand content when the scale fits inside the plot', () => {
    expect(
      getColorfulMapExportSize({
        ...layoutOptions,
        colorScale: {
          position: [10, 10],
          blockHeight: 4,
          font: '4px sans-serif',
          showFirstLabel: false,
        },
      })
    ).toEqual({ width: 100, height: 50, aspectRatio: 2 })
  })

  it('applies image margin independently of axes.enabled', () => {
    const options = { ...layoutOptions, margin: [3, 7, 11, 13] as [number, number, number, number] }
    const withAxes = getColorfulMapExportSize({ ...options, colorScale: {} })
    const withoutAxes = getColorfulMapExportSize({
      ...options,
      axes: { width: 100, enabled: false },
      colorScale: {},
    })
    expect(withAxes).toEqual({ width: 162, height: 78, aspectRatio: 2 })
    expect(withoutAxes).toEqual(withAxes)
    expect(getColorfulMapExportSize({ ...options, axes: { width: 100, enabled: false } })).toEqual({
      width: 120,
      height: 64,
      aspectRatio: 2,
    })
  })

  it('retains the default image margin with disabled axes', () => {
    expect(
      getColorfulMapExportSize({
        ...layoutOptions,
        margin: undefined,
        axes: { enabled: false, width: 100 },
      })
    ).toEqual({
      width: 166,
      height: 116,
      aspectRatio: 2,
    })
  })

  it('only extends the top bounds when an end label is present', () => {
    const colors = { r: [0], g: [0], b: [0], v: [0], o: [1] }
    const options = {
      ...layoutOptions,
      imageData: { ...layoutOptions.imageData, latmax: 0.2 },
      colors,
    }
    const hiddenFirst = getColorfulMapExportSize({
      ...options,
      colorScale: { position: [0, 0], showFirstLabel: false },
    })
    const visibleFirst = getColorfulMapExportSize({
      ...options,
      colorScale: { position: [0, 0] },
    })
    const withEnd = getColorfulMapExportSize({
      ...options,
      colorScale: { position: [0, 0], endLabel: '1000' },
    })
    const withEndOnly = getColorfulMapExportSize({
      ...options,
      colorScale: { position: [0, 0], showFirstLabel: false, endLabel: '1000' },
    })
    expect(hiddenFirst.height).toBe(16)
    expect(visibleFirst.height).toBe(16 + 6)
    expect(withEnd.height).toBe(16 + 6 + 6)
    expect(withEndOnly.height).toBe(16 + 6)
    expect(withEndOnly.width).toBe(100)
  })

  it('measures end label width and treats an empty label like an omitted label', () => {
    const empty = getColorfulMapExportSize({ ...layoutOptions, colorScale: { endLabel: '' } })
    const without = getColorfulMapExportSize({ ...layoutOptions, colorScale: {} })
    const withEnd = getColorfulMapExportSize({
      ...layoutOptions,
      colorScale: { endLabel: '10000 mm' },
    })
    expect(empty).toEqual(without)
    expect(withEnd).toEqual({ width: 178, height: 70, aspectRatio: 2 })
  })

  it('contains large-font labels even when they overflow their swatches', () => {
    const size = getColorfulMapExportSize({
      ...layoutOptions,
      colorScale: { position: [0, 0], blockHeight: 2, font: '40px sans-serif' },
    })
    expect(size.width).toBe(100)
    expect(size.height).toBe(50)
    const extended = getColorfulMapExportSize({
      ...layoutOptions,
      imageData: { ...layoutOptions.imageData, latmax: 0.2 },
      colorScale: { position: [0, 0], blockHeight: 2, font: '40px sans-serif' },
    })
    expect(extended.height).toBe(4 + 20 + 20)
  })

  it('keeps threshold alignment as the default', () => {
    const implicit = getColorfulMapExportSize({ ...layoutOptions, colorScale: {} })
    const explicit = getColorfulMapExportSize({
      ...layoutOptions,
      colorScale: { labelAlign: 'threshold' },
    })
    expect(explicit).toEqual(implicit)
  })

  it('measures centered labels without reserving threshold-edge overflow', () => {
    const size = getColorfulMapExportSize({
      ...layoutOptions,
      colorScale: { labelAlign: 'center' },
    })
    expect(size).toEqual({ width: 142, height: 58, aspectRatio: 2 })
  })

  it('ignores endLabel in centered scale measurements', () => {
    const base = { ...layoutOptions, colorScale: { labelAlign: 'center' as const } }
    expect(
      getColorfulMapExportSize({
        ...base,
        colorScale: { ...base.colorScale, endLabel: 'A very wide end label' },
      })
    ).toEqual(getColorfulMapExportSize(base))
  })

  it('includes centered label overflow above and below short swatches', () => {
    const size = getColorfulMapExportSize({
      ...layoutOptions,
      imageData: { ...layoutOptions.imageData, latmax: 0.2 },
      colorScale: {
        position: [0, 0],
        labelAlign: 'center',
        blockHeight: 2,
        font: '40px sans-serif',
      },
    })
    expect(size).toEqual({ width: 100, height: 44, aspectRatio: 100 })
  })

  it('falls back to font-based sizing when a 2D context is unavailable', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    expect(getColorfulMapExportSize({ ...layoutOptions, colorScale: {} })).toEqual({
      width: 145,
      height: 64,
      aspectRatio: 2,
    })
  })

  it('does not reserve space for disabled, empty or missing color scales', () => {
    for (const options of [
      { ...layoutOptions, colorScale: { enabled: false } },
      { ...layoutOptions, colors: undefined, colorScale: {} },
      { ...layoutOptions, colors: { r: [], g: [], b: [], v: [], o: [] }, colorScale: {} },
    ])
      expect(getColorfulMapExportSize(options)).toEqual({ width: 100, height: 50, aspectRatio: 2 })
  })
})

describe('title box sizing', () => {
  const baseSize = { width: 100, height: 50, aspectRatio: 2 }

  it.each<IColorfulMapTitleOptions | undefined>([
    undefined,
    {},
    { main: { text: '  ' }, sub: { text: '\n' }, padding: 100 },
  ])('does not add a box for empty title configuration: %j', (title) => {
    expect(getColorfulMapExportSize({ ...layoutOptions, title })).toEqual(baseSize)
  })

  it('adds default text heights, padding and a single interline gap', () => {
    const size = getColorfulMapExportSize({
      ...layoutOptions,
      title: { main: { text: '主标题' }, sub: { text: '副标题' } },
    })
    expect(size).toEqual({ ...baseSize, height: 50 + 24 + 16 + 8 + 32 })
  })

  it.each([
    { main: { text: 'Title' } },
    { sub: { text: 'Subtitle', font: '24px Arial' } },
    { main: { text: 'Title' }, sub: { text: '' } },
  ])('does not reserve gap or a missing line: %j', (lines) => {
    const size = getColorfulMapExportSize({
      ...layoutOptions,
      title: { ...lines, gap: 100, padding: 0 },
    })
    expect(size).toEqual({ ...baseSize, height: 74 })
  })

  it.each<{ padding: ColorfulMapMargin; addedHeight: number }>([
    { padding: 5, addedHeight: 34 },
    { padding: [3, 7], addedHeight: 30 },
    { padding: [2, 4, 6, 8], addedHeight: 32 },
    { padding: [0.1, 4, 0.2, 8], addedHeight: 25 },
    { padding: [-1, NaN, Infinity, 8], addedHeight: 24 },
  ])('adds only vertical padding for $padding', ({ padding, addedHeight }) => {
    expect(
      getColorfulMapExportSize({
        ...layoutOptions,
        title: { main: { text: 'Title' }, padding },
      })
    ).toEqual({ ...baseSize, height: 50 + addedHeight })
  })

  it.each([
    { gap: 0, addedHeight: 40 },
    { gap: 2.5, addedHeight: 43 },
    { gap: -5, addedHeight: 40 },
    { gap: NaN, addedHeight: 48 },
  ])('normalizes a two-line gap of $gap', ({ gap, addedHeight }) => {
    expect(
      getColorfulMapExportSize({
        ...layoutOptions,
        title: { main: { text: 'Title' }, sub: { text: 'Subtitle' }, gap, padding: 0 },
      })
    ).toEqual({ ...baseSize, height: 50 + addedHeight })
  })

  it('uses actual asymmetric text metrics rather than a fixed font height', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement
    ) {
      const ctx = createContext(this)
      ctx.measureText = () => ({
        width: 30,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: 30,
        actualBoundingBoxAscent: 17,
        actualBoundingBoxDescent: 4,
      })
      return ctx as unknown as CanvasRenderingContext2D
    })
    expect(
      getColorfulMapExportSize({
        ...layoutOptions,
        title: { main: { text: 'Title' }, padding: 0 },
      }).height
    ).toBe(50 + 21)
  })

  it('falls back to font sizes without a canvas and does not widen for long text', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    const size = getColorfulMapExportSize({
      ...layoutOptions,
      title: {
        main: { text: 'A title much wider than the image', font: 'bold 30px Arial' },
        sub: { text: 'Subtitle', font: 'italic 18px Arial' },
        gap: 4,
        padding: 0,
      },
    })
    expect(size).toEqual({ ...baseSize, height: 50 + 30 + 18 + 4 })
  })
})

describe('content rendering', () => {
  function renderOptions(): IColorfulMapImageExportOptions {
    class TestImageData {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    }
    vi.stubGlobal('ImageData', TestImageData)
    return {
      ...layoutOptions,
      imageData: {
        ...layoutOptions.imageData,
        image: new TestImageData(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1) as ImageData,
      },
      scale: { r: 1, g: 0, b: 0, a: 0 },
      margin: [3, 7, 11, 13],
      colorScale: {},
    }
  }

  it.each(['png', 'jpg'] as const)(
    'adds a centered title box without resizing existing content in %s',
    async (format) => {
      const options = renderOptions()
      options.format = format
      options.background = '#204060'
      options.boundaries = [
        {
          data: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [20, 10],
            ],
          },
        },
      ]
      const before = await renderColorfulMapImage(options)
      const beforeCtx = contexts.find((item) => item.canvas === before.canvas)!
      options.title = {
        main: { text: 'Main\nTitle', font: 'bold 20px Arial', color: '#123456' },
        sub: { text: 'Subtitle', font: 'italic 10px Arial', color: '#654321' },
        gap: 6,
        padding: [4, 8, 12, 16],
      }
      const size = getColorfulMapExportSize(options)
      const after = await renderColorfulMapImage(options)
      const ctx = contexts.find((item) => item.canvas === after.canvas)!
      const addedHeight = 20 + 10 + 6 + 4 + 12
      expect(after.width).toBe(before.width)
      expect(after.height).toBe(before.height + addedHeight)
      expect(after.aspectRatio).toBe(before.aspectRatio)
      expect({ width: after.width, height: after.height, aspectRatio: after.aspectRatio }).toEqual(
        size
      )
      for (const method of ['moveTo', 'lineTo'] as const) {
        expect(ctx[method].mock.calls).toEqual(
          beforeCtx[method].mock.calls.map(([x, y]) => [x, y + addedHeight])
        )
      }
      const beforeSwatches = beforeCtx.fillRect.mock.calls.slice(format === 'jpg' ? 1 : 0)
      const afterSwatches = ctx.fillRect.mock.calls.slice(format === 'jpg' ? 1 : 0)
      expect(afterSwatches).toEqual(
        beforeSwatches.map(([x, y, w, h]) => [x, y + addedHeight, w, h])
      )
      expect(ctx.fillText.mock.calls.slice(0, -2)).toEqual(
        beforeCtx.fillText.mock.calls.map(([text, x, y]) => [text, x, y + addedHeight])
      )
      const centerX = 16 + (after.width - 16 - 8) / 2
      expect(ctx.fillText.mock.calls.slice(-2)).toEqual([
        ['Main Title', centerX, 14],
        ['Subtitle', centerX, 35],
      ])
      expect(ctx.textStyles.slice(-2)).toEqual([
        {
          text: 'Main Title',
          font: 'bold 20px Arial',
          color: '#123456',
          align: 'center',
          baseline: 'middle',
        },
        {
          text: 'Subtitle',
          font: 'italic 10px Arial',
          color: '#654321',
          align: 'center',
          baseline: 'middle',
        },
      ])
      expect(ctx.rect).toHaveBeenLastCalledWith(16, 4, after.width - 24, 36)
      const pixels = ctx.putImageData.mock.calls[0][0].data as Uint8ClampedArray
      expect(pixels[(17 * after.width + 13) * 4 + 3]).toBe(0)
      expect(pixels[((17 + addedHeight) * after.width + 13) * 4 + 3]).toBe(255)
      if (format === 'jpg') {
        expect(ctx.fillRect.mock.calls[0]).toEqual([0, 0, after.width, after.height])
      } else {
        expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, after.width, after.height)
      }
    }
  )

  it('centers the title over the complete image when the scale extends to the left', async () => {
    const options = renderOptions()
    options.colorScale = { position: [-40, -70] }
    const base = getColorfulMapExportSize(options)
    options.title = { main: { text: 'Title' }, padding: 0 }
    const result = await renderColorfulMapImage(options)
    const ctx = contexts.find((item) => item.canvas === result.canvas)!
    expect(result.width).toBe(base.width)
    expect(result.height).toBe(base.height + 24)
    expect(ctx.fillText.mock.calls.slice(-1)[0]).toEqual(['Title', result.width / 2, 12])
    expect(ctx.moveTo).toHaveBeenCalledWith(53, 3 + 24)
  })

  it('reserves the title height but draws no text when horizontal padding consumes the width', async () => {
    const options = renderOptions()
    options.title = { main: { text: 'Title' }, padding: [0, 1000] }
    const base = getColorfulMapExportSize({ ...options, title: undefined })
    const result = await renderColorfulMapImage(options)
    const ctx = contexts.find((item) => item.canvas === result.canvas)!
    expect(result.height).toBe(base.height + 24)
    expect(ctx.fillText.mock.calls.some(([text]) => text === 'Title')).toBe(false)
  })

  it('renders the title through OffscreenCanvas with the same measured layout', async () => {
    class TestOffscreenCanvas {
      constructor(public width: number, public height: number) {}
      getContext() {
        const ctx = createContext(this as unknown as HTMLCanvasElement)
        contexts.push(ctx)
        return ctx
      }
    }
    vi.stubGlobal('OffscreenCanvas', TestOffscreenCanvas)
    const options = renderOptions()
    options.title = { main: { text: 'Title' }, sub: { text: 'Subtitle' }, padding: 0 }
    options.preferOffscreenCanvas = true
    const size = getColorfulMapExportSize(options)
    const result = await renderColorfulMapImage(options)
    const ctx = contexts.find((item) => item.canvas === result.canvas)!
    expect(result.canvas).toBeInstanceOf(TestOffscreenCanvas)
    expect({ width: result.width, height: result.height, aspectRatio: result.aspectRatio }).toEqual(
      size
    )
    expect(ctx.fillText.mock.calls.slice(-2)).toEqual([
      ['Title', result.width / 2, 12],
      ['Subtitle', result.width / 2, 40],
    ])
  })

  it('uses default main/subtitle fonts and colors with an empty image array', async () => {
    const options = {
      ...renderOptions(),
      imageData: [],
      outputBounds: layoutOptions.imageData,
      title: { main: { text: 'Main' }, sub: { text: 'Sub' }, padding: 0 },
    }
    const result = await renderColorfulMapImage(options)
    const ctx = contexts.find((item) => item.canvas === result.canvas)!
    expect(ctx.textStyles.slice(-2)).toEqual([
      {
        text: 'Main',
        font: 'bold 24px Arial, sans-serif',
        color: '#1f2a36',
        align: 'center',
        baseline: 'middle',
      },
      {
        text: 'Sub',
        font: '16px Arial, sans-serif',
        color: '#566574',
        align: 'center',
        baseline: 'middle',
      },
    ])
  })

  it('uses the same measured layout for size and render and draws the scale last', async () => {
    const options = renderOptions()
    const size = getColorfulMapExportSize(options)
    contexts.length = 0
    const result = await renderColorfulMapImage(options)
    const ctx = contexts.find((item) => item.canvas === result.canvas)!
    expect({ width: result.width, height: result.height, aspectRatio: result.aspectRatio }).toEqual(
      size
    )
    expect(contexts).toHaveLength(2) // One measuring context, one output context.
    expect(ctx.moveTo).toHaveBeenCalledWith(13, 17)
    expect(ctx.lineTo).toHaveBeenCalledWith(113, 67) // Plot remains 100 by 50.
    expect(ctx.fillRect.mock.calls[0]).toEqual([123, 35, 12, 16])
    expect(ctx.fillText).toHaveBeenCalledWith('0', 143, 51)
    expect(ctx.fillText.mock.calls.slice(-3).map((call) => call[0])).toEqual(['0', '5', '10'])
    expect(ctx.fillRect.mock.invocationCallOrder[0]).toBeGreaterThan(
      ctx.stroke.mock.invocationCallOrder.slice(-1)[0]
    )
  })

  it('draws the end label on the top edge with the configured gap, even with the first label hidden', async () => {
    const options = renderOptions()
    options.colorScale = { endLabel: '10000 mm', showFirstLabel: false }
    const result = await renderColorfulMapImage(options)
    const ctx = contexts.find((item) => item.canvas === result.canvas)!
    expect(result.width).toBe(198)
    expect(result.height).toBe(78)
    expect(ctx.fillText.mock.calls.slice(-3).map((call) => call[0])).toEqual([
      '5',
      '10',
      '10000 mm',
    ])
    expect(ctx.fillText.mock.calls.slice(-1)[0]).toEqual(['10000 mm', 143, 9])
    const lastSwatch = ctx.fillRect.mock.calls.slice(-1)[0]
    expect(lastSwatch[1]).toBe(9)
  })

  it.each([true, false])(
    'centers labels within swatches and ignores endLabel with showFirstLabel: %s',
    async (showFirstLabel) => {
      const options = renderOptions()
      options.colorScale = {
        labelAlign: 'center',
        endLabel: 'This end label must be ignored',
        labels: ['Low', 'Medium', 'High'],
        showFirstLabel,
      }
      const size = getColorfulMapExportSize(options)
      const result = await renderColorfulMapImage(options)
      expect({
        width: result.width,
        height: result.height,
        aspectRatio: result.aspectRatio,
      }).toEqual(size)
      const ctx = contexts.find((item) => item.canvas === result.canvas)!
      const texts = ctx.fillText.mock.calls.slice(showFirstLabel ? -3 : -2)
      const swatches = ctx.fillRect.mock.calls
      expect(texts.map((call) => call[0])).toEqual(
        showFirstLabel ? ['Low', 'Medium', 'High'] : ['Medium', 'High']
      )
      texts.forEach((call, index) => {
        const swatch = swatches[index + (showFirstLabel ? 0 : 1)]
        expect(call[2]).toBe(swatch[1] + swatch[3] / 2)
      })
      expect(ctx.fillText.mock.calls.some((call) => call[0] === options.colorScale?.endLabel)).toBe(
        false
      )
    }
  )

  it('translates a negative scale position without shrinking the plot', async () => {
    const options = renderOptions()
    options.colorScale = { position: [-40, -70] }
    const result = await renderColorfulMapImage(options)
    const ctx = contexts.find((item) => item.canvas === result.canvas)!
    expect(result.width).toBe(160)
    expect(result.height).toBe(134)
    expect(ctx.moveTo).toHaveBeenCalledWith(53, 3)
    expect(ctx.lineTo).toHaveBeenCalledWith(153, 53)
    expect(ctx.fillRect.mock.calls[0]).toEqual([13, 101, 12, 16])
  })

  it('draws an overlapping scale above the texture, boundaries and axes', async () => {
    const options = renderOptions()
    options.boundaries = [
      {
        data: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [20, 10],
          ],
        },
      },
    ]
    options.colorScale = {
      position: [10, 10],
      blockHeight: 4,
      font: '4px sans-serif',
      showFirstLabel: false,
    }
    const result = await renderColorfulMapImage(options)
    const ctx = contexts.find((item) => item.canvas === result.canvas)!
    expect(result.width).toBe(120)
    expect(result.height).toBe(64)
    expect(ctx.fillRect.mock.calls[0]).toEqual([23, 39, 12, 4])
    expect(ctx.fillRect.mock.invocationCallOrder[0]).toBeGreaterThan(
      ctx.stroke.mock.invocationCallOrder.slice(-1)[0]
    )
    expect(ctx.fillText.mock.calls.slice(-2).map((call) => call[0])).toEqual(['5', '10'])
  })
})
