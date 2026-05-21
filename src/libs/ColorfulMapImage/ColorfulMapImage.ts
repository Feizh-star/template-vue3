import type maplibregl from 'maplibre-gl'
import type { IColorfulMapImageOptions, IColorRange, IGridDataResult } from './types'

// ========== GLSL Shaders ==========

const VERTEX_SHADER = `#version 300 es
in vec4 a_position;
out vec2 point;
void main() {
    gl_Position = a_position;
    point = a_position.xy;
}`

const FRAGMENT_SHADER_WITH_CUT = `#version 300 es
#define PI 3.141592653589793238
#define PID 57.29577951308232
#define useCut true
precision highp float;

vec2 pxToLatlng(vec3 px) {
    float x = (px.x * px.z - 0.5) * 360.0;
    float y = -(px.y * px.z - 0.5) * PI * 2.0;
    float lat = (2.0 * atan(exp(y)) - (PI / 2.0)) * PID;
    float lon = x;
    lon = mod(lon, 360.0);
    return vec2(lat, lon);
}

in vec2 point;
uniform sampler2D u_color;
uniform sampler2D u_img;
uniform vec4 oripx;
uniform float rto;
uniform vec4 tbound;
uniform vec4 scale;
uniform vec2 vrange;
uniform bool tminOpacity;
uniform sampler2D cutImg;
uniform vec4 cutArea;
out vec4 outColor;

void main() {
    float x = oripx.x + gl_FragCoord.x / rto;
    float y = oripx.y + (oripx.w - gl_FragCoord.y) / rto;
    vec2 latlng = pxToLatlng(vec3(x, y, oripx.z));
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
        float minv = vrange.x * 0.5;
        float maxv = vrange.x * 2.0;
        float o = smoothstep(minv, maxv, value);
        outColor.a = outColor.a * o;
    }
    outColor.rgb *= outColor.a;
}`

const FRAGMENT_SHADER_NO_CUT = `#version 300 es
#define PI 3.141592653589793238
#define PID 57.29577951308232
precision highp float;

vec2 pxToLatlng(vec3 px) {
    float x = (px.x * px.z - 0.5) * 360.0;
    float y = -(px.y * px.z - 0.5) * PI * 2.0;
    float lat = (2.0 * atan(exp(y)) - (PI / 2.0)) * PID;
    float lon = x;
    lon = mod(lon, 360.0);
    return vec2(lat, lon);
}

in vec2 point;
uniform sampler2D u_color;
uniform sampler2D u_img;
uniform vec4 oripx;
uniform float rto;
uniform vec4 tbound;
uniform vec4 scale;
uniform vec2 vrange;
uniform bool tminOpacity;
out vec4 outColor;

void main() {
    float x = oripx.x + gl_FragCoord.x / rto;
    float y = oripx.y + (oripx.w - gl_FragCoord.y) / rto;
    vec2 latlng = pxToLatlng(vec3(x, y, oripx.z));
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
        float o = (value - vrange.x * 0.8) / 0.5 / vrange.x;
        o = max(o, 0.0);
        o = min(o, 1.0);
        outColor.a = outColor.a * o;
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
  const texture = gl.createTexture()!
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
  return texture
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

  private u_oripx: WebGLUniformLocation | null = null
  private u_tbound: WebGLUniformLocation | null = null
  private u_scale: WebGLUniformLocation | null = null
  private u_tminOpacity: WebGLUniformLocation | null = null
  private u_rto: WebGLUniformLocation | null = null
  private u_vrange: WebGLUniformLocation | null = null
  private u_img: WebGLUniformLocation | null = null
  private u_color: WebGLUniformLocation | null = null
  private u_cut: WebGLUniformLocation | null = null
  private u_cutArea: WebGLUniformLocation | null = null

  private opts: IColorfulMapImageOptions

  private ready = false
  private hasData = false
  private eventable = false
  private isDestroyed = false

  private vmin = 0
  private vmax = 0

  private rawImageCanvas: HTMLCanvasElement | null = null

  constructor(options: IColorfulMapImageOptions) {
    this.id =
      options.beforeId ||
      `colorful-map-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.opts = {
      linear: 0,
      flipy: 0,
      grid: false,
      minOpacity: false,
      useCorrect: false,
      cut: false,
      useCros: false,
      preserveDrawingBuffer: false,
      ...options,
    }
  }

  onAdd(map: maplibregl.Map, gl: WebGL2RenderingContext | WebGLRenderingContext): void {
    this.map = map
    this.gl = gl

    const useCut = this.opts.cut && this.opts.cutUrl

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      useCut ? FRAGMENT_SHADER_WITH_CUT : FRAGMENT_SHADER_NO_CUT
    )
    this.program = createProgram(gl, vs, fs)
    gl.deleteShader(vs)
    gl.deleteShader(fs)

    this.u_oripx = gl.getUniformLocation(this.program, 'oripx')
    this.u_tbound = gl.getUniformLocation(this.program, 'tbound')
    this.u_scale = gl.getUniformLocation(this.program, 'scale')
    this.u_tminOpacity = gl.getUniformLocation(this.program, 'tminOpacity')
    this.u_rto = gl.getUniformLocation(this.program, 'rto')
    this.u_vrange = gl.getUniformLocation(this.program, 'vrange')
    this.u_img = gl.getUniformLocation(this.program, 'u_img')
    this.u_color = gl.getUniformLocation(this.program, 'u_color')
    if (useCut) {
      this.u_cut = gl.getUniformLocation(this.program, 'cutImg')
      this.u_cutArea = gl.getUniformLocation(this.program, 'cutArea')
    }

    // Full-screen quad VAO
    const vertices = new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1])
    this.vbuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    this.vao = (gl as WebGL2RenderingContext).createVertexArray()
    ;(gl as WebGL2RenderingContext).bindVertexArray(this.vao)
    const posLoc = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    ;(gl as WebGL2RenderingContext).bindVertexArray(null)

    // Load resources
    this.loadImage(this.opts.img)
    this.updateColorRamp()

    if (useCut) {
      this.loadCutImage(this.opts.cutUrl!)
    }
  }

  onRemove(_map: maplibregl.Map, gl: WebGL2RenderingContext | WebGLRenderingContext): void {
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
    this.ready = false
  }

  render(gl: WebGL2RenderingContext | WebGLRenderingContext, _options: unknown): void {
    if (!this.program || !this.ready) return

    const map = this.map!
    const transform = (map as any).transform

    const center = transform.center
    const zoom = transform.zoom
    const width = transform.width
    const height = transform.height
    const tileSize = transform.tileSize || 512
    const worldSize = tileSize * Math.pow(2, zoom)
    const dpr = window.devicePixelRatio || 1

    const mc = lngLatToMercator(center.lng, center.lat)

    gl.useProgram(this.program)
    ;(gl as WebGL2RenderingContext).bindVertexArray(this.vao)

    gl.uniform4f(
      this.u_oripx,
      mc.x * worldSize - width / 2,
      mc.y * worldSize - height / 2,
      1 / worldSize,
      height
    )

    gl.uniform4f(
      this.u_tbound,
      this.opts.latmin,
      this.opts.latmax,
      this.opts.lonmin,
      this.opts.lonmax
    )

    gl.uniform4f(
      this.u_scale,
      this.opts.scale.r,
      this.opts.scale.g,
      this.opts.scale.b,
      this.opts.scale.a
    )

    gl.uniform1f(this.u_tminOpacity, this.opts.minOpacity ? 1.0 : 0.0)
    gl.uniform1f(this.u_rto, dpr)
    gl.uniform2f(this.u_vrange, this.vmin, this.vmax)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture)
    gl.uniform1i(this.u_img, 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.colorTexture)
    gl.uniform1i(this.u_color, 1)

    if (this.opts.cut && this.cutTexture && this.u_cut && this.u_cutArea) {
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_2D, this.cutTexture)
      gl.uniform1i(this.u_cut, 2)
      gl.uniform4f(
        this.u_cutArea,
        this.opts.cutlatmin!,
        this.opts.cutlatmax!,
        this.opts.cutlonmin!,
        this.opts.cutlonmax!
      )
    }

    // MapLibre default blend is (ONE, ONE_MINUS_SRC_ALPHA), expects premultiplied alpha.
    // The shader already premultiplies (outColor.rgb *= outColor.a), so no override needed.
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  // ============ Public API ============

  addTo(map: maplibregl.Map, beforeId?: string): this {
    map.addLayer(this, beforeId || this.opts.beforeId)
    return this
  }

  changeImage(img: string | HTMLImageElement | HTMLCanvasElement): void {
    this.opts.img = img
    this.loadImage(img)
  }

  changeAll(options: Partial<IColorfulMapImageOptions>): void {
    const gl = this.gl
    if (!gl || !this.program) return

    gl.useProgram(this.program)

    if ('minOpacity' in options) {
      this.opts.minOpacity = options.minOpacity
    }

    if (options.scale) {
      this.opts.scale = options.scale
      gl.uniform4f(
        this.u_scale!,
        options.scale.r,
        options.scale.g,
        options.scale.b,
        options.scale.a
      )
    }

    if (options.colors) {
      this.opts.colors = options.colors
      this.updateColorRamp()
    }

    if (options.img !== undefined) {
      this.changeImage(options.img)
    } else {
      this.requestRepaint()
    }
  }

  changeImageArea(
    url: string,
    latmin: number,
    latmax: number,
    lonmin: number,
    lonmax: number,
    extra?: Partial<IColorfulMapImageOptions>
  ): void {
    if (!this.ready) {
      requestAnimationFrame(() => this.changeImageArea(url, latmin, latmax, lonmin, lonmax, extra))
      return
    }

    this.opts.latmin = latmin
    this.opts.latmax = latmax
    this.opts.lonmin = lonmin
    this.opts.lonmax = lonmax

    if (extra?.flipy !== undefined) this.opts.flipy = extra.flipy
    if (extra?.interval !== undefined) this.opts.interval = extra.interval

    const gl = this.gl!
    gl.useProgram(this.program!)

    if (extra?.grid !== undefined) {
      this.opts.grid = extra.grid
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.dataTexture)
      if (extra.grid) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      }
    }

    if (extra?.colors) {
      this.opts.colors = extra.colors
      this.updateColorRamp()
    }

    this.changeImage(url)
  }

  changeColors(colors: IColorRange): void {
    this.opts.colors = colors
    this.updateColorRamp()
  }

  changeLinear(n: number): void {
    this.opts.linear = n
    this.updateColorRamp()
  }

  changeGrid(enabled: boolean): void {
    if (this.opts.grid === enabled) return
    this.opts.grid = enabled

    const gl = this.gl
    if (!gl) return

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture)
    if (enabled) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }
    this.requestRepaint()
  }

  setGetGrid(enabled: boolean): void {
    if (!this.ready) {
      requestAnimationFrame(() => this.setGetGrid(enabled))
      return
    }
    this.eventable = enabled
  }

  getGridDataByLatLon(lat: number, lon: number): IGridDataResult | null {
    if (!this.eventable || !this.rawImageCanvas) return null

    const { interval, latmin, latmax, lonmin, lonmax, scale } = this.opts
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
    if (this.map) {
      this.map.removeLayer(this.id)
    }
  }

  // ============ Private Methods ============

  private loadImage(img: string | HTMLImageElement | HTMLCanvasElement): void {
    const gl = this.gl!
    if (typeof img === 'string') {
      const image = new Image()
      if (this.opts.useCros) image.crossOrigin = 'anonymous'
      image.onload = () => {
        if (this.isDestroyed) return
        this.handleImageLoaded(gl, image)
      }
      image.onerror = () => {
        if (this.isDestroyed) return
        console.warn(`图片加载失败: ${img}`)
        const c = document.createElement('canvas')
        c.width = 1
        c.height = 1
        this.rawImageCanvas = c
        this.ready = true
        this.hasData = false
        this.requestRepaint()
      }
      image.src = img
    } else if (img instanceof HTMLCanvasElement) {
      this.handleImageLoaded(gl, img)
    } else {
      // HTMLImageElement — may already be loaded
      if (img.complete && img.naturalWidth > 0) {
        this.handleImageLoaded(gl, img)
      } else {
        img.onload = () => {
          if (this.isDestroyed) return
          this.handleImageLoaded(gl, img as HTMLImageElement)
        }
      }
    }
  }

  private handleImageLoaded(
    gl: WebGL2RenderingContext | WebGLRenderingContext,
    img: HTMLImageElement | HTMLCanvasElement
  ): void {
    // Keep a canvas copy for getGridDataByLatLon pixel queries
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    this.rawImageCanvas = canvas

    if (!this.dataTexture) {
      this.dataTexture = createTexture(gl, img, 0, this.opts.grid!, this.opts.flipy === 1)
    } else {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.dataTexture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.opts.flipy === 1 ? 1 : 0)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    }

    this.ready = true
    this.hasData = true
    this.requestRepaint()
  }

  private loadCutImage(url: string): void {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (this.isDestroyed || !this.gl || !this.program) return
      const gl = this.gl
      gl.useProgram(this.program)
      this.cutTexture = createTexture(gl, image, 2, false, true)
      if (this.u_cut) gl.uniform1i(this.u_cut, 2)
      if (this.u_cutArea) {
        gl.uniform4f(
          this.u_cutArea,
          this.opts.cutlatmin!,
          this.opts.cutlatmax!,
          this.opts.cutlonmin!,
          this.opts.cutlonmax!
        )
      }
      this.requestRepaint()
    }
    image.onerror = () => {
      console.warn('裁剪图片加载失败')
    }
    image.src = url
  }

  private updateColorRamp(): void {
    if (!this.gl || !this.program) return
    const gl = this.gl

    const { vmin, vmax, canvas } = generateColorRamp(this.opts.colors, this.opts.linear)
    this.vmin = vmin
    this.vmax = vmax

    if (!this.colorTexture) {
      this.colorTexture = createTexture(gl, canvas, 1, false, false)
    } else {
      gl.useProgram(this.program)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, this.colorTexture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
      gl.uniform2f(this.u_vrange, vmin, vmax)
    }
    this.requestRepaint()
  }

  private requestRepaint(): void {
    if (this.map) {
      this.map.triggerRepaint()
    }
  }
}
