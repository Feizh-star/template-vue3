/**
 * ColorfulMapImage：正式实现的完整副本与中文注释版本。
 *
 * 本文件保留正式版的所有代码、Shader 字符串和公开 API，只增加详细说明。
 * 业务入口 index.ts 仍默认使用 ColorfulMapImage.ts；这里供逐段阅读和理解。
 * 正式版后续更新时，应同步对应代码，保证两个版本的执行逻辑一致。
 *
 * 渲染管线：
 *   编码图片 → 数据纹理(TEXTURE0) → RGBA / scale 解码 → 色带(TEXTURE1) → 地图片元
 *   裁剪图片 → 遮罩纹理(TEXTURE2) → R > 0.5 时丢弃片元
 *
 * 统一更新管线：
 *   constructor：保存默认配置与初始参数，不操作 GL。
 *   onAdd：创建基础 GL 资源，再 setOption(完整目标配置)。
 *   setOption：浅合并目标参数，按主图组 / 裁剪组累计 dirty。
 *   loadResource：准备资源，加载回调只记录就绪，不直接操作 GL。
 *   render → commitOptions：分别提交已就绪的组，再用已提交状态绘制。
 *
 * 两个独立资源组：
 *   主图组：除 cut、cutUrl 和四个裁剪范围外的全部参数。
 *   裁剪组：cut、cutUrl、cutlatmin、cutlatmax、cutlonmin、cutlonmax。
 *   显式提交 img / cutUrl 时，该组全部待提交字段一起等待图片。
 *   等待期间追加的同组修改继续合并，另一组可以独立提交。
 *   Canvas 和已加载 Image 不等待网络，但仍在下一次 render 中统一生效。
 *
 * 三类状态：
 *   opts：调用方期望的最新目标值，可能尚未生效。
 *   applied：当前已提交配置，绘制与像素查询共同读取。
 *   group：该组请求版本、加载标记、待上传来源和待提交字段集合。
 *
 * 生命周期：onRemove 可重新添加；destroy 后不再接受添加或更新。
 * 实际使用 GLSL ES 3.00 和 VAO，需要 WebGL2 上下文。
 * 参数说明与使用示例见同目录 explorer.md。
 */
import type maplibregl from 'maplibre-gl'
import type { IColorfulMapImageOptions, IColorRange, IGridDataResult } from './types'

// ========== GLSL Shaders ==========

// 顶点着色器：a_position 是归一化 Web Mercator 地面坐标，不是图片 UV。
// u_matrix 使用地图当前相机矩阵，负责缩放、旋转、倾斜等投影变换。
// u_worldOffset 给 x 加整数，在不重复上传几何的情况下绘制世界副本。
// mercatorPosition 保持原坐标，使每个世界副本沿用相同的经纬度采样规则。
// GLSL 字符串保持正式版原样，下面的数学计算不受本文件注释影响。
const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
uniform mat4 u_matrix;
uniform float u_worldOffset;
out vec2 mercatorPosition;
void main() {
    gl_Position = u_matrix * vec4(a_position.x + u_worldOffset, a_position.y, 0.0, 1.0);
    mercatorPosition = a_position;
}`

// Shared by both fragment shaders so clipping cannot change the opacity curve.
// 共用低值透明度函数：正数下限沿用裁剪版 smoothstep，负数下限按升序排列边界。
// 两边界相等时退化为阶跃阈值，避免零下限下 smoothstep 的未定义行为。
const MIN_OPACITY_GLSL = `
float minimumOpacity(float value, float minValue) {
    float edge0 = minValue * 0.5;
    float edge1 = minValue * 2.0;
    if (edge0 == edge1) {
        return step(edge0, value);
    }
    return smoothstep(min(edge0, edge1), max(edge0, edge1), value);
}`

// 遮罩版片元着色器：Mercator 反变换得到 vec2(纬度, 经度)。
// 纬度通过 atan(exp(y)) 反算；经度通过单位世界坐标线性反算。
// cutArea=[南纬,北纬,西经,东经]，将地理位置归一化为遮罩 UV。
// 遮罩 R>0.5 的片元直接 discard，不再执行数据解码与色带取样。
// tbound 同样按 [latmin,latmax,lonmin,lonmax] 排列，计算主图 UV。
// texture 的 RGBA 在 0~1，乘 255 后逐通道除以 scale 得到数据值。
// vrange=[vmin,vmax] 将值映射到色带横坐标，纵坐标固定为 0.5。
// minOpacity 使用共用函数淡化低值 alpha，最终输出预乘 alpha 的 RGB。
// 主图范围由地面矩形约束；遮罩 UV 越界时 CLAMP_TO_EDGE 沿用边缘值。
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

// 无遮罩版本省去遮罩取样，并显式检查经纬度是否位于 tbound 内。
// 范围外直接 discard；范围内按相同 RGBA / scale 协议解码并查询色带。
// 低值透明度与遮罩版本共用同一函数，切换裁剪不会改变遮罩内片元的透明度。
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

// 编译单个 Shader，失败时附带驱动日志抛出异常并删除失败对象。
// 成功的 Shader 暂时返回给 updateProgram，链接完成后不再需要独立 Shader 对象。
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

// 把顶点与片元 Shader 链接成 program。
// 链接失败删除新 program 并抛出异常；调用方可以继续保留旧 program。
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

// 主图、色带和遮罩复用的纹理上传函数，textureUnit 分别为 0、1、2。
// useNearest 控制最近邻/线性插值，flipY 控制上传方向。
// 每次明确设置 pixelStorei，因为它属于共享 GL 状态，会被其他上传操作修改。
function createTexture(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  source: HTMLImageElement | HTMLCanvasElement,
  textureUnit: number,
  useNearest: boolean,
  flipY: boolean
): WebGLTexture {
  const texture = gl.createTexture()!
  try {
    gl.activeTexture(gl.TEXTURE0 + textureUnit)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY ? 1 : 0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // 缩小与放大过滤器分别为 MIN_FILTER 和 MAG_FILTER。
    // 主图 grid=true 使用 NEAREST 保留网格边界，色带和遮罩使用 LINEAR。
    if (useNearest) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }
    // UV 的 S/T 方向均钳制到边缘，不重复整张图片。
    // texImage2D 才真正将像素上传到 GPU，DOM 来源与纹理对象不是同一份资源。
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    return texture
  } catch (error) {
    // 若上传因为跨域限制等抛出异常，释放新纹理后继续上抛，避免失败路径泄漏。
    gl.deleteTexture(texture)
    throw error
  }
}

// 生成横向 Canvas 色带，让 GPU 通过纹理查表，避免每个片元遍历颜色数组。
// v 是阈值，r/g/b/o 是颜色与透明度；数组长度和阈值顺序由调用方保证。
// vmin/vmax 必须和本次色带纹理一起提交，否则数据值对应的色带位置会错位。
// 沿用最后阈值 + 5、宽度 25*len+5、高度 3 的原有色带设计。
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

  // 每段用同一种颜色添加两个 stop，控制该档颜色保持不变的范围。
  // linear=0 时颜色保持到下一阈值，形成阶梯；linear=1 时保留完整渐变区间。
  for (let i = 0; i < len - 1; i++) {
    const stop1 = (colors.v[i] - vmin) / (vmax - vmin)
    const stop2 =
      (colors.v[i + 1] - (colors.v[i + 1] - colors.v[i]) * linear - vmin) / (vmax - vmin)
    const color = `rgba(${colors.r[i]},${colors.g[i]},${colors.b[i]},${colors.o[i]})`
    gradient.addColorStop(stop1, color)
    gradient.addColorStop(stop2, color)
  }

  // 最后一档延伸到色带终点，覆盖数值上界的额外余量。
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

// 经度 -180~180 映射为 x=0~1，纬度通过对数映射为 y，北方向对应较小的 y。
// 返回单位世界的地面坐标，不是屏幕像素，也不是原始图片的网格索引。
function lngLatToMercator(lng: number, lat: number): { x: number; y: number } {
  const x = lng / 360 + 0.5
  const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat / 2) * (Math.PI / 180))) / (2 * Math.PI)
  return { x, y }
}

// ========== Main Class ==========

// 选项键类型用于约束 dirty 和 CUT_KEYS；ImageSource 是可上传的 DOM 像素来源。
type OptionKey = keyof IColorfulMapImageOptions
type ImageSource = HTMLImageElement | HTMLCanvasElement

// 仅显式列举裁剪字段；其余全部归主图组，包括 colors、beforeId、getGrid。
// 因此 img 与 colors 同传时，色带不会提前套用到旧图片。
const CUT_KEYS = new Set<OptionKey>([
  'cut',
  'cutUrl',
  'cutlatmin',
  'cutlatmax',
  'cutlonmin',
  'cutlonmax',
])

// Both resource groups use the same loading and commit lifecycle.
// 主图和遮罩共用同一最小状态结构，不维护额外任务队列。
// dirty 累计字段，最新目标值统一读取 opts；成功提交后清空本轮状态。
function createResourceGroup() {
  return {
    // 请求版本在新加载、回退、移除或销毁时递增，迟到回调必须匹配当前版本。
    version: 0,
    // true 时暂停整组提交；加载结束只解除等待锁，生效仍要等 render。
    loading: false,
    // 已加载但未上传的来源；提交成功后清空，长期缓存保存在图层字段中。
    source: null as ImageSource | null,
    // 解除本次 load/error 监听，不承诺停止网络下载；版本检查另行阻止旧结果回写。
    cancel: null as (() => void) | null,
    // 集合对字段去重，让同一帧多个范围或色带修改只进行一次必要更新。
    dirty: new Set<OptionKey>(),
  }
}

type ResourceGroup = ReturnType<typeof createResourceGroup>

// 本帧可绘制快照：参数与资源在提交边界统一确定；null 遮罩表示本帧无遮罩。
type DrawState = {
  options: IColorfulMapImageOptions
  program: WebGLProgram
  dataTexture: WebGLTexture
  colorTexture: WebGLTexture
  cutTexture: WebGLTexture | null
}

// MapLibre custom 图层，onAdd/onRemove/render 由地图生命周期触发。
// 此注释版导出独立的同名类，业务默认入口仍指向正式版。
export class ColorfulMapImage implements maplibregl.CustomLayerInterface {
  // id 表示自身身份；beforeId 仅表示插入目标，移动图层不改变自身 id。
  // 2d 模式沿用地面叠加逻辑，没有引入高度或新的三维渲染流程。
  id: string
  type: 'custom' = 'custom'
  renderingMode: '2d' = '2d'

  // 地图提供共享 GL，本类仅管理自己创建的 program、VAO、buffer 和纹理。
  // vao 保存顶点输入绑定，vbuffer 保存四个地面顶点；三个纹理分别存数据、色带、遮罩。
  // usesCut 是实际 program 模式，不等同于可能还在等待的 opts.cut。
  private map: maplibregl.Map | null = null
  private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private vbuffer: WebGLBuffer | null = null
  private dataTexture: WebGLTexture | null = null
  private colorTexture: WebGLTexture | null = null
  private cutTexture: WebGLTexture | null = null
  private usesCut = false

  // 缓存当前 program 的 uniform location，避免每帧查找。
  // 更换 program 后必须重新获取，旧 program 的 location 不能继续使用。
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
  // opts 接收目标参数；applied 提供已生效参数，两者由 commitOptions 同步。
  // main 与 mask 分别等待各自资源，一组就绪不会要求另一组也同时就绪。
  private opts: IColorfulMapImageOptions
  private applied: IColorfulMapImageOptions
  private main = createResourceGroup()
  private mask = createResourceGroup()
  // 终止标记让后续添加、更新和回调成为无操作；vmin/vmax 与当前色带配套。
  private isDestroyed = false
  private vmin = 0
  private vmax = 0
  // rawImageCanvas 供 CPU 查询，保持原始像素方向，不应用 GPU 的 flipy。
  // imageSource 供翻转时重上传：Image 保留原始输入，Canvas 保留提交时的快照。
  // projectionMatrix 复用数组，减少每帧临时对象。
  private rawImageCanvas: HTMLCanvasElement | null = null
  private imageSource: ImageSource | null = null
  private projectionMatrix = new Float32Array(16)

  // 只合并默认值并保存配置，不加载图片、不操作 GL，支持添加前 setOption。
  // copyOptions 隔离 scale/colors 的引用，防止调用方后续原地修改影响已有状态。
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
    // 首轮 applied 作为合并和失败回退的配置基线，此时还没有实际纹理。
    // 绘制与查询另行检查资源，不能仅以初始 applied 存在判断数据就绪。
    this.applied = { ...this.opts }
  }

  // 创建最小 GL 基础资源，再通过 setOption 进入和后续更新相同的处理流程。
  // 初始使用无遮罩 program，遮罩完成后由 applyCut 切换。
  // 正常移除后重新添加也会从最新 opts 重新加载，不能复用已释放的 GL 资源。
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

  // 先使两组旧请求失效，再删除本图层的 GL 资源和 CPU 缓存。
  // 不设置 isDestroyed，所以正常 removeLayer 后仍可以重新添加。
  // 保留 opts 中最新目标值，包括移除时尚未完成的更新，供重新添加初始化。
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
    // 清空查询缓存与上传来源，避免移除后查询继续返回已卸载的数据。
    this.rawImageCanvas = null
    this.imageSource = null
    this.usesCut = false
  }

  // 每帧先 prepareDrawState，由提交边界判断本帧资源是否满足绘制要求。
  // 先检查 gl 身份与销毁状态，避免旧上下文操作重新添加后的资源。
  // render 只消费快照，不解释目标配置、加载状态或实际 Shader 模式。
  render(
    gl: WebGL2RenderingContext | WebGLRenderingContext,
    options: maplibregl.CustomRenderMethodInput
  ): void {
    if (this.isDestroyed || gl !== this.gl) return
    const state = this.prepareDrawState()
    if (!state) return

    const map = this.map!
    // 本帧范围、解码、透明度、遮罩配置都来自同一份已生效状态。
    const { options: opts, program, dataTexture, colorTexture, cutTexture } = state
    gl.useProgram(program)
    ;(gl as WebGL2RenderingContext).bindVertexArray(this.vao)
    // 使用地图相机矩阵将 Mercator 地面矩形变换到裁剪空间。
    // 无需自行计算屏幕覆盖矩形或另外推算地图平移和缩放。
    this.projectionMatrix.set(options.defaultProjectionData.mainMatrix)
    gl.uniformMatrix4fv(this.u_matrix, false, this.projectionMatrix)
    // tbound 与几何同步；scale 负责 RGBA 解码，vrange 负责归一化色带取样。
    // 只改 scale/minOpacity 时无需重新上传图片，提交后直接更新 uniform。
    gl.uniform4f(this.u_tbound, opts.latmin, opts.latmax, opts.lonmin, opts.lonmax)
    gl.uniform4f(this.u_scale, opts.scale.r, opts.scale.g, opts.scale.b, opts.scale.a)
    gl.uniform1i(this.u_tminOpacity, opts.minOpacity ? 1 : 0)
    gl.uniform2f(this.u_vrange, this.vmin, this.vmax)

    // 每帧重新绑定纹理，避免共享上下文中其他图层的状态影响本次绘制。
    // uniform1i 接收槽编号 0/1/2，而不是 TEXTURE0 等 GL 枚举常量。
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, dataTexture)
    gl.uniform1i(this.u_img, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, colorTexture)
    gl.uniform1i(this.u_color, 1)
    // 快照已将实际 Shader 模式映射为本帧遮罩；缓存但未启用的遮罩不会带入绘制。
    // 遮罩纹理和 cutArea 来自同一已提交裁剪状态。
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

    // 根据地图中心经度确定世界编号；开启世界副本时绘制中心及相邻两个世界。
    // 关闭副本时只绘制原始世界；重复部分只改 u_worldOffset，不再上传几何。
    const centerWorld = Math.floor((map.getCenter().lng + 180) / 360)
    const worldOffsets = map.getRenderWorldCopies()
      ? [centerWorld - 1, centerWorld, centerWorld + 1]
      : [0]
    for (const worldOffset of worldOffsets) {
      gl.uniform1f(this.u_worldOffset, worldOffset)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
  }

  // 将可选插入位置保存到统一选项，并立即调用地图 addLayer。
  // 自身 id 独立生成，避免 beforeId 指向现有图层时发生身份冲突。
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
  // 唯一参数更新入口，返回 this；默认先保存目标状态，再安排下一帧提交。
  // 浅合并：遗漏/undefined 保留，false/0 生效，scale/colors 完整替换。
  // 显式 img/cutUrl 即使值相同也重新准备资源，支持相同 URL 或已修改的 Canvas 刷新。
  setOption(options: Partial<IColorfulMapImageOptions>): this {
    if (this.isDestroyed) return this
    // 先合并全部目标值再启动加载，img 与 useCros 同传时使用本次新的跨域配置。
    const patch = this.copyOptions(options)
    this.opts = { ...this.opts, ...patch }
    // 只累计本次实际提供的字段，等待期间继续追加，不直接修改 applied。
    for (const key of Object.keys(patch) as OptionKey[]) {
      ;(CUT_KEYS.has(key) ? this.mask : this.main).dirty.add(key)
    }
    // 添加前只保存目标值；onAdd 后由完整配置启动相同加载流程。
    // 普通字段不重新加载图片；useCros 单独更新影响后续请求，遮罩始终 anonymous。
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

  // 与绘制共用 applied，避免旧图片搭配新范围、新间隔或新 scale。
  // 查询不触发提交；未启用 getGrid、无图片或缺少 interval 时返回 null。
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
    // 按统一经纬度间隔换算像素索引，沿用原有四舍五入和原始图片方向。
    // 不按图片宽高反推间隔，也不应用 GPU 翻转、线性采样、色带或裁剪。
    const x = Math.round((lon - lonmin) / interval)
    const y = Math.round((lat - latmin) / interval)
    const ctx = this.rawImageCanvas.getContext('2d')
    if (!ctx) return { data: null, lat, lon }
    try {
      // 读取一个 RGBA 像素，按与 Shader 相同的除法协议解码。
      // Canvas 跨域读取限制等异常在 catch 中转换为 data:null。
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

  // 幂等终止：先禁止后续操作并使两组请求失效，再让地图移除图层。
  // GL 释放由地图调用 onRemove 执行；添加前销毁也会禁止之后的 addTo。
  destroy(): void {
    if (this.isDestroyed) return
    this.isDestroyed = true
    this.resetGroup(this.main)
    this.resetGroup(this.mask)
    if (this.map) this.map.removeLayer(this.id)
  }

  // 按 undefined 过滤，不能用真假判断，否则会丢弃 false/0。
  // 复制 scale、colors 及数组只用于隔离引用，仍然是整体替换，不做深层合并。
  // Image/Canvas 保留 DOM 引用；Canvas 像素快照在资源提交阶段生成。
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

  // 统一清理：递增版本、解除监听、清空来源、加载标记和待提交字段。
  // 即使旧事件已排队，递增版本也会阻止它回写新一轮状态。
  private resetGroup(group: ResourceGroup): void {
    group.version++
    group.cancel?.()
    group.cancel = null
    group.source = null
    group.loading = false
    group.dirty.clear()
  }

  // 失败时只回退本组 dirty 字段，不覆盖另一组的目标值或待加载请求。
  // 保留之前可用纹理；首次主图失败没有可用资源，render 将跳过绘制。
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

  // 主图/遮罩共用资源准备函数，支持 URL、Image 和 Canvas。
  // 新请求替换监听与 source，但保留 dirty，继承同组已累计的其他目标参数。
  // 回调只标记就绪并请求重绘，不在渲染之外直接操作共享 GL。
  private loadResource(
    group: ResourceGroup,
    source: IColorfulMapImageOptions['img'],
    crossOrigin: boolean
  ): void {
    group.cancel?.()
    group.cancel = null
    group.source = null
    group.loading = true
    // 闭包捕获本次版本，后续加载、回退或移除会递增当前版本。
    // 还必须检查上下文存在，正常移除未 destroy 的旧请求也不能继续操作。
    const version = ++group.version
    const isCurrent = () => !this.isDestroyed && !!this.gl && group.version === version
    // 成功只解除等待锁并暂存 source；像素上传和参数生效仍在下一次 render。
    // 因此加载结束与 render 之间的新 setOption 仍可合并到这次提交。
    const succeed = (image: ImageSource) => {
      if (!isCurrent()) return
      group.cancel?.()
      group.cancel = null
      group.source = image
      group.loading = false
      this.requestRepaint()
    }
    // 只有当前请求失败才能回退，旧请求的迟到错误不会撤销新目标。
    const fail = () => {
      if (isCurrent()) this.discardGroup(group, new Error('图片无法加载'))
    }

    // Canvas 已有像素，无需网络等待，暂存来源后安排统一提交。
    if (source instanceof HTMLCanvasElement) {
      succeed(source)
      return
    }
    // An empty cutUrl clears the cached mask without starting a request.
    // 空 cutUrl 是清除遮罩操作，下一帧删除缓存并切换 Shader，不启动图片请求。
    // undefined 被忽略，不能用于清除；空 img 则继续走普通加载逻辑。
    if (source === '' && group === this.mask) {
      group.loading = false
      return
    }
    // URL 使用内部 Image，外部 Image 沿用自己的 src/跨域配置。
    // complete 可能也代表失败，需要结合 naturalWidth 验证，不只检查 complete。
    const image = typeof source === 'string' ? new Image() : source
    const loaded = () => (image.naturalWidth > 0 ? succeed(image) : fail())
    if (typeof source !== 'string' && image.complete) {
      loaded()
      return
    }
    // 监听不会覆盖调用方的 onload/onerror，成功、失败或替换时解除本次监听。
    // 先添加监听和设置 crossOrigin，再赋 src，避免错过加载结果或跨域配置。
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
  // 统一提交后发布本帧快照，资源不足返回 null；不维护额外的跨回调绘制状态。
  private prepareDrawState(): DrawState | null {
    this.commitOptions()
    if (!this.program || !this.dataTexture || !this.colorTexture) return null

    // A committed cut remains required until its replacement/disable commits.
    // Otherwise an enabling request must wait instead of exposing an uncut frame.
    // 优先满足已生效裁剪，避免等待中的关闭请求绕过它；否则满足最新目标的开启要求。
    const cutRequirement = this.applied.cut && this.applied.cutUrl ? this.applied : this.opts
    // 只有裁剪 program 使用的纹理才是可绘制遮罩；禁用时缓存的纹理不代表就绪。
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

  // 分别处理两个组：loading 时跳过，dirty 为空时无需更新。
  // 从 applied 构造 next，只覆盖本组字段，防止提前带入另一组未就绪的目标值。
  // 两组独立提交，不要求两张图片同时就绪。
  private commitOptions(): void {
    for (const group of [this.main, this.mask]) {
      if (group.loading || group.dirty.size === 0) continue
      const next = { ...this.applied }
      for (const key of group.dirty) Object.assign(next, { [key]: this.opts[key] })
      try {
        if (group === this.main) this.applyMain(next, group)
        else this.applyCut(next, group)
        // 资源应用成功后才发布配置，并清除本轮 source/dirty。
        // 之后绘制与 CPU 查询同时看到新状态。
        this.applied = next
        group.source = null
        group.dirty.clear()
      } catch (error) {
        this.discardGroup(group, error)
      }
    }
  }

  // 初始化和后续主图更新共用此方法，按 dirty 决定哪些资源需要处理。
  // 候选 Canvas、来源、纹理与色带先放局部变量，准备失败不立即覆盖旧缓存。
  // 只改范围更新几何；只改解码、透明度、间隔和查询开关不上传主图。
  private applyMain(next: IColorfulMapImageOptions, group: ResourceGroup): void {
    const gl = this.gl!
    const dirty = group.dirty
    let canvas = this.rawImageCanvas
    let source = this.imageSource
    let dataTexture: WebGLTexture | null = null
    let colorTexture: WebGLTexture | null = null
    let ramp: ReturnType<typeof generateColorRamp> | null = null
    try {
      // 创建 CPU 查询副本；Image 使用 naturalWidth/Height，防止 CSS/显示尺寸改变网格。
      // Canvas 使用自身宽高，在正式纹理提交的同一帧建立快照。
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
      // 新来源、flipy 变化或无旧纹理时才创建数据纹理；翻转复用缓存，不重复下载。
      // 上传时同时设置最新 grid，避免新图片与已提交采样方式不一致。
      if (source && (group.source || dirty.has('flipy') || !this.dataTexture)) {
        dataTexture = createTexture(gl, source, 0, !!next.grid, next.flipy === 1)
      }
      // 无色带或 colors/linear 有更新才生成一次色带，两个字段同批更新也只生成一次。
      // 仅更新图片时可沿用当前色带。
      if (!this.colorTexture || dirty.has('colors') || dirty.has('linear')) {
        ramp = generateColorRamp(next.colors, next.linear)
        colorTexture = createTexture(gl, ramp.canvas, 1, false, false)
      }
      // 图层顺序也属于主图组，和 img 同传时一并等待。
      // 使用稳定的自身 id 调用 moveLayer，同一 beforeId 不重复移动。
      if (dirty.has('beforeId') && next.beforeId !== this.applied.beforeId) {
        this.map!.moveLayer(this.id, next.beforeId)
      }
      // 首次建立主图必须上传几何，即使本次只修改 img。
      // 覆盖首次加载失败、dirty 已清空后，仅替换图片恢复的场景。
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
    // 候选纹理准备完成后才删除并替换旧纹理。
    // 只改 grid 时复用当前纹理，仅设置过滤器，无需 texImage2D。
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
    // 色带纹理与对应数值范围一同更新，保证数据到颜色的映射一致。
    if (colorTexture && ramp) {
      if (this.colorTexture) gl.deleteTexture(this.colorTexture)
      this.colorTexture = colorTexture
      this.vmin = ramp.vmin
      this.vmax = ramp.vmax
    }
    // 资源准备成功后发布查询缓存和重上传来源。
    this.rawImageCanvas = canvas
    this.imageSource = source
  }

  // 新遮罩来源上传一次；没有新来源时复用缓存。
  // 实际启用需 cut、非空 URL 与可用纹理三者同时成立。
  // 仅 cut:false 可直接切换；与 cutUrl 同传时由加载锁保证整组等待。
  private applyCut(next: IColorfulMapImageOptions, group: ResourceGroup): void {
    const gl = this.gl!
    const texture = group.source ? createTexture(gl, group.source, 2, false, true) : null
    // 显式清空 URL 才释放缓存；cut:false 保留纹理，便于稍后立即开启。
    const clear = group.dirty.has('cutUrl') && !next.cutUrl
    try {
      // 先准备对应 program，若编译失败则释放候选遮罩并保留旧 program/纹理。
      // 模式不变时 updateProgram 复用现有 program。
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

  // 初始化和裁剪切换共享 program 创建流程。
  // 先编译/链接新的对象，finally 删除临时 Shader，成功后再替换旧 program。
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
    // 新链接成功后替换 program，并重新获取全部 uniform location。
    // usesCut 记录实际模式，不能依赖尚未提交的 opts.cut。
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
    // 不同 program 的 attribute location 可能不同，因此需重新配置 VAO。
    // 每顶点两个 FLOAT、紧密排列，仍复用原 vbuffer。
    // 括号表达式前的分号用于避免无分号风格下与上一句意外拼接。
    const posLoc = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    ;(gl as WebGL2RenderingContext).bindVertexArray(null)
  }

  // 根据待提交 next 参数生成单位 Mercator 地面矩形，不读等待中的 opts。
  // 顶点为西北、西南、东北、东南，TRIANGLE_STRIP 用四点组成两个三角形。
  // 只有首次主图准备或范围变化才更新 buffer。
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

  // 请求地图安排下一帧，不直接绘制，也不创建轮询 requestAnimationFrame。
  // 添加前或移除后 map=null，这里成为无操作。
  private requestRepaint(): void {
    this.map?.triggerRepaint()
  }
}
