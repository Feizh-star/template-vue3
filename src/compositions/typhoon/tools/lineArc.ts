const earthRadius: number = 6371008.8
const factors: Record<string, number> = {
  centimeters: earthRadius * 100,
  centimetres: earthRadius * 100,
  degrees: 360 / (2 * Math.PI),
  feet: earthRadius * 3.28084,
  inches: earthRadius * 39.37,
  kilometers: earthRadius / 1000,
  kilometres: earthRadius / 1000,
  meters: earthRadius,
  metres: earthRadius,
  miles: earthRadius / 1609.344,
  millimeters: earthRadius * 1000,
  millimetres: earthRadius * 1000,
  nauticalmiles: earthRadius / 1852,
  radians: 1,
  yards: earthRadius * 1.0936,
}

function convertAngleTo360(alfa: number): number {
  let beta: number = alfa % 360
  if (beta < 0) {
    beta += 360
  }
  return beta
}

function degreesToRadians(degrees: number): number {
  const radians: number = degrees % 360
  return (radians * Math.PI) / 180
}

function radiansToDegrees(radians: number): number {
  const degrees: number = radians % (2 * Math.PI)
  return (degrees * 180) / Math.PI
}

function lengthToRadians(distance: number, units: string = 'kilometers'): number {
  const factor: number = factors[units]
  if (!factor) {
    throw new Error(units + ' units is invalid')
  }
  return distance / factor
}

interface GeoJSONFeature {
  type: string
  geometry: {
    type: string
    coordinates: any[]
  } | null
  properties: any
}

interface GeoJSONPoint {
  type: string
  coordinates: any[]
}

function getCoord(coord: any): any[] {
  if (!coord) {
    throw new Error('coord is required')
  }

  if (!Array.isArray(coord)) {
    if (
      (coord as GeoJSONFeature).type === 'Feature' &&
      (coord as GeoJSONFeature).geometry !== null &&
      (coord as GeoJSONFeature).geometry!.type === 'Point'
    ) {
      return [...(coord as GeoJSONFeature).geometry!.coordinates]
    }
    if ((coord as GeoJSONPoint).type === 'Point') {
      return [...(coord as GeoJSONPoint).coordinates]
    }
  }
  if (
    Array.isArray(coord) &&
    coord.length >= 2 &&
    !Array.isArray(coord[0]) &&
    !Array.isArray(coord[1])
  ) {
    return [...coord]
  }

  throw new Error('coord must be GeoJSON Point or an Array of numbers')
}

function isNumber(num: any): boolean {
  return !isNaN(num as number) && num !== null && !Array.isArray(num)
}

interface FeatureOptions {
  id?: number
  bbox?: any[]
}

interface GeoJSONFeatureResult {
  type: string
  id?: number
  bbox?: any[]
  properties: any
  geometry: any
}

function feature(geom: any, properties: any, options: FeatureOptions = {}): GeoJSONFeatureResult {
  const feat: Record<string, any> = {
    type: 'Feature',
  }
  if (options.id === 0 || options.id) {
    feat.id = options.id
  }
  if (options.bbox) {
    feat.bbox = options.bbox
  }
  feat.properties = properties || {}
  feat.geometry = geom
  return feat as GeoJSONFeatureResult
}

function point(
  coordinates: any[],
  properties: any = {},
  options: FeatureOptions = {}
): GeoJSONFeatureResult {
  if (!coordinates) {
    throw new Error('coordinates is required')
  }
  if (!Array.isArray(coordinates)) {
    throw new Error('coordinates must be an Array')
  }
  if (coordinates.length < 2) {
    throw new Error('coordinates must be at least 2 numbers long')
  }
  if (!isNumber(coordinates[0]) || !isNumber(coordinates[1])) {
    throw new Error('coordinates must contain numbers')
  }

  const geom: any = {
    type: 'Point',
    coordinates,
  }
  return feature(geom, properties, options)
}

interface DestinationOptions {
  units?: string
  properties?: any
}

function destination(
  origin: any,
  distance: number,
  bearing: number,
  options: DestinationOptions = {}
): GeoJSONFeatureResult {
  const coordinates1: any[] = getCoord(origin)
  const longitude1: number = degreesToRadians(coordinates1[0])
  const latitude1: number = degreesToRadians(coordinates1[1])
  const bearingRad: number = degreesToRadians(bearing)
  const radians: number = lengthToRadians(distance, options.units)

  const latitude2: number = Math.asin(
    Math.sin(latitude1) * Math.cos(radians) +
      Math.cos(latitude1) * Math.sin(radians) * Math.cos(bearingRad)
  )
  const longitude2: number =
    longitude1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(radians) * Math.cos(latitude1),
      Math.cos(radians) - Math.sin(latitude1) * Math.sin(latitude2)
    )
  const lng: number = radiansToDegrees(longitude2)
  const lat: number = radiansToDegrees(latitude2)

  return point([lat, lng], options.properties)
}

interface LineArcOptions {
  steps?: number
  units?: string
  properties?: any
}

export function lineArc(
  center: any,
  radius: number,
  bearing1: number,
  bearing2: number,
  options: LineArcOptions = {}
): any[] {
  const steps: number = options.steps || 64

  const angle1: number = convertAngleTo360(bearing1)
  const angle2: number = convertAngleTo360(bearing2)

  if (angle1 === angle2) {
    return circle(center, radius, options).geometry.coordinates[0]
  }
  const arcStartDegree: number = angle1
  const arcEndDegree: number = angle1 < angle2 ? angle2 : angle2 + 360

  let alfa: number = arcStartDegree
  const coordinates: any[] = []
  let i: number = 0

  while (alfa < arcEndDegree) {
    coordinates.push(destination(center, radius, alfa, options).geometry.coordinates)
    i++
    alfa = arcStartDegree + (i * 360) / steps
  }
  if (alfa >= arcEndDegree) {
    coordinates.push(destination(center, radius, arcEndDegree, options).geometry.coordinates)
  }
  return coordinates
}

function circle(center: any, radius: number, options: LineArcOptions = {}): GeoJSONFeatureResult {
  const steps: number = options.steps || 64
  const properties: any = options.properties
    ? options.properties
    : !Array.isArray(center) && (center as any).type === 'Feature' && (center as any).properties
    ? (center as any).properties
    : {}

  const coordinates: any[] = []
  for (let i: number = 0; i < steps; i++) {
    coordinates.push(destination(center, radius, (i * -360) / steps, options).geometry.coordinates)
  }
  coordinates.push(coordinates[0])

  return polygon([coordinates], properties)
}

export function polygon(
  coordinates: any[][],
  properties: any = {},
  options: FeatureOptions = {}
): GeoJSONFeatureResult {
  for (const ring of coordinates) {
    if (ring.length < 4) {
      throw new Error('Each LinearRing of a Polygon must have 4 or more Positions.')
    }

    if (ring[ring.length - 1].length !== ring[0].length) {
      throw new Error('First and last Position are not equivalent.')
    }

    for (let j: number = 0; j < ring[ring.length - 1].length; j++) {
      if (ring[ring.length - 1][j] !== ring[0][j]) {
        throw new Error('First and last Position are not equivalent.')
      }
    }
  }
  const geom: any = {
    type: 'Polygon',
    coordinates,
  }
  return feature(geom, properties, options)
}
