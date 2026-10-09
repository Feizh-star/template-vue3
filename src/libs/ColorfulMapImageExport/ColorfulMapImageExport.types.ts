import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeometryCollection,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
} from 'geojson'
export interface IColorRange {
  r: number[]
  g: number[]
  b: number[]
  v: number[]
  o: number[]
}

export interface IScaleProps {
  r: number
  g: number
  b: number
  a: number
}

export interface IProjectedPoint {
  x: number
  y: number
}

export interface IGeoPoint {
  lon: number
  lat: number
}

export interface IColorfulMapGeoBounds {
  lonmin: number
  lonmax: number
  latmin: number
  latmax: number
}

/** Projection contract used by the renderer. The default is EPSG:3857. */
export interface IColorfulMapProjection {
  readonly id: string
  forward(lon: number, lat: number): IProjectedPoint
  inverse(x: number, y: number): IGeoPoint
}

/** Minimal structural type for runtimes whose TypeScript lib lacks OffscreenCanvas. */
export interface IColorfulMapOffscreenCanvas {
  width: number
  height: number
  getContext(contextId: '2d', options?: unknown): any
  convertToBlob(options?: { type?: string; quality?: number }): Promise<Blob>
}

export type ColorfulMapGeometry =
  | Geometry
  | Feature<Geometry | null>
  | FeatureCollection<Geometry | null>
  | GeometryCollection

export type ColorfulMapGeometryArray = ColorfulMapGeometry | ColorfulMapGeometry[]

/** Draws each feature's name (properties.name) at properties.center. */
export interface IColorfulMapBoundaryLabelOptions {
  /** Defaults to true when this option object is provided. */
  enabled?: boolean
  font?: string
  color?: string
  labelMap?: Record<string, string>
}

export interface IColorfulMapBoundaryLayer {
  data: ColorfulMapGeometryArray
  color?: string
  lineWidth?: number
  lineJoin?: CanvasLineJoin
  lineCap?: CanvasLineCap
  dash?: number[]
  dashOffset?: number
  opacity?: number
  label?: IColorfulMapBoundaryLabelOptions
}

export type ColorfulMapMargin = number | [number, number] | [number, number, number, number]

export interface IColorfulMapCutTexture {
  image: ColorfulMapImageSource
  lonmin: number
  lonmax: number
  latmin: number
  latmax: number
  /** The mask value at or above this threshold is discarded. */
  threshold?: number
  /** Pixels outside this texture extent are discarded by default. */
  outside?: 'discard' | 'keep'
}

export interface IColorfulMapAxesOptions {
  enabled?: boolean
  /** Coordinate plot width in pixels. Defaults to 1600. */
  width?: number
  lonStep?: number
  latStep?: number
  color?: string
  lineWidth?: number
  tickLength?: number
  labelFont?: string
  labelColor?: string
  labelPadding?: number
  margin?: ColorfulMapMargin
  showGrid?: boolean
  gridColor?: string
  gridLineWidth?: number
  gridDash?: number[]
}

export type ColorfulMapImageSource =
  | string
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap
  | IColorfulMapOffscreenCanvas
  | ImageData

export type ColorfulMapWorkerImageSource = string | ImageBitmap | ImageData

export interface IColorfulMapImageExportOptions {
  image: ColorfulMapImageSource
  lonmin: number
  lonmax: number
  latmin: number
  latmax: number
  outputBounds?: IColorfulMapGeoBounds
  scale: IScaleProps
  colors: IColorRange
  format?: 'png' | 'jpg' | 'jpeg'
  quality?: number
  flipy?: 0 | 1 | boolean
  grid?: boolean
  linear?: number
  minOpacity?: boolean
  minOpacityMode?: 'smooth' | 'linear'
  projection?: IColorfulMapProjection
  boundaries?: IColorfulMapBoundaryLayer[]
  cut?: IColorfulMapCutTexture
  axes?: IColorfulMapAxesOptions
  background?: string
  /** Prefer OffscreenCanvas when running in a worker or when explicitly requested. */
  preferOffscreenCanvas?: boolean
  signal?: AbortSignal
}

/** Worker messages contain only structured-cloneable data and image sources. */
export type IColorfulMapWorkerExportOptions = Omit<
  IColorfulMapImageExportOptions,
  'image' | 'cut' | 'projection' | 'preferOffscreenCanvas' | 'signal'
> & {
  image: ColorfulMapWorkerImageSource
  cut?: Omit<IColorfulMapCutTexture, 'image'> & { image: ColorfulMapWorkerImageSource }
}

export type ColorfulMapWorkerResponse =
  | { ok: true; blob: Blob }
  | { ok: false; error: { name: string; message: string } }

export interface IColorfulMapExportSize {
  width: number
  height: number
  aspectRatio: number
}

export interface IColorfulMapRenderResult {
  canvas: HTMLCanvasElement | IColorfulMapOffscreenCanvas
  width: number
  height: number
  aspectRatio: number
}

export type ColorfulMapLineGeometry = LineString | MultiLineString | Polygon | MultiPolygon
