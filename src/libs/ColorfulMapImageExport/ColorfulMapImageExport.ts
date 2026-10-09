import type { Feature, Geometry, Position } from 'geojson'
import { unzlibSync } from 'fflate'
import type {
  ColorfulMapGeometry,
  ColorfulMapGeometryArray,
  ColorfulMapImageSource,
  ColorfulMapMargin,
  IColorRange,
  IColorfulMapAxesOptions,
  IColorfulMapBoundaryLabelOptions,
  IColorfulMapBoundaryLayer,
  IColorfulMapCutTexture,
  IColorfulMapExportSize,
  IColorfulMapGeoBounds,
  IColorfulMapImageExportOptions,
  IColorfulMapProjection,
  IColorfulMapOffscreenCanvas,
  IColorfulMapRenderResult,
  IGeoPoint,
  IScaleProps,
  IProjectedPoint,
} from './ColorfulMapImageExport.types'

const WEB_MERCATOR_MAX_LAT = 85.0511287798066
const DEFAULT_EXPORT_WIDTH = 1600
const DEFAULT_AXIS_COLOR = '#566574'
const DEFAULT_GRID_COLOR = '#aab6c2'
const DEFAULT_AXIS_MARGIN: [number, number, number, number] = [10, 10, 56, 56]
const DEFAULT_BOUNDARY_LABEL_FONT = '14px Arial, sans-serif'
const DEFAULT_BOUNDARY_LABEL_COLOR = '#1f2a36'

export const webMercatorProjection: IColorfulMapProjection = {
  id: 'EPSG:3857',
  forward(lon: number, lat: number): IProjectedPoint {
    const safeLat = clamp(lat, -WEB_MERCATOR_MAX_LAT, WEB_MERCATOR_MAX_LAT)
    const rad = (safeLat * Math.PI) / 180
    return {
      x: lon / 360 + 0.5,
      y: 0.5 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / (2 * Math.PI),
    }
  },
  inverse(x: number, y: number): IGeoPoint {
    const lon = (x - 0.5) * 360
    const rad = Math.atan(Math.sinh((0.5 - y) * Math.PI * 2))
    return { lon, lat: (rad * 180) / Math.PI }
  },
}

export function getColorfulMapExportSize(
  options: Pick<
    IColorfulMapImageExportOptions,
    'lonmin' | 'lonmax' | 'latmin' | 'latmax' | 'outputBounds' | 'axes' | 'projection'
  >
): IColorfulMapExportSize {
  const projection = options.projection || webMercatorProjection
  const outputBounds = getOutputBounds(options)
  const bounds = getProjectedBounds(
    projection,
    outputBounds.lonmin,
    outputBounds.lonmax,
    outputBounds.latmin,
    outputBounds.latmax
  )
  const projectedWidth = Math.max(Math.abs(bounds.maxX - bounds.minX), Number.EPSILON)
  const projectedHeight = Math.max(Math.abs(bounds.maxY - bounds.minY), Number.EPSILON)
  const aspectRatio = projectedWidth / projectedHeight

  const axes = normalizeAxes(options.axes)
  const [topMargin, rightMargin, bottomMargin, leftMargin] = axes.enabled
    ? expandMargin(axes.margin)
    : [0, 0, 0, 0]
  const plotWidth = Math.max(1, Math.round(finitePositive(axes.width) || DEFAULT_EXPORT_WIDTH))
  const plotHeight = Math.max(1, Math.round(plotWidth / aspectRatio))

  return {
    width: Math.max(1, Math.round(plotWidth + leftMargin + rightMargin)),
    height: Math.max(1, Math.round(plotHeight + topMargin + bottomMargin)),
    aspectRatio,
  }
}

export async function renderColorfulMapImage(
  options: IColorfulMapImageExportOptions
): Promise<IColorfulMapRenderResult> {
  throwIfAborted(options.signal)

  const format = normalizeFormat(options.format)
  const size = getColorfulMapExportSize(options)
  const projection = options.projection || webMercatorProjection
  const axes = normalizeAxes(options.axes)
  const canvas = createOutputCanvas(size.width, size.height, options.preferOffscreenCanvas)
  const ctx = get2dContext(canvas)

  if (format === 'jpg') {
    ctx.save()
    ctx.fillStyle = options.background || '#ffffff'
    ctx.fillRect(0, 0, size.width, size.height)
    ctx.restore()
  } else {
    ctx.clearRect(0, 0, size.width, size.height)
  }

  const plot = fitPlotRect(size.width, size.height, axes)
  const outputBounds = getOutputBounds(options)
  const projectedBounds = getProjectedBounds(
    projection,
    outputBounds.lonmin,
    outputBounds.lonmax,
    outputBounds.latmin,
    outputBounds.latmax
  )
  const source = await readImageData(options.image, options.signal)
  const cut = options.cut ? await readCutTexture(options.cut, options.signal) : null

  drawTexture(ctx, {
    source,
    cut,
    options,
    projection,
    projectedBounds,
    plot,
  })

  drawBoundaries(ctx, options.boundaries || [], projection, projectedBounds, plot)
  if (axes.enabled) {
    drawAxes(
      ctx,
      axes,
      projection,
      projectedBounds,
      plot,
      outputBounds.lonmin,
      outputBounds.lonmax,
      outputBounds.latmin,
      outputBounds.latmax
    )
  }

  return {
    canvas,
    width: size.width,
    height: size.height,
    aspectRatio: size.aspectRatio,
  }
}

export async function exportColorfulMapImage(
  options: IColorfulMapImageExportOptions
): Promise<Blob> {
  const result = await renderColorfulMapImage(options)
  const type = normalizeFormat(options.format) === 'jpg' ? 'image/jpeg' : 'image/png'
  const quality = options.quality === undefined ? undefined : clamp(options.quality, 0, 1)
  const canvas = result.canvas

  return canvasToBlob(canvas, type, quality)
}

export async function colorfulMapImageToDataUrl(
  options: IColorfulMapImageExportOptions
): Promise<string> {
  const result = await renderColorfulMapImage(options)
  const type = normalizeFormat(options.format) === 'jpg' ? 'image/jpeg' : 'image/png'
  const quality = options.quality === undefined ? undefined : clamp(options.quality, 0, 1)
  const canvas = result.canvas

  if (isHtmlCanvas(canvas)) return canvas.toDataURL(type, quality)

  const blob = await canvasToBlob(canvas, type, quality)
  return blobToDataUrl(blob)
}

function canvasToBlob(
  canvas: HTMLCanvasElement | IColorfulMapOffscreenCanvas,
  type: string,
  quality?: number
): Promise<Blob> {
  if (isHtmlCanvas(canvas)) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas export returned an empty Blob.'))
        },
        type,
        quality
      )
    })
  }

  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type, ...(quality === undefined ? {} : { quality }) })
  }

  return Promise.reject(
    new Error('The current canvas implementation does not support Blob export.')
  )
}

interface TextureRenderContext {
  source: ImageData
  cut: ImageDataWithExtent | null
  options: IColorfulMapImageExportOptions
  projection: IColorfulMapProjection
  projectedBounds: ProjectedBounds
  plot: PlotRect
}

interface ImageDataWithExtent {
  image: ImageData
  extent: IColorfulMapCutTexture
}

interface ProjectedBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface PlotRect {
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
}

function getOutputBounds(
  options: Pick<
    IColorfulMapImageExportOptions,
    'lonmin' | 'lonmax' | 'latmin' | 'latmax' | 'outputBounds'
  >
): IColorfulMapGeoBounds {
  return (
    options.outputBounds || {
      lonmin: options.lonmin,
      lonmax: options.lonmax,
      latmin: options.latmin,
      latmax: options.latmax,
    }
  )
}

function drawTexture(ctx: CanvasRenderingContext2D, params: TextureRenderContext): void {
  const { source, cut, options, projection, projectedBounds, plot } = params
  const isJpg = normalizeFormat(options.format) === 'jpg'
  const background = parseColor(options.background || '#ffffff')
  const output = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const outputWidth = ctx.canvas.width
  const outputPixels = output.data
  const linear = clamp(options.linear ?? 0, 0, 1)
  const flipY = Boolean(options.flipy)
  const useNearest = Boolean(options.grid)
  const lonRange = options.lonmax - options.lonmin
  const latRange = options.latmax - options.latmin

  for (let py = plot.top; py < plot.bottom; py += 1) {
    const projectedY =
      projectedBounds.minY +
      ((py - plot.top + 0.5) / plot.height) * (projectedBounds.maxY - projectedBounds.minY)
    for (let px = plot.left; px < plot.right; px += 1) {
      throwIfAborted(options.signal)
      const projectedX =
        projectedBounds.minX +
        ((px - plot.left + 0.5) / plot.width) * (projectedBounds.maxX - projectedBounds.minX)
      const geo = projection.inverse(projectedX, projectedY)
      const lonRatio = lonRange === 0 ? 0 : (geo.lon - options.lonmin) / lonRange
      const latRatio = latRange === 0 ? 0 : (geo.lat - options.latmin) / latRange
      if (lonRatio < 0 || lonRatio > 1 || latRatio < 0 || latRatio > 1) continue

      if (cut && shouldDiscardByCut(cut, geo.lon, geo.lat)) continue

      const textureX = clamp(lonRatio, 0, 1) * (source.width - 1)
      const textureY =
        (flipY ? 1 - clamp(latRatio, 0, 1) : clamp(latRatio, 0, 1)) * (source.height - 1)
      const rgba = sampleImageData(source, textureX, textureY, useNearest)
      const value = decodeValue(rgba, options.scale)
      const color = colorForValue(value, options.colors, linear)
      let alpha = color[3]
      if (options.minOpacity) alpha *= minimumOpacity(value, options.colors, options.minOpacityMode)

      const offset = (py * outputWidth + px) * 4
      if (isJpg) {
        const opacity = clamp(alpha / 255, 0, 1)
        outputPixels[offset] = Math.round(color[0] * opacity + background[0] * (1 - opacity))
        outputPixels[offset + 1] = Math.round(color[1] * opacity + background[1] * (1 - opacity))
        outputPixels[offset + 2] = Math.round(color[2] * opacity + background[2] * (1 - opacity))
        outputPixels[offset + 3] = 255
      } else {
        outputPixels[offset] = color[0]
        outputPixels[offset + 1] = color[1]
        outputPixels[offset + 2] = color[2]
        outputPixels[offset + 3] = Math.round(alpha)
      }
    }
  }

  ctx.putImageData(output, 0, 0)
}

function drawBoundaries(
  ctx: CanvasRenderingContext2D,
  layers: IColorfulMapBoundaryLayer[],
  projection: IColorfulMapProjection,
  projectedBounds: ProjectedBounds,
  plot: PlotRect
): void {
  if (!layers.length) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(plot.left, plot.top, plot.width, plot.height)
  ctx.clip()

  for (const layer of layers) {
    ctx.save()
    ctx.globalAlpha = clamp(layer.opacity ?? 1, 0, 1)
    ctx.strokeStyle = layer.color || '#7a3f54'
    ctx.lineWidth = Math.max(0.1, layer.lineWidth ?? 1.5)
    ctx.lineJoin = layer.lineJoin || 'round'
    ctx.lineCap = layer.lineCap || 'round'
    ctx.setLineDash(layer.dash || [])
    ctx.lineDashOffset = layer.dashOffset || 0
    ctx.beginPath()
    appendGeoJsonPath(ctx, layer.data, projection, projectedBounds, plot)
    ctx.stroke()

    const label = normalizeBoundaryLabel(layer.label)
    if (label) drawBoundaryLabels(ctx, layer, label, projection, projectedBounds, plot)

    ctx.restore()
  }

  ctx.restore()
}

function drawBoundaryLabels(
  ctx: CanvasRenderingContext2D,
  layer: IColorfulMapBoundaryLayer,
  label: Required<IColorfulMapBoundaryLabelOptions>,
  projection: IColorfulMapProjection,
  projectedBounds: ProjectedBounds,
  plot: PlotRect
): void {
  ctx.save()
  ctx.fillStyle = label.color
  ctx.font = label.font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.setLineDash([])

  const labelMap = label.labelMap
  forEachGeoJsonFeature(layer.data, (feature) => {
    const name = readFeatureName(feature)
    const center = readFeatureCenter(feature)
    if (!name || !center) return
    const point = projectedToPixel(projection.forward(center[0], center[1]), projectedBounds, plot)
    ctx.fillText(labelMap[name] || name, point.x, point.y)
  })

  ctx.restore()
}

function forEachGeoJsonFeature(
  input: ColorfulMapGeometryArray,
  callback: (feature: Feature<Geometry | null>) => void
): void {
  if (Array.isArray(input)) {
    for (const item of input) forEachGeoJsonFeature(item, callback)
    return
  }

  if (!input) return

  if (input.type === 'FeatureCollection') {
    for (const feature of input.features) forEachGeoJsonFeature(feature, callback)
    return
  }

  if (input.type === 'Feature') callback(input)
}

function readFeatureName(feature: Feature<Geometry | null>): string | null {
  const name = (feature.properties as Record<string, unknown> | null | undefined)?.name
  return typeof name === 'string' && name.trim() ? name : null
}

function readFeatureCenter(feature: Feature<Geometry | null>): Position | null {
  const center = (feature.properties as Record<string, unknown> | null | undefined)?.centroid
  return Array.isArray(center) &&
    center.length >= 2 &&
    Number.isFinite(center[0]) &&
    Number.isFinite(center[1])
    ? (center as Position)
    : null
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  axes: Required<IColorfulMapAxesOptions>,
  projection: IColorfulMapProjection,
  projectedBounds: ProjectedBounds,
  plot: PlotRect,
  lonmin: number,
  lonmax: number,
  latmin: number,
  latmax: number
): void {
  const lonStep = axes.lonStep || chooseTickStep(lonmax - lonmin)
  const latStep = axes.latStep || chooseTickStep(latmax - latmin)
  const longitudeTicks = makeAxisTicks(lonmin, lonmax, lonStep)
  const latitudeTicks = makeAxisTicks(latmin, latmax, latStep)

  ctx.save()
  ctx.strokeStyle = axes.color
  ctx.fillStyle = axes.labelColor
  ctx.lineWidth = axes.lineWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.font = axes.labelFont
  ctx.setLineDash([])

  ctx.beginPath()
  ctx.moveTo(plot.left, plot.top)
  ctx.lineTo(plot.left, plot.bottom)
  ctx.lineTo(plot.right, plot.bottom)
  ctx.stroke()

  for (let index = 0; index < longitudeTicks.length; index += 1) {
    const lon = longitudeTicks[index]
    const point = projectedToPixel(projection.forward(lon, latmin), projectedBounds, plot)
    const isRoundedEdge = index === 0 || index === longitudeTicks.length - 1
    if (!isRoundedEdge && (point.x < plot.left - 1 || point.x > plot.right + 1)) continue
    const x = clamp(point.x, plot.left, plot.right)
    if (axes.showGrid) {
      ctx.save()
      ctx.strokeStyle = axes.gridColor
      ctx.lineWidth = axes.gridLineWidth
      ctx.setLineDash(axes.gridDash)
      ctx.beginPath()
      ctx.moveTo(x, plot.top)
      ctx.lineTo(x, plot.bottom)
      ctx.stroke()
      ctx.restore()
    }
    ctx.strokeStyle = axes.color
    ctx.lineWidth = axes.lineWidth
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(x, plot.bottom)
    ctx.lineTo(x, plot.bottom + axes.tickLength)
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(formatLongitude(lon), x, plot.bottom + axes.tickLength + axes.labelPadding)
  }

  for (let index = 0; index < latitudeTicks.length; index += 1) {
    const lat = latitudeTicks[index]
    const point = projectedToPixel(projection.forward(lonmin, lat), projectedBounds, plot)
    const isRoundedEdge = index === 0 || index === latitudeTicks.length - 1
    if (!isRoundedEdge && (point.y < plot.top - 1 || point.y > plot.bottom + 1)) continue
    const y = clamp(point.y, plot.top, plot.bottom)
    if (axes.showGrid) {
      ctx.save()
      ctx.strokeStyle = axes.gridColor
      ctx.lineWidth = axes.gridLineWidth
      ctx.setLineDash(axes.gridDash)
      ctx.beginPath()
      ctx.moveTo(plot.left, y)
      ctx.lineTo(plot.right, y)
      ctx.stroke()
      ctx.restore()
    }
    ctx.strokeStyle = axes.color
    ctx.lineWidth = axes.lineWidth
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(plot.left, y)
    ctx.lineTo(plot.left - axes.tickLength, y)
    ctx.stroke()
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatLatitude(lat), plot.left - axes.tickLength - axes.labelPadding, y)
  }

  ctx.restore()
}

function appendGeoJsonPath(
  ctx: CanvasRenderingContext2D,
  input: ColorfulMapGeometryArray,
  projection: IColorfulMapProjection,
  projectedBounds: ProjectedBounds,
  plot: PlotRect
): void {
  if (Array.isArray(input)) {
    for (const item of input) appendGeoJsonPath(ctx, item, projection, projectedBounds, plot)
    return
  }

  if (!input) return

  if (input.type === 'FeatureCollection') {
    for (const feature of input.features)
      appendGeoJsonPath(ctx, feature, projection, projectedBounds, plot)
    return
  }

  if (input.type === 'Feature') {
    if (input.geometry) appendGeoJsonPath(ctx, input.geometry, projection, projectedBounds, plot)
    return
  }

  if (input.type === 'GeometryCollection') {
    for (const geometry of input.geometries)
      appendGeoJsonPath(ctx, geometry, projection, projectedBounds, plot)
    return
  }

  if (input.type === 'LineString') {
    appendLine(ctx, input.coordinates, projection, projectedBounds, plot, false)
    return
  }

  if (input.type === 'MultiLineString') {
    for (const line of input.coordinates)
      appendLine(ctx, line, projection, projectedBounds, plot, false)
    return
  }

  if (input.type === 'Polygon') {
    for (const ring of input.coordinates)
      appendLine(ctx, ring, projection, projectedBounds, plot, true)
    return
  }

  if (input.type === 'MultiPolygon') {
    for (const polygon of input.coordinates) {
      for (const ring of polygon) appendLine(ctx, ring, projection, projectedBounds, plot, true)
    }
  }
}

function appendLine(
  ctx: CanvasRenderingContext2D,
  coordinates: Position[],
  projection: IColorfulMapProjection,
  projectedBounds: ProjectedBounds,
  plot: PlotRect,
  close: boolean
): void {
  if (!coordinates.length) return
  const first = projectedToPixel(
    projection.forward(coordinates[0][0], coordinates[0][1]),
    projectedBounds,
    plot
  )
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < coordinates.length; i += 1) {
    const coordinate = coordinates[i]
    const point = projectedToPixel(
      projection.forward(coordinate[0], coordinate[1]),
      projectedBounds,
      plot
    )
    ctx.lineTo(point.x, point.y)
  }
  if (close) ctx.closePath()
}

function projectedToPixel(
  point: IProjectedPoint,
  bounds: ProjectedBounds,
  plot: PlotRect
): IProjectedPoint {
  return {
    x: plot.left + ((point.x - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * plot.width,
    y: plot.top + ((point.y - bounds.minY) / (bounds.maxY - bounds.minY || 1)) * plot.height,
  }
}

async function readCutTexture(
  cut: IColorfulMapCutTexture,
  signal?: AbortSignal
): Promise<ImageDataWithExtent> {
  return { image: await readImageData(cut.image, signal), extent: cut }
}

function shouldDiscardByCut(cut: ImageDataWithExtent, lon: number, lat: number): boolean {
  const { extent, image } = cut
  const lonRange = extent.lonmax - extent.lonmin
  const latRange = extent.latmax - extent.latmin
  const xRatio = lonRange === 0 ? 0 : (lon - extent.lonmin) / lonRange
  const yRatio = latRange === 0 ? 0 : (lat - extent.latmin) / latRange

  if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1)
    return (extent.outside || 'discard') === 'discard'

  const pixel = sampleImageData(
    image,
    xRatio * (image.width - 1),
    (1 - yRatio) * (image.height - 1),
    true
  )
  return pixel[0] / 255 >= (extent.threshold ?? 0.5)
}

async function readImageData(
  source: ColorfulMapImageSource,
  signal?: AbortSignal
): Promise<ImageData> {
  throwIfAborted(signal)
  if (isImageData(source)) return source

  let resolved: CanvasImageSource
  let ownedBitmap: ImageBitmap | null = null
  if (typeof source === 'string') {
    const response = await fetch(source, { signal })
    if (!response.ok)
      throw new Error(`Failed to load texture: ${response.status} ${response.statusText}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    const rawPng = tryDecodePng(bytes)
    if (rawPng) return rawPng

    const blob = new Blob([bytes], { type: response.headers.get('content-type') || 'image/png' })
    if (typeof createImageBitmap === 'function') {
      ownedBitmap = await createImageBitmap(blob)
      resolved = ownedBitmap
    } else {
      resolved = await loadHtmlImage(URL.createObjectURL(blob))
    }
  } else {
    resolved = source as CanvasImageSource
  }

  const dimensions = getSourceDimensions(resolved)
  const canvas = createOutputCanvas(dimensions.width, dimensions.height, false)
  const ctx = get2dContext(canvas, true)
  ctx.clearRect(0, 0, dimensions.width, dimensions.height)
  ctx.drawImage(resolved as CanvasImageSource, 0, 0, dimensions.width, dimensions.height)
  const image = ctx.getImageData(0, 0, dimensions.width, dimensions.height)
  ownedBitmap?.close()
  return image
}

function tryDecodePng(bytes: Uint8Array): ImageData | null {
  try {
    return decodePng(bytes)
  } catch {
    return null
  }
}

function decodePng(bytes: Uint8Array): ImageData {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length < 8 || !signature.every((value, index) => bytes[index] === value)) {
    throw new Error('Not a PNG image.')
  }

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlaceMethod = 0
  const idat: Uint8Array[] = []

  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset)
    const type = readAscii(bytes, offset + 4)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > bytes.length) throw new Error('Invalid PNG chunk.')
    const data = bytes.subarray(dataStart, dataEnd)
    offset = dataEnd + 4

    if (type === 'IHDR') {
      width = readUint32(data, 0)
      height = readUint32(data, 4)
      bitDepth = data[8]
      colorType = data[9]
      interlaceMethod = data[12]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
  }

  const channelCount =
    colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 6 ? 4 : 0
  if (
    !width ||
    !height ||
    bitDepth !== 8 ||
    !channelCount ||
    interlaceMethod !== 0 ||
    !idat.length
  ) {
    throw new Error('Unsupported PNG pixel format.')
  }

  const compressed = concatBytes(idat)
  const filtered = unzlibSync(compressed)
  const bytesPerPixel = channelCount
  const rowBytes = width * bytesPerPixel
  const expectedLength = height * (rowBytes + 1)
  if (filtered.length < expectedLength) throw new Error('Invalid PNG image data.')

  const rows: Uint8Array[] = []
  const rgba = new Uint8ClampedArray(width * height * 4)
  let sourceOffset = 0
  let previous = new Uint8Array(rowBytes)

  for (let y = 0; y < height; y += 1) {
    const filterType = filtered[sourceOffset]
    sourceOffset += 1
    const encoded = filtered.subarray(sourceOffset, sourceOffset + rowBytes)
    sourceOffset += rowBytes
    const row = new Uint8Array(rowBytes)
    for (let index = 0; index < rowBytes; index += 1) {
      const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0
      const up = previous[index]
      const upperLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0
      row[index] = undoPngFilter(filterType, encoded[index], left, up, upperLeft)
    }
    rows.push(row)
    previous = row
  }

  for (let y = 0; y < height; y += 1) {
    const row = rows[y]
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = x * bytesPerPixel
      const targetIndex = (y * width + x) * 4
      if (colorType === 6) {
        rgba[targetIndex] = row[sourceIndex]
        rgba[targetIndex + 1] = row[sourceIndex + 1]
        rgba[targetIndex + 2] = row[sourceIndex + 2]
        rgba[targetIndex + 3] = row[sourceIndex + 3]
      } else if (colorType === 4) {
        rgba[targetIndex] = row[sourceIndex]
        rgba[targetIndex + 1] = row[sourceIndex]
        rgba[targetIndex + 2] = row[sourceIndex]
        rgba[targetIndex + 3] = row[sourceIndex + 1]
      } else if (colorType === 2) {
        rgba[targetIndex] = row[sourceIndex]
        rgba[targetIndex + 1] = row[sourceIndex + 1]
        rgba[targetIndex + 2] = row[sourceIndex + 2]
        rgba[targetIndex + 3] = 255
      } else {
        rgba[targetIndex] = row[sourceIndex]
        rgba[targetIndex + 1] = row[sourceIndex]
        rgba[targetIndex + 2] = row[sourceIndex]
        rgba[targetIndex + 3] = 255
      }
    }
  }

  return { data: rgba, width, height } as ImageData
}

function undoPngFilter(
  filterType: number,
  value: number,
  left: number,
  up: number,
  upperLeft: number
): number {
  if (filterType === 0) return value
  if (filterType === 1) return (value + left) & 255
  if (filterType === 2) return (value + up) & 255
  if (filterType === 3) return (value + Math.floor((left + up) / 2)) & 255
  if (filterType === 4) {
    const estimate = left + up - upperLeft
    const leftDistance = Math.abs(estimate - left)
    const upDistance = Math.abs(estimate - up)
    const upperLeftDistance = Math.abs(estimate - upperLeft)
    const predictor =
      leftDistance <= upDistance && leftDistance <= upperLeftDistance
        ? left
        : upDistance <= upperLeftDistance
        ? up
        : upperLeft
    return (value + predictor) & 255
  }
  throw new Error('Unsupported PNG filter.')
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  )
}

function readAscii(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  if (typeof Image === 'undefined') throw new Error('The current runtime cannot load image URLs.')
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to decode texture image.'))
    }
    image.src = url
  })
}

function getSourceDimensions(source: CanvasImageSource): { width: number; height: number } {
  const width =
    'naturalWidth' in source && source.naturalWidth
      ? source.naturalWidth
      : readDimension(source.width)
  const height =
    'naturalHeight' in source && source.naturalHeight
      ? source.naturalHeight
      : readDimension(source.height)
  if (!width || !height) throw new Error('Texture source has no usable dimensions.')
  return { width, height }
}

function sampleImageData(
  image: ImageData,
  x: number,
  y: number,
  nearest: boolean
): [number, number, number, number] {
  if (nearest) {
    const ix = clamp(Math.round(x), 0, image.width - 1)
    const iy = clamp(Math.round(y), 0, image.height - 1)
    return readPixel(image, ix, iy)
  }

  const x0 = clamp(Math.floor(x), 0, image.width - 1)
  const y0 = clamp(Math.floor(y), 0, image.height - 1)
  const x1 = clamp(x0 + 1, 0, image.width - 1)
  const y1 = clamp(y0 + 1, 0, image.height - 1)
  const tx = clamp(x - x0, 0, 1)
  const ty = clamp(y - y0, 0, 1)
  const a = readPixel(image, x0, y0)
  const b = readPixel(image, x1, y0)
  const c = readPixel(image, x0, y1)
  const d = readPixel(image, x1, y1)
  return [0, 1, 2, 3].map((channel) =>
    Math.round(lerp(lerp(a[channel], b[channel], tx), lerp(c[channel], d[channel], tx), ty))
  ) as [number, number, number, number]
}

function readPixel(image: ImageData, x: number, y: number): [number, number, number, number] {
  const offset = (y * image.width + x) * 4
  return [
    image.data[offset],
    image.data[offset + 1],
    image.data[offset + 2],
    image.data[offset + 3],
  ]
}

function decodeValue(pixel: [number, number, number, number], scale: IScaleProps): number {
  return (
    safeDivide(pixel[0], scale.r) +
    safeDivide(pixel[1], scale.g) +
    safeDivide(pixel[2], scale.b) +
    safeDivide(pixel[3], scale.a)
  )
}

function colorForValue(
  value: number,
  colors: IColorRange,
  linear: number
): [number, number, number, number] {
  const count = Math.min(colors.r.length, colors.g.length, colors.b.length, colors.v.length)
  if (!count) return [0, 0, 0, 0]
  if (count === 1 || value <= colors.v[0]) return colorAt(colors, 0)
  if (value >= colors.v[count - 1]) return colorAt(colors, count - 1)

  for (let i = 0; i < count - 1; i += 1) {
    const v0 = colors.v[i]
    const v1 = colors.v[i + 1]
    if (value > v1) continue
    const transitionStart = v1 - (v1 - v0) * linear
    if (value <= transitionStart || transitionStart >= v1) return colorAt(colors, i)
    const t = (value - transitionStart) / (v1 - transitionStart || 1)
    return lerpColor(colorAt(colors, i), colorAt(colors, i + 1), t)
  }

  return colorAt(colors, count - 1)
}

function colorAt(colors: IColorRange, index: number): [number, number, number, number] {
  const opacity =
    colors.o[index] === undefined
      ? 1
      : colors.o[index] > 1
      ? colors.o[index] / 255
      : colors.o[index]
  return [
    clamp(colors.r[index] || 0, 0, 255),
    clamp(colors.g[index] || 0, 0, 255),
    clamp(colors.b[index] || 0, 0, 255),
    clamp(opacity, 0, 1) * 255,
  ]
}

function lerpColor(
  a: [number, number, number, number],
  b: [number, number, number, number],
  t: number
): [number, number, number, number] {
  return [0, 1, 2, 3].map((channel) => Math.round(lerp(a[channel], b[channel], t))) as [
    number,
    number,
    number,
    number
  ]
}

function minimumOpacity(
  value: number,
  colors: IColorRange,
  mode: 'smooth' | 'linear' = 'smooth'
): number {
  const minValue = colors.v[0] || 0
  if (mode === 'linear') return clamp((value - minValue * 0.8) / Math.max(minValue * 0.5, 1), 0, 1)
  return smoothstep(minValue * 0.5, minValue * 2, value)
}

function normalizeAxes(input?: IColorfulMapAxesOptions): Required<IColorfulMapAxesOptions> {
  return {
    enabled: input?.enabled ?? true,
    width: input?.width ?? DEFAULT_EXPORT_WIDTH,
    lonStep: input?.lonStep || 0,
    latStep: input?.latStep || 0,
    color: input?.color || DEFAULT_AXIS_COLOR,
    lineWidth: input?.lineWidth || 1,
    tickLength: input?.tickLength || 6,
    labelFont: input?.labelFont || '14px Arial, sans-serif',
    labelColor: input?.labelColor || DEFAULT_AXIS_COLOR,
    labelPadding: input?.labelPadding || 6,
    margin: input?.margin ?? DEFAULT_AXIS_MARGIN,
    showGrid: input?.showGrid ?? false,
    gridColor: input?.gridColor || DEFAULT_GRID_COLOR,
    gridLineWidth: input?.gridLineWidth || 1,
    gridDash: input?.gridDash || [4, 4],
  }
}

function normalizeBoundaryLabel(
  input?: IColorfulMapBoundaryLabelOptions
): Required<IColorfulMapBoundaryLabelOptions> | null {
  if (!input || !(input.enabled ?? true)) return null
  return {
    enabled: true,
    font: input.font || DEFAULT_BOUNDARY_LABEL_FONT,
    color: input.color || DEFAULT_BOUNDARY_LABEL_COLOR,
    labelMap: input.labelMap || {},
  }
}

function fitPlotRect(
  width: number,
  height: number,
  axes: Required<IColorfulMapAxesOptions>
): PlotRect {
  const [topMargin, rightMargin, bottomMargin, leftMargin] = axes.enabled
    ? expandMargin(axes.margin)
    : [0, 0, 0, 0]
  const plotWidth = Math.max(1, width - leftMargin - rightMargin)
  const plotHeight = Math.max(1, height - topMargin - bottomMargin)
  return {
    left: leftMargin,
    top: topMargin,
    width: plotWidth,
    height: plotHeight,
    right: leftMargin + plotWidth,
    bottom: topMargin + plotHeight,
  }
}

function expandMargin(margin: ColorfulMapMargin): [number, number, number, number] {
  if (typeof margin === 'number') return [margin, margin, margin, margin]
  if (margin.length === 2) return [margin[0], margin[1], margin[0], margin[1]]
  if (margin.length === 4) return margin
  return [0, 0, 0, 0]
}

function getProjectedBounds(
  projection: IColorfulMapProjection,
  lonmin: number,
  lonmax: number,
  latmin: number,
  latmax: number
): ProjectedBounds {
  const points: IProjectedPoint[] = []
  const samples = 16
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples
    const lon = lonmin + (lonmax - lonmin) * t
    const lat = latmin + (latmax - latmin) * t
    points.push(projection.forward(lon, lat))
    points.push(projection.forward(lon, latmin))
    points.push(projection.forward(lon, latmax))
  }
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}

function createOutputCanvas(
  width: number,
  height: number,
  preferOffscreen = false
): HTMLCanvasElement | IColorfulMapOffscreenCanvas {
  const offscreenConstructor = (
    globalThis as typeof globalThis & {
      OffscreenCanvas?: new (width: number, height: number) => IColorfulMapOffscreenCanvas
    }
  ).OffscreenCanvas
  if (preferOffscreen && offscreenConstructor) return new offscreenConstructor(width, height)
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }
  if (offscreenConstructor) return new offscreenConstructor(width, height)
  throw new Error('Canvas rendering is unavailable in this runtime.')
}

function get2dContext(
  canvas: HTMLCanvasElement | IColorfulMapOffscreenCanvas,
  readFrequently = false
): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', readFrequently ? { willReadFrequently: true } : undefined)
  if (!context) throw new Error('2D canvas context is unavailable.')
  return context as CanvasRenderingContext2D
}

function isHtmlCanvas(
  canvas: HTMLCanvasElement | IColorfulMapOffscreenCanvas
): canvas is HTMLCanvasElement {
  return typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement
}

function isImageData(source: ColorfulMapImageSource): source is ImageData {
  return typeof ImageData !== 'undefined' && source instanceof ImageData
}

function normalizeFormat(format?: IColorfulMapImageExportOptions['format']): 'png' | 'jpg' {
  return format === 'jpg' || format === 'jpeg' ? 'jpg' : 'png'
}

function chooseTickStep(range: number): number {
  const rough = Math.abs(range) / 6
  if (!rough) return 1
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return factor * magnitude
}

function makeAxisTicks(min: number, max: number, step: number): number[] {
  const safeStep = Math.abs(step) || 1
  const epsilon = safeStep * 1e-9
  const ticks = [min]
  const start = Math.ceil(min / safeStep - 1e-9) * safeStep
  const end = Math.floor(max / safeStep + 1e-9) * safeStep
  for (let value = start; value <= end + epsilon; value += safeStep) {
    const rounded = Number(value.toFixed(10))
    if (rounded > min + epsilon && rounded < max - epsilon) ticks.push(rounded)
  }
  if (max > min + epsilon) ticks.push(max)
  return ticks
}

function formatLongitude(value: number): string {
  if (Math.abs(value) < 1e-9) return '0°'
  return `${formatCoordinateValue(value)}°${value > 0 ? 'E' : 'W'}`
}

function formatLatitude(value: number): string {
  if (Math.abs(value) < 1e-9) return '0°'
  return `${formatCoordinateValue(value)}°${value > 0 ? 'N' : 'S'}`
}

function formatCoordinateValue(value: number): string {
  return Number.isInteger(value)
    ? String(Math.abs(value))
    : String(Math.abs(Number(value.toFixed(4))))
}

function readDimension(value: unknown): number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'baseVal' in value) {
    const baseValue = (value as { baseVal?: { value?: number } }).baseVal?.value
    if (typeof baseValue === 'number') return baseValue
  }
  return 0
}

function parseColor(value: string): [number, number, number] {
  const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) {
    const raw =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map((item) => item + item)
            .join('')
        : hex[1]
    return [
      parseInt(raw.slice(0, 2), 16),
      parseInt(raw.slice(2, 4), 16),
      parseInt(raw.slice(4, 6), 16),
    ]
  }
  const rgb = value.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (rgb) {
    return [
      clamp(Number(rgb[1]), 0, 255),
      clamp(Number(rgb[2]), 0, 255),
      clamp(Number(rgb[3]), 0, 255),
    ]
  }
  if (value.trim().toLowerCase() === 'black') return [0, 0, 0]
  return [255, 255, 255]
}

function finitePositive(value?: number): number | null {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : null
}

function safeDivide(value: number, divisor: number): number {
  return divisor === 0 ? 0 : value / divisor
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0 || 1), 0, 1)
  return t * t * (3 - 2 * t)
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The export was aborted.', 'AbortError')
}

function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader === 'undefined')
    throw new Error('Data URL conversion is unavailable in this runtime.')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error('Failed to convert Blob to data URL.'))
    reader.readAsDataURL(blob)
  })
}

export type { IColorRange, IScaleProps }
export type {
  ColorfulMapGeometry,
  ColorfulMapGeometryArray,
  ColorfulMapImageSource,
  ColorfulMapMargin,
  IColorfulMapAxesOptions,
  IColorfulMapBoundaryLabelOptions,
  IColorfulMapBoundaryLayer,
  IColorfulMapCutTexture,
  IColorfulMapExportSize,
  IColorfulMapImageExportOptions,
  IColorfulMapProjection,
  IColorfulMapOffscreenCanvas,
  IColorfulMapRenderResult,
}
