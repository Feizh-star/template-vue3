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

export interface IColorfulMapImageOptions {
  img: string | HTMLImageElement | HTMLCanvasElement
  lonmin: number
  lonmax: number
  latmin: number
  latmax: number
  scale: IScaleProps
  colors: IColorRange
  beforeId?: string
  interval?: number
  grid?: boolean
  linear?: number
  flipy?: 0 | 1
  minOpacity?: boolean
  useCorrect?: boolean
  cut?: boolean
  cutUrl?: string
  cutlatmin?: number
  cutlatmax?: number
  cutlonmin?: number
  cutlonmax?: number
  useCros?: boolean
  preserveDrawingBuffer?: boolean
}

export interface IGridDataResult {
  data: number | null
  lat: number
  lon: number
}
