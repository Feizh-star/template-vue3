declare module 'three/addons/controls/OrbitControls.js'
declare module 'three/addons/loaders/GLTFLoader.js'
declare module 'three/addons/lines/Line2.js' {
  import { LineSegments } from 'three'
  import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
  import { LineGeometry } from 'three/addons/lines/LineGeometry.js'

  export class Line2 extends LineSegments {
    constructor(geometry?: LineGeometry, material?: LineMaterial)
    computeLineDistances(): this
    raycast(raycaster: any, intersects: any): void
  }
}

declare module 'three/addons/lines/LineMaterial.js' {
  import { ShaderMaterial, Color, Vector2 } from 'three'

  export class LineMaterial extends ShaderMaterial {
    constructor(parameters?: any)
    color: Color | string | number
    linewidth: number
    dashed: boolean
    dashScale: number
    dashSize: number
    gapSize: number
    alphaToCoverage: boolean
    resolution: Vector2
  }
}

declare module 'three/addons/lines/LineGeometry.js' {
  import { BufferGeometry } from 'three'

  export class LineGeometry extends BufferGeometry {
    constructor()
    fromLine(line: any): this
    setPositions(array: Array<number>): this
    setColors(array: Array<number>): this
    setUVs(array: Array<number>): this
  }
}
