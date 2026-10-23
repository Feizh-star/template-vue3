import type maplibregl from 'maplibre-gl'
import type { IColorfulMapImageOptions, IColorRange, IGridDataResult } from './types'

// ========== GLSL Shaders ==========

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
uniform mat4 u_matrix;
uniform float u_worldOffset;
out vec2 mercatorPosition;
void main() {
    gl_Position = u_matrix * vec4(a_position.x + u_worldOffset, a_position.y, 0.0, 1.0);
    mercatorPosition = a_position;
}`

// Shared by both fragment shaders so clipping cannot change the minimum-value cutoff.
const MIN_OPACITY_GLSL = `
float minimumOpacity(float value, float minValue) {
    return step(minValue, value);
}`

const FRAGMENT_SHADER_WITH_CUT = `#version 300 es
#define PI 3.141592653589793238
#define PID 57.29577951308232
#define useCut true
precision highp float;

${MIN_OPACITY_GLSL}

vec2 mercatorToLatlng(vec2 mercator) {
    float x = (mercator.x - 0.5) * 360.0;
    float y = -(mercator.y - 0.5) * PI * 2.0;
    float lat = (2.0 * atan(exp(y)) - (PI / 2.0)) * PID;
    return vec2(lat, x);
}

in vec2 mercatorPosition;
uniform sampler2D u_color;
uniform sampler2D u_img;
uniform vec4 tbound;
uniform vec4 scale;
uniform vec2 vrange;
uniform bool tminOpacity;
uniform sampler2D cutImg;
uniform vec4 cutArea;
out vec4 outColor;

void main() {
    vec2 latlng = mercatorToLatlng(mercatorPosition);
    float cuta = (latlng.x - cutArea.x) / (cutArea.y - cutArea.x);
    float cutb = (latlng.y - cutArea.z) / (cutArea.w - cutArea.z);
    float cutValue = texture(cutImg, vec2(cutb, cuta)).r;
    if (cutValue > 0.5) {
        discard;
    }
    float value = 0.0;
    float b = (latlng.x - tbound.x) / (tbound.y - tbound.x);
    float a = (latlng.y - tbound.z) / (tbound.w - tbound.z);
    vec4 color = texture(u_img, vec2(a, b)) * 255.0;
    value = color.r / scale.x + color.g / scale.y + color.b / scale.z + color.a / scale.w;
    float vin = (value - vrange.x) / (vrange.y - vrange.x);
    outColor = texture(u_color, vec2(vin, 0.5));
    if (tminOpacity) {
        outColor.a *= minimumOpacity(value, vrange.x);
    }
    outColor.rgb *= outColor.a;
}`

const FRAGMENT_SHADER_NO_CUT = `#version 300 es
#define PI 3.141592653589793238
#define PID 57.29577951308232
precision highp float;

${MIN_OPACITY_GLSL}

vec2 mercatorToLatlng(vec2 mercator) {
    float x = (mercator.x - 0.5) * 360.0;
    float y = -(mercator.y - 0.5) * PI * 2.0;
    float lat = (2.0 * atan(exp(y)) - (PI / 2.0)) * PID;
    return vec2(lat, x);
}

in vec2 mercatorPosition;
uniform sampler2D u_color;
uniform sampler2D u_img;
uniform vec4 tbound;
uniform vec4 scale;
uniform vec2 vrange;
uniform bool tminOpacity;
out vec4 outColor;

void main() {
    vec2 latlng = mercatorToLatlng(mercatorPosition);
    float value = 0.0;
    if (latlng.x >= tbound.x && latlng.x <= tbound.y && latlng.y >= tbound.z && latlng.y <= tbound.w) {
        float b = (latlng.x - tbound.x) / (tbound.y - tbound.x);
        float a = (latlng.y - tbound.z) / (tbound.w - tbound.z);
        vec4 color = texture(u_img, vec2(a, b)) * 255.0;
        value = color.r / scale.x + color.g / scale.y + color.b / scale.z + color.a / scale.w;
    } else {
        discard;
    }
    float vin = (value - vrange.x) / (vrange.y - vrange.x);
    outColor = texture(u_color, vec2(vin, 0.5));
    if (tminOpacity) {
        outColor.a *= minimumOpacity(value, vrange.x);
    }
    outColor.rgb *= outColor.a;
}`

// ========== Helper Functions ==========

function createShader(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${info}`)
  }
  return shader
}

function createProgram(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  vs: WebGLShader,
  fs: WebGLShader
): WebGLProgram {
  const program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${info}`)
  }
  return program
}

function createTexture(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  source: HTMLImageElement | HTMLCanvasElement,
  textureUnit: number,
  useNearest: boolean,
  flipY: boolean
): WebGLTexture {
  // The context is shared with MapLibre; earlier errors must not be attributed to this upload.
  for (let error = gl.getError(); error !== gl.NO_ERROR; error = gl.getError()) {
    if (error === gl.CONTEXT_LOST_WEBGL) throw new Error('WebGL context is lost')
    console.warn(`Pre-existing WebGL error before texture upload: 0x${error.toString(16)}`)
  }
  const texture = gl.createTexture()
  if (!texture) throw new Error('Unable to create WebGL texture')
  try {
    gl.activeTexture(gl.TEXTURE0 + textureUnit)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY ? 1 : 0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    if (useNearest) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    const error = gl.getError()
    if (error !== gl.NO_ERROR) {
      const url = source instanceof HTMLImageElement ? source.currentSrc || source.src : 'canvas'
      throw new Error(
        `Texture upload failed: unit=${textureUnit}, GL=0x${error.toString(16)}, source=${url}`
      )
    }
    return texture
  } catch (error) {
    gl.deleteTexture(texture)
    throw error
  }
}

function generateColorRamp(
  colors: IColorRange,
  linear: number = 0
): { vmin: number; vmax: number; canvas: HTMLCanvasElement } {
  const len = colors.r.length
  const vmin = colors.v[0]
  const vmax = colors.v[len - 1] + 5
  const canvas = document.createElement('canvas')
  canvas.width = 25 * len + 5
  canvas.height = 3
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)

  for (let i = 0; i < len - 1; i++) {
    const stop1 = (colors.v[i] - vmin) / (vmax - vmin)
    const stop2 =
      (colors.v[i + 1] - (colors.v[i + 1] - colors.v[i]) * linear - vmin) / (vmax - vmin)
    const color = `rgba(${colors.r[i]},${colors.g[i]},${colors.b[i]},${colors.o[i]})`
    gradient.addColorStop(stop1, color)
    gradient.addColorStop(stop2, color)
  }

  const lastColor = `rgba(${colors.r[len - 1]},${colors.g[len - 1]},${colors.b[len - 1]},${
    colors.o[len - 1]
  })`
  const lastStop = (colors.v[len - 1] - vmin) / (vmax - vmin)
  gradient.addColorStop(lastStop, lastColor)
  gradient.addColorStop(1, lastColor)

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  return { vmin, vmax, canvas }
}

function lngLatToMercator(lng: number, lat: number): { x: number; y: number } {
  const x = lng / 360 + 0.5
  const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat / 2) * (Math.PI / 180))) / (2 * Math.PI)
  return { x, y }
}

// ========== Main Class ==========

type OptionKey = keyof IColorfulMapImageOptions
type ImageSource = HTMLImageElement | HTMLCanvasElement

const CUT_KEYS = new Set<OptionKey>([
  'cut',
  'cutUrl',
  'cutlatmin',
  'cutlatmax',
  'cutlonmin',
  'cutlonmax',
])

// Both resource groups use the same loading and commit lifecycle.
function createResourceGroup() {
  return {
    version: 0,
    loading: false,
    source: null as ImageSource | null,
    cancel: null as (() => void) | null,
    dirty: new Set<OptionKey>(),
  }
}

type ResourceGroup = ReturnType<typeof createResourceGroup>

type DrawState = {
  options: IColorfulMapImageOptions
  program: WebGLProgram
  dataTexture: WebGLTexture
  colorTexture: WebGLTexture
  cutTexture: WebGLTexture | null
}

export class ColorfulMapImage implements maplibregl.CustomLayerInterface {
  id: string
  type: 'custom' = 'custom'
  renderingMode: '2d' = '2d'

  private map: maplibregl.Map | null = null
  private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private vbuffer: WebGLBuffer | null = null
  private dataTexture: WebGLTexture | null = null
  private colorTexture: WebGLTexture | null = null
  private cutTexture: WebGLTexture | null = null
  private usesCut = false

  private u_matrix: WebGLUniformLocation | null = null
  private u_worldOffset: WebGLUniformLocation | null = null
  private u_tbound: WebGLUniformLocation | null = null
  private u_scale: WebGLUniformLocation | null = null
  private u_tminOpacity: WebGLUniformLocation | null = null
  private u_vrange: WebGLUniformLocation | null = null
  private u_img: WebGLUniformLocation | null = null
  private u_color: WebGLUniformLocation | null = null
  private u_cut: WebGLUniformLocation | null = null
  private u_cutArea: WebGLUniformLocation | null = null

  // Target options may be ahead of the options used for drawing and pixel queries.
  private opts: IColorfulMapImageOptions
  private applied: IColorfulMapImageOptions
  private main = createResourceGroup()
  private mask = createResourceGroup()
  private isDestroyed = false
  private vmin = 0
  private vmax = 0
  private rawImageCanvas: HTMLCanvasElement | null = null
  private imageSource: ImageSource | null = null
  private projectionMatrix = new Float32Array(16)

  constructor(options: IColorfulMapImageOptions) {
    this.id = `colorful-map-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.opts = {
      linear: 0,
      flipy: 0,
      grid: false,
      getGrid: false,
      minOpacity: false,
      cut: false,
      useCros: false,
      ...this.copyOptions(options),
    } as IColorfulMapImageOptions
    this.applied = { ...this.opts }
  }

  onAdd(map: maplibregl.Map, gl: WebGL2RenderingContext | WebGLRenderingContext): void {
    if (this.isDestroyed) return
    this.map = map
    this.gl = gl
    this.vbuffer = gl.createBuffer()
    this.vao = (gl as WebGL2RenderingContext).createVertexArray()
    this.updateProgram(false)
    // Initialization is a full option update through the same resource pipeline.
    this.setOption(this.opts)
  }

  onRemove(_map: maplibregl.Map, gl: WebGL2RenderingContext | WebGLRenderingContext): void {
    this.resetGroup(this.main)
    this.resetGroup(this.mask)
    if (this.program) gl.deleteProgram(this.program)
    if (this.vao) (gl as WebGL2RenderingContext).deleteVertexArray(this.vao)
    if (this.vbuffer) gl.deleteBuffer(this.vbuffer)
    if (this.dataTexture) gl.deleteTexture(this.dataTexture)
    if (this.colorTexture) gl.deleteTexture(this.colorTexture)
    if (this.cutTexture) gl.deleteTexture(this.cutTexture)
    this.map = null
    this.gl = null
    this.program = null
    this.vao = null
    this.vbuffer = null
    this.dataTexture = null
    this.colorTexture = null
    this.cutTexture = null
    this.rawImageCanvas = null
    this.imageSource = null
    this.usesCut = false
  }

  render(
    gl: WebGL2RenderingContext | WebGLRenderingContext,
    options: maplibregl.CustomRenderMethodInput
  ): void {
    if (this.isDestroyed || gl !== this.gl) return
    const state = this.prepareDrawState()
    if (!state) return

    const map = this.map!
    const { options: opts, program, dataTexture, colorTexture, cutTexture } = state
    gl.useProgram(program)
    ;(gl as WebGL2RenderingContext).bindVertexArray(this.vao)
    this.projectionMatrix.set(options.defaultProjectionData.mainMatrix)
    gl.uniformMatrix4fv(this.u_matrix, false, this.projectionMatrix)
    gl.uniform4f(this.u_tbound, opts.latmin, opts.latmax, opts.lonmin, opts.lonmax)
    gl.uniform4f(this.u_scale, opts.scale.r, opts.scale.g, opts.scale.b, opts.scale.a)
    gl.uniform1i(this.u_tminOpacity, opts.minOpacity ? 1 : 0)
    gl.uniform2f(this.u_vrange, this.vmin, this.vmax)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, dataTexture)
    gl.uniform1i(this.u_img, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, colorTexture)
    gl.uniform1i(this.u_color, 1)
    if (cutTexture) {
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_2D, cutTexture)
      gl.uniform1i(this.u_cut, 2)
      gl.uniform4f(
        this.u_cutArea,
        opts.cutlatmin!,
        opts.cutlatmax!,
        opts.cutlonmin!,
        opts.cutlonmax!
      )
    }

    const centerWorld = Math.floor((map.getCenter().lng + 180) / 360)
    const worldOffsets = map.getRenderWorldCopies()
      ? [centerWorld - 1, centerWorld, centerWorld + 1]
      : [0]
    for (const worldOffset of worldOffsets) {
      gl.uniform1f(this.u_worldOffset, worldOffset)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
  }

  addTo(map: maplibregl.Map, beforeId?: string): this {
    if (this.isDestroyed) return this
    if (beforeId !== undefined) this.setOption({ beforeId })
    map.addLayer(this, this.opts.beforeId)
    return this
  }

  /**
   * Shallow option update. Main-image and mask options each wait for their own
   * pending resource, then commit together at the start of a map render.
   * Explicit img/cutUrl submissions reload even when the value is unchanged.
   */
  setOption(options: Partial<IColorfulMapImageOptions>): this {
    if (this.isDestroyed) return this
    const patch = this.copyOptions(options)
    this.opts = { ...this.opts, ...patch }
    for (const key of Object.keys(patch) as OptionKey[]) {
      ;(CUT_KEYS.has(key) ? this.mask : this.main).dirty.add(key)
    }
    if (this.gl) {
      if (patch.img !== undefined) {
        this.loadResource(this.main, patch.img, !!this.opts.useCros)
      }
      if (patch.cutUrl !== undefined) {
        this.loadResource(this.mask, patch.cutUrl, true)
      }
    }
    this.requestRepaint()
    return this
  }

  getGridDataByLatLon(lat: number, lon: number): IGridDataResult | null {
    if (!this.applied.getGrid || !this.rawImageCanvas) return null
    const { interval, latmin, latmax, lonmin, lonmax, scale } = this.applied
    if (!interval) {
      console.warn('启用获取数值，需要传入经纬度间隔')
      return null
    }
    if (lat < latmin || lat > latmax || lon < lonmin || lon > lonmax) {
      return { data: null, lat, lon }
    }
    const x = Math.round((lon - lonmin) / interval)
    const y = Math.round((lat - latmin) / interval)
    const ctx = this.rawImageCanvas.getContext('2d')
    if (!ctx) return { data: null, lat, lon }
    try {
      const pixel = ctx.getImageData(x, y, 1, 1).data
      return {
        data: pixel[0] / scale.r + pixel[1] / scale.g + pixel[2] / scale.b + pixel[3] / scale.a,
        lat,
        lon,
      }
    } catch {
      return { data: null, lat, lon }
    }
  }

  destroy(): void {
    if (this.isDestroyed) return
    this.isDestroyed = true
    this.resetGroup(this.main)
    this.resetGroup(this.mask)
    if (this.map) this.map.removeLayer(this.id)
  }

  private copyOptions(options: Partial<IColorfulMapImageOptions>) {
    const patch = Object.fromEntries(
      Object.entries(options).filter(([, value]) => value !== undefined)
    ) as Partial<IColorfulMapImageOptions>
    if (patch.scale) patch.scale = { ...patch.scale }
    if (patch.colors) {
      const { r, g, b, v, o } = patch.colors
      patch.colors = { r: [...r], g: [...g], b: [...b], v: [...v], o: [...o] }
    }
    return patch
  }

  private resetGroup(group: ResourceGroup): void {
    group.version++
    group.cancel?.()
    group.cancel = null
    group.source = null
    group.loading = false
    group.dirty.clear()
  }

  private discardGroup(group: ResourceGroup, error: unknown): void {
    // Roll back only this group's target fields; the other group stays independent.
    const restored = { ...this.opts }
    for (const key of group.dirty) {
      Object.assign(restored, { [key]: this.applied[key] })
    }
    this.opts = restored
    this.resetGroup(group)
    console.warn(group === this.main ? '数据图片更新失败' : '裁剪更新失败', error)
    this.requestRepaint()
  }

  private loadResource(
    group: ResourceGroup,
    source: IColorfulMapImageOptions['img'],
    crossOrigin: boolean
  ): void {
    group.cancel?.()
    group.cancel = null
    group.source = null
    group.loading = true
    const version = ++group.version
    const isCurrent = () => !this.isDestroyed && !!this.gl && group.version === version
    const succeed = (image: ImageSource) => {
      if (!isCurrent()) return
      group.cancel?.()
      group.cancel = null
      group.source = image
      group.loading = false
      this.requestRepaint()
    }
    const fail = () => {
      if (isCurrent()) this.discardGroup(group, new Error('图片无法加载'))
    }

    if (source instanceof HTMLCanvasElement) {
      succeed(source)
      return
    }
    // An empty cutUrl clears the cached mask without starting a request.
    if (source === '' && group === this.mask) {
      group.loading = false
      return
    }
    const image = typeof source === 'string' ? new Image() : source
    const loaded = () => (image.naturalWidth > 0 ? succeed(image) : fail())
    if (typeof source !== 'string' && image.complete) {
      loaded()
      return
    }
    image.addEventListener('load', loaded)
    image.addEventListener('error', fail)
    group.cancel = () => {
      image.removeEventListener('load', loaded)
      image.removeEventListener('error', fail)
    }
    if (typeof source === 'string') {
      if (crossOrigin) image.crossOrigin = 'anonymous'
      image.src = source
    }
  }

  // The commit boundary resolves pending requests into a complete drawable snapshot.
  // render consumes this snapshot without interpreting target options or resource readiness.
  private prepareDrawState(): DrawState | null {
    this.commitOptions()
    if (!this.program || !this.dataTexture || !this.colorTexture) return null

    // A committed cut remains required until its replacement/disable commits.
    // Otherwise an enabling request must wait instead of exposing an uncut frame.
    const cutRequirement = this.applied.cut && this.applied.cutUrl ? this.applied : this.opts
    const cutTexture = this.usesCut ? this.cutTexture : null
    if (cutRequirement.cut && cutRequirement.cutUrl && !cutTexture) return null

    return {
      options: this.applied,
      program: this.program,
      dataTexture: this.dataTexture,
      colorTexture: this.colorTexture,
      cutTexture,
    }
  }

  private commitOptions(): void {
    for (const group of [this.main, this.mask]) {
      if (group.loading || group.dirty.size === 0) continue
      const next = { ...this.applied }
      for (const key of group.dirty) Object.assign(next, { [key]: this.opts[key] })
      try {
        if (group === this.main) this.applyMain(next, group)
        else this.applyCut(next, group)
        this.applied = next
        group.source = null
        group.dirty.clear()
      } catch (error) {
        this.discardGroup(group, error)
      }
    }
  }

  private applyMain(next: IColorfulMapImageOptions, group: ResourceGroup): void {
    const gl = this.gl!
    const dirty = group.dirty
    let canvas = this.rawImageCanvas
    let source = this.imageSource
    let dataTexture: WebGLTexture | null = null
    let colorTexture: WebGLTexture | null = null
    let ramp: ReturnType<typeof generateColorRamp> | null = null
    try {
      if (group.source) {
        canvas = document.createElement('canvas')
        canvas.width =
          group.source instanceof HTMLImageElement ? group.source.naturalWidth : group.source.width
        canvas.height =
          group.source instanceof HTMLImageElement
            ? group.source.naturalHeight
            : group.source.height
        canvas.getContext('2d')!.drawImage(group.source, 0, 0)
        // Upload Images directly to preserve encoded RGBA channels. Canvas inputs
        // use the snapshot so later caller mutations do not change cached data.
        source = group.source instanceof HTMLImageElement ? group.source : canvas
      }
      if (source && (group.source || dirty.has('flipy') || !this.dataTexture)) {
        dataTexture = createTexture(gl, source, 0, !!next.grid, next.flipy === 1)
      }
      if (!this.colorTexture || dirty.has('colors') || dirty.has('linear')) {
        ramp = generateColorRamp(next.colors, next.linear)
        colorTexture = createTexture(gl, ramp.canvas, 1, false, false)
      }
      if (dirty.has('beforeId') && next.beforeId !== this.applied.beforeId) {
        this.map!.moveLayer(this.id, next.beforeId)
      }
      if (
        !this.dataTexture ||
        ['latmin', 'latmax', 'lonmin', 'lonmax'].some((key) => dirty.has(key as OptionKey))
      ) {
        this.updateGeometry(next)
      }
    } catch (error) {
      if (dataTexture) gl.deleteTexture(dataTexture)
      if (colorTexture) gl.deleteTexture(colorTexture)
      throw error
    }
    if (dataTexture) {
      if (this.dataTexture) gl.deleteTexture(this.dataTexture)
      this.dataTexture = dataTexture
    } else if (this.dataTexture && dirty.has('grid')) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.dataTexture)
      const filter = next.grid ? gl.NEAREST : gl.LINEAR
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    }
    if (colorTexture && ramp) {
      if (this.colorTexture) gl.deleteTexture(this.colorTexture)
      this.colorTexture = colorTexture
      this.vmin = ramp.vmin
      this.vmax = ramp.vmax
    }
    this.rawImageCanvas = canvas
    this.imageSource = source
  }

  private applyCut(next: IColorfulMapImageOptions, group: ResourceGroup): void {
    const gl = this.gl!
    const texture = group.source ? createTexture(gl, group.source, 2, false, true) : null
    const clear = group.dirty.has('cutUrl') && !next.cutUrl
    try {
      this.updateProgram(!!(next.cut && next.cutUrl && (texture || (!clear && this.cutTexture))))
    } catch (error) {
      if (texture) gl.deleteTexture(texture)
      throw error
    }
    if (texture || clear) {
      if (this.cutTexture) gl.deleteTexture(this.cutTexture)
      this.cutTexture = texture
    }
  }

  private updateProgram(useCut: boolean): void {
    if (this.program && this.usesCut === useCut) return
    const gl = this.gl!
    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    let fs: WebGLShader | null = null
    let program: WebGLProgram
    try {
      fs = createShader(
        gl,
        gl.FRAGMENT_SHADER,
        useCut ? FRAGMENT_SHADER_WITH_CUT : FRAGMENT_SHADER_NO_CUT
      )
      program = createProgram(gl, vs, fs)
    } finally {
      gl.deleteShader(vs)
      if (fs) gl.deleteShader(fs)
    }
    if (this.program) gl.deleteProgram(this.program)
    this.program = program
    this.usesCut = useCut
    this.u_matrix = gl.getUniformLocation(program, 'u_matrix')
    this.u_worldOffset = gl.getUniformLocation(program, 'u_worldOffset')
    this.u_tbound = gl.getUniformLocation(program, 'tbound')
    this.u_scale = gl.getUniformLocation(program, 'scale')
    this.u_tminOpacity = gl.getUniformLocation(program, 'tminOpacity')
    this.u_vrange = gl.getUniformLocation(program, 'vrange')
    this.u_img = gl.getUniformLocation(program, 'u_img')
    this.u_color = gl.getUniformLocation(program, 'u_color')
    this.u_cut = gl.getUniformLocation(program, 'cutImg')
    this.u_cutArea = gl.getUniformLocation(program, 'cutArea')
    // Attribute locations can change when switching the mask shader.
    ;(gl as WebGL2RenderingContext).bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbuffer)
    const posLoc = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    ;(gl as WebGL2RenderingContext).bindVertexArray(null)
  }

  private updateGeometry(opts: IColorfulMapImageOptions): void {
    const gl = this.gl!
    const northWest = lngLatToMercator(opts.lonmin, opts.latmax)
    const southEast = lngLatToMercator(opts.lonmax, opts.latmin)
    const vertices = new Float32Array([
      northWest.x,
      northWest.y,
      northWest.x,
      southEast.y,
      southEast.x,
      northWest.y,
      southEast.x,
      southEast.y,
    ])
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
  }

  private requestRepaint(): void {
    this.map?.triggerRepaint()
  }
}
