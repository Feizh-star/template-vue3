/**
 * ============================================================================
 * ColorfulMapImage — MapLibre 开源地图库自定义图层插件
 * ============================================================================
 *
 * 功能：将一张使用特殊算法编码的数据纹理 PNG 叠加到 MapLibre 地图上。数据经纬度范围
 *       被转换成 Web Mercator 地面矩形，通过 MapLibre 相机矩阵投影；Fragment Shader
 *       再按原协议解码数据值并通过颜色查找表渲染。
 *
 * ----------------------------------------------------------------------------
 * 整体渲染管线（从上到下，标注了对应的代码位置）
 * ----------------------------------------------------------------------------
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ 1. 构造 & 初始化                                                        │
 * │    constructor()                              → [L589]                  │
 * │    merge 默认选项 + 用户选项                                            │
 * │    MapLibre 调用 onAdd(map, gl)                → [L623]                  │
 * │      ├─ 编译 Vertex Shader                    → VERTEX_SHADER [L115]    │
 * │      ├─ 编译 Fragment Shader                                        │
 * │      │    ├─ cut=true  → FRAGMENT_SHADER_WITH_CUT  [L137]              │
 * │      │    └─ cut=false → FRAGMENT_SHADER_NO_CUT   [L229]               │
 * │      ├─ link Program                          → createProgram() [L326]  │
 * │      ├─ 获取所有 uniform location                                    │
 * │      ├─ 创建地理范围矩形 VAO（Mercator [0,1] 的 Triangle Strip）          │
 * │      ├─ 加载数据纹理图片 → loadImage()          → [L1172]                │
 * │      ├─ 生成颜色渐变查找纹理 → updateColorRamp() → [L1312]               │
 * │      └─ 加载裁剪遮罩图片（可选）→ loadCutImage()  → [L1276]              │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                     │
 *                                     ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ 2. 每帧渲染                                                             │
 * │    MapLibre 调用 render(gl, options)           → [L732]                  │
 * │      ├─ 读取 defaultProjectionData.mainMatrix                          │
 * │      │    └─ 矩阵包含 zoom / center / bearing / pitch / perspective     │
 * │      ├─ 传入所有 uniform                                                │
 * │      │    ├─ u_matrix: Mercator 世界坐标 → clip-space                   │
 * │      │    ├─ u_worldOffset: 横向世界副本编号                              │
 * │      │    ├─ u_tbound: 数据地理边界 [latmin, latmax, lonmin, lonmax]      │
 * │      │    ├─ u_scale:  数据解码比例 [r, g, b, a]                        │
 * │      │    ├─ u_tminOpacity: 低值透明度淡化开关                           │
 * │      │    └─ u_vrange: 颜色映射值域 [vmin, vmax]                        │
 * │      ├─ 绑定三张纹理                                                │
 * │      │    ├─ TEXTURE0: 数据纹理（u_img）                                │
 * │      │    ├─ TEXTURE1: 颜色渐变纹理（u_color）                            │
 * │      │    └─ TEXTURE2: 裁剪遮罩纹理（cutImg，可选）                       │
 * │      └─ 绘制地面矩形及世界副本 → drawArrays(TRIANGLE_STRIP, 0, 4)         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                     │
 *                                     ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ 3. Fragment Shader 逐像素处理（GPU）                                     │
 * │    顶点 Mercator 坐标经透视校正插值 → mercatorPosition                    │
 * │    mercatorToLatlng(mercatorPosition) → 经纬度                          │
 * │                                                                 │
 * │    cut 路径：检查遮罩纹理，遮罩区域 discard                               │
 * │    no-cut 路径：检查是否在 tbound 范围内，范围外 discard                    │
 * │                                                                 │
 * │    经纬度 → 纹理 UV → 采样数据纹理(u_img) × 255 → RGBA 原始字节             │
 * │    value = R/scale.r + G/scale.g + B/scale.b + A/scale.a  数据解码       │
 * │                                                                 │
 * │    vin = (value - vmin) / (vmax - vmin)     值域归一化                  │
 * │    outColor = texture(u_color, vec2(vin, 0.5))   颜色查找                │
 * │                                                                 │
 * │    minOpacity: 低值透明度淡化（两种路径不同的淡化区间）                      │
 * │      cut 路径:    smoothstep(vmin*0.5, vmin*2.0, value)                │
 * │      no-cut 路径: clamp((value-vmin*0.8)/(0.5*vmin), 0, 1) 线性淡化      │
 * │                                                                 │
 * │    outColor.rgb *= outColor.a   预乘 alpha，配合 MapLibre blend 模式     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                     │
 *                                     ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ 4. 运行时更新 API                                                        │
 * │    changeImage()        → [L848]   更新数据纹理图片                       │
 * │    changeAll()          → [L864]   批量更新 scale/colors/img/minOpacity  │
 * │    changeImageArea()    → [L918]   更新图片 + 地理范围 + grid + colors    │
 * │    changeColors()       → [L976]   更新颜色映射                          │
 * │    changeLinear()       → [L989]   更新颜色渐变线性度                     │
 * │    changeGrid()         → [L1004]  切换最近邻/线性纹理采样                │
 * │    setGetGrid()         → [L1035]  启用/禁用像素值查询                   │
 * │    getGridDataByLatLon()→ [L1062]  读取指定经纬度的解码数值               │
 * │    destroy()            → [L1105]  从地图移除图层                        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                     │
 *                                     ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ 5. 清理                                                                 │
 * │    MapLibre 调用 onRemove(map, gl)          → [L696]                    │
 * │    删除 Program / VAO / Buffer / 所有 Texture，置空引用                   │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import type maplibregl from 'maplibre-gl'
import type { IColorfulMapImageOptions, IColorRange, IGridDataResult } from './types'

// ============================================================================
// GLSL Shaders
// ============================================================================

/**
 * Vertex Shader — 地理范围矩形
 *
 * a_position 存储数据边界四角的归一化 Web Mercator 坐标：
 * x=0/1 分别代表世界最西/最东，y=0/1 分别代表世界最北/最南。
 *
 * u_matrix 来自 MapLibre 每帧传入的 defaultProjectionData.mainMatrix，负责完整处理
 * zoom、平移、bearing、pitch、相机透视和视口偏移。因此这里不再假设屏幕像素与地面坐标
 * 是简单的线性关系，地图倾斜后仍能把矩形正确投影到地面。
 *
 * u_worldOffset 是横向世界副本偏移。Web Mercator 每个世界宽度为 1，偏移 ±1 即可把
 * 同一个数据矩形绘制到相邻世界；传给片元着色器的仍是原始坐标，保证纹理 UV 不变。
 */
const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
uniform mat4 u_matrix;
uniform float u_worldOffset;
out vec2 mercatorPosition;
void main() {
    gl_Position = u_matrix * vec4(a_position.x + u_worldOffset, a_position.y, 0.0, 1.0);
    mercatorPosition = a_position;
}`

/**
 * Fragment Shader（有遮罩路径）
 *
 * 与 no-cut 版本的差异：
 *   1. 定义了 #define useCut true，引入 cutImg 和 cutArea uniform
 *   2. 先计算当前像素对应经纬度在遮罩纹理中的 UV，采样遮罩纹理 R 通道
 *   3. 若 cutValue > 0.5 → discard（该像素不渲染）
 *   4. minOpacity 使用 smoothstep 平滑过渡，区间 [vmin*0.5, vmin*2.0]
 *
 * 注意：cutArea 是按 (lat, lon) 顺序存储：(cutlatmin, cutlatmax, cutlonmin, cutlonmax)
 *       纹理采样时 UV 顺序是 (lon方向, lat方向) 即 (cutb, cuta)
 */
const FRAGMENT_SHADER_WITH_CUT = `#version 300 es
#define PI 3.141592653589793238
#define PID 57.29577951308232
#define useCut true
precision highp float;

/**
 * 归一化 Web Mercator 坐标 → 经纬度转换
 *
 * @param mercator.x Web Mercator X，0=西经 180°，1=东经 180°
 * @param mercator.y Web Mercator Y，0=北，1=南
 *
 * 顶点位置已经由 MapLibre 的矩阵投影到屏幕；片元着色器只需把 GPU 插值得到的
 * Mercator 坐标转回经纬度，以继续复用原有的 tbound/cutArea 纹理寻址协议。
 */
vec2 mercatorToLatlng(vec2 mercator) {
    float x = (mercator.x - 0.5) * 360.0;
    float y = -(mercator.y - 0.5) * PI * 2.0;
    float lat = (2.0 * atan(exp(y)) - (PI / 2.0)) * PID;
    return vec2(lat, x);
}

in vec2 mercatorPosition;
uniform sampler2D u_color;     // 颜色渐变查找纹理（1D 纹理，作为 2D 传入）
uniform sampler2D u_img;       // 数据纹理 PNG（RGBA 通道编码数据值）
uniform vec4 tbound;           // 数据地理边界 (latmin, latmax, lonmin, lonmax)
uniform vec4 scale;            // 数据解码比例 (r, g, b, a)
uniform vec2 vrange;           // 颜色映射值域 (vmin, vmax)
uniform bool tminOpacity;      // 低值透明度淡化开关
uniform sampler2D cutImg;      // 裁剪遮罩纹理
uniform vec4 cutArea;          // 遮罩地理范围 (cutlatmin, cutlatmax, cutlonmin, cutlonmax)
out vec4 outColor;             // 最终输出颜色（预乘 alpha）

void main() {
    // ---- 步骤 1: GPU 插值后的 Web Mercator 坐标 → 经纬度 ----
    // 透视校正插值由光栅化阶段完成，pitch/bearing 不需要在片元阶段单独处理。
    vec2 latlng = mercatorToLatlng(mercatorPosition);

    // ---- 步骤 2: 裁剪遮罩检查 ----
    // 将经纬度映射到遮罩纹理 UV 空间
    float cuta = (latlng.x - cutArea.x) / (cutArea.y - cutArea.x);  // lat → U
    float cutb = (latlng.y - cutArea.z) / (cutArea.w - cutArea.z);  // lon → V
    float cutValue = texture(cutImg, vec2(cutb, cuta)).r;  // 采样遮罩 R 通道
    if (cutValue > 0.5) {
        discard;  // 被遮罩的区域直接丢弃
    }

    // ---- 步骤 3: 采样数据纹理 + 解码数值 ----
    float value = 0.0;
    // 将经纬度映射到数据纹理 UV 空间
    // b: 经度方向 (lonmin→lonmax)
    // a: 纬度方向 (latmin→latmax)
    float b = (latlng.x - tbound.x) / (tbound.y - tbound.x);
    float a = (latlng.y - tbound.z) / (tbound.w - tbound.z);
    // 纹理采样得到 0..1 的 RGBA，乘以 255 恢复原始字节值（0..255）
    vec4 color = texture(u_img, vec2(a, b)) * 255.0;
    // 加权求和解码：每个通道除以对应的 scale 因子
    // scale 的典型值为 1（各通道等权重），也可设为其他值调整权重
    value = color.r / scale.x + color.g / scale.y + color.b / scale.z + color.a / scale.w;

    // ---- 步骤 4: 值域归一化 + 颜色查找 ----
    // 将解码值映射到颜色查找纹理的 [0,1] 范围
    float vin = (value - vrange.x) / (vrange.y - vrange.x);
    // 颜色查找纹理是 1D 渐变（存储为 2D 纹理），采样 Y 坐标 0.5 处的颜色
    outColor = texture(u_color, vec2(vin, 0.5));

    // ---- 步骤 5: minOpacity 低值淡化（smoothstep 路径） ----
    // 对于小于颜色映射最小值的像素，通过淡化 alpha 使其透明
    // smoothstep(minv, maxv, value): value<minv→0, value>maxv→1, 中间 Hermite 插值
    if (tminOpacity) {
        float minv = vrange.x * 0.5;   // 下限 = vmin 的一半
        float maxv = vrange.x * 2.0;   // 上限 = vmin 的两倍
        float o = smoothstep(minv, maxv, value);
        outColor.a = outColor.a * o;   // 乘以淡化系数
    }

    // ---- 步骤 6: 预乘 alpha ----
    // MapLibre 默认 blend 模式为 (ONE, ONE_MINUS_SRC_ALPHA)，期望预乘 alpha 输入。
    // 必须在 shader 中预乘，否则 RGB 和 A 的混合结果不一致。
    outColor.rgb *= outColor.a;
}`

/**
 * Fragment Shader（无遮罩路径）
 *
 * 与 cut 版本的差异：
 *   1. 没有 cutImg/cutArea uniform 和相关逻辑
 *   2. 用 if (latlng 在 tbound 范围内) ... else discard 替代遮罩
 *   3. minOpacity 使用线性 clamp 过渡，区间 [vmin*0.8, vmin*1.3]
 *
 * 两条路径的 minOpacity 区间不同是因为原 hxmap 代码中的既有差异，此处原样保留。
 */
const FRAGMENT_SHADER_NO_CUT = `#version 300 es
#define PI 3.141592653589793238
#define PID 57.29577951308232
precision highp float;

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
    // ---- 步骤 1: GPU 插值后的 Web Mercator 坐标 → 经纬度（同上） ----
    vec2 latlng = mercatorToLatlng(mercatorPosition);

    // ---- 步骤 2: 边界裁剪 ----
    // 无遮罩时直接用地理边界判断，范围外的像素丢弃
    float value = 0.0;
    if (latlng.x >= tbound.x && latlng.x <= tbound.y &&
        latlng.y >= tbound.z && latlng.y <= tbound.w) {
        // ---- 步骤 3: 采样 + 解码 ----
        float b = (latlng.x - tbound.x) / (tbound.y - tbound.x);
        float a = (latlng.y - tbound.z) / (tbound.w - tbound.z);
        vec4 color = texture(u_img, vec2(a, b)) * 255.0;
        value = color.r / scale.x + color.g / scale.y + color.b / scale.z + color.a / scale.w;
    } else {
        discard;
    }

    // ---- 步骤 4: 颜色查找 ----
    float vin = (value - vrange.x) / (vrange.y - vrange.x);
    outColor = texture(u_color, vec2(vin, 0.5));

    // ---- 步骤 5: minOpacity 低值淡化（线性 clamp 路径） ----
    // 线性过渡：value 在 [vmin*0.8, vmin*1.3] 之间时 alpha 从 0 线性过渡到 1
    // o = (value - vmin*0.8) / (0.5 * vmin)
    //   当 value = vmin*0.8  → o = 0
    //   当 value = vmin*1.3  → o = 1
    if (tminOpacity) {
        float o = (value - vrange.x * 0.8) / 0.5 / vrange.x;
        o = max(o, 0.0);   // clamp 下界
        o = min(o, 1.0);   // clamp 上界
        outColor.a = outColor.a * o;
    }

    // ---- 步骤 6: 预乘 alpha ----
    outColor.rgb *= outColor.a;
}`

// ============================================================================
// Helper Functions (WebGL 工具函数)
// ============================================================================

/**
 * 编译单个 WebGL2 Shader
 * @param gl     WebGL2 渲染上下文
 * @param type   gl.VERTEX_SHADER 或 gl.FRAGMENT_SHADER
 * @param source GLSL 源码字符串
 * @returns 编译好的 WebGLShader
 * @throws  编译失败时抛出错误并附带着色器日志
 *
 * 此函数复刻 hxmap 中对应的 shader 编译逻辑（原压缩代码中的 b() 辅助函数）。
 */
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
    gl.deleteShader(shader) // 编译失败时清理，防止资源泄漏
    throw new Error(`Shader compile error: ${info}`)
  }
  return shader
}

/**
 * 创建并链接 WebGL2 Program
 * @param gl WebGL2 渲染上下文
 * @param vs 顶点着色器
 * @param fs 片元着色器
 * @returns 链接好的 WebGLProgram
 * @throws  链接失败时抛出错误并附带程序日志
 */
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

/**
 * 创建 WebGL2 纹理并上传图像数据
 *
 * 此函数复刻 hxmap 中的 L() 辅助函数：
 *   - 激活指定纹理单元 (TEXTURE0 + textureUnit)
 *   - 设置 UNPACK_FLIP_Y_WEBGL 翻转 Y 轴（flipY 参数）
 *   - 设置纹理过滤（useNearest → NEAREST 最近邻，否则 → LINEAR 线性）
 *   - 设置环绕模式为 CLAMP_TO_EDGE
 *   - 以 RGBA/UNSIGNED_BYTE 格式上传图像数据
 *
 * @param gl          WebGL2 渲染上下文
 * @param source      图像源（Image 或 Canvas）
 * @param textureUnit 纹理单元偏移：0=数据纹理, 1=颜色纹理, 2=遮罩纹理
 * @param useNearest  是否使用最近邻采样（true=NEAREST 无插值，false=LINEAR 双线性插值）
 * @param flipY       是否垂直翻转图像
 * @returns 创建的 WebGLTexture
 */
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
    // 最近邻采样：用于 grid 模式，数据纹理像素边界清晰，适合精确取值
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  } else {
    // 线性采样：默认模式，纹理放大/缩小时双线性插值，画面平滑
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  }
  // CLAMP_TO_EDGE：超出 [0,1] 的 UV 取边缘色，防止纹理边缘出现接缝
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  return texture
}

/**
 * 生成颜色渐变查找纹理（1D 颜色查找表，存储为 2D 纹理）
 *
 * 此函数复刻 hxmap 中的 Y() 函数。
 *
 * 原理：
 *   使用 Canvas 2D 的 createLinearGradient 在给定颜色台阶之间生成渐变，
 *   将结果画到宽度 25*n+5、高度 3 的 Canvas 上。
 *   在 Fragment Shader 中通过 decodedValue → normalizedVin → texture(vin, 0.5) 查找颜色。
 *
 * 参数说明：
 *   colors.v[]   — 数据值台阶（如 [0, 50, 100, ...]）
 *   colors.r/g/b/o[] — 每个台阶对应的 RGBA 颜色
 *   linear       — 渐变线性度（0=完全线性，每个台阶之间均匀过渡；
 *                  值越大，台阶之间的颜色过渡越陡峭/偏移）
 *
 * @param colors 颜色范围配置（台阶值数组 + 对应颜色）
 * @param linear 渐变线性度，默认 0
 * @returns { vmin, vmax, canvas }  值域范围和生成的 Canvas
 */
function generateColorRamp(
  colors: IColorRange,
  linear: number = 0
): { vmin: number; vmax: number; canvas: HTMLCanvasElement } {
  const len = colors.r.length
  const vmin = colors.v[0] // 数据值最小值
  const vmax = colors.v[len - 1] + 5 // 数据值最大值 + 5 像素余量
  const canvas = document.createElement('canvas')
  canvas.width = 25 * len + 5 // 每个颜色台阶 25px 宽 + 5px 余量
  canvas.height = 3 // 高度仅需 3px（1D 纹理）
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)

  // 为每个相邻颜色对创建渐变片段
  for (let i = 0; i < len - 1; i++) {
    // stop1: 当前台阶值的归一化位置
    const stop1 = (colors.v[i] - vmin) / (vmax - vmin)
    // stop2: 下一个台阶值的归一化位置减去 linear 偏移
    //        linear > 0 时 stop2 左移，使颜色过渡更平滑。
    //        对于某一个色段，实际：颜色i -------- 颜色i -linear- 颜色i+1
    const stop2 =
      (colors.v[i + 1] - (colors.v[i + 1] - colors.v[i]) * linear - vmin) / (vmax - vmin)
    const color = `rgba(${colors.r[i]},${colors.g[i]},${colors.b[i]},${colors.o[i]})`
    gradient.addColorStop(stop1, color)
    gradient.addColorStop(stop2, color) // start 和 end 都用同一颜色，形成"台阶"
  }

  // 最后一个颜色台阶
  const lastColor = `rgba(${colors.r[len - 1]},${colors.g[len - 1]},${colors.b[len - 1]},${
    colors.o[len - 1]
  })`
  const lastStop = (colors.v[len - 1] - vmin) / (vmax - vmin)
  gradient.addColorStop(lastStop, lastColor)
  gradient.addColorStop(1, lastColor) // 填充到末端

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  return { vmin, vmax, canvas }
}

/**
 * 经纬度 → Web Mercator 坐标转换
 *
 * 公式：
 *   x = lng/360 + 0.5                    经度线性映射到 [0,1]
 *   y = 0.5 - ln(tan(π/4 + lat/2)) / 2π  纬度通过 Mercator 投影映射到 [0,1]
 *
 * Mercator [0,1] 空间：
 *   (0, 0) = 地图左上角（180°W, ~85.05°N）
 *   (1, 1) = 地图右下角（180°E, ~85.05°S）
 *
 * 用途：计算数据范围四角的归一化坐标，填入地面矩形 VBO；随后由 MapLibre 的矩阵投影。
 *       之所以不用 maplibregl.MercatorCoordinate.fromLngLat()，是为了避免对 maplibre
 *       库内部 API 的依赖，保持纯数学实现。
 */
function lngLatToMercator(lng: number, lat: number): { x: number; y: number } {
  const x = lng / 360 + 0.5
  const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat / 2) * (Math.PI / 180))) / (2 * Math.PI)
  return { x, y }
}

// ============================================================================
// Main Class — ColorfulMapImage
// ============================================================================

/**
 * ColorfulMapImage — MapLibre 自定义图层插件
 *
 * 实现 maplibregl.CustomLayerInterface 接口，把数据经纬度范围转换为 Web Mercator 地面矩形，
 * 再通过 MapLibre 提供的投影矩阵渲染。矩阵包含平移、缩放、旋转和透视信息，因此图层在
 * pitch/bearing 变化时会和底图保持一致；片元着色器继续负责数据解码和颜色映射。
 *
 * 使用方式：
 *   const layer = new ColorfulMapImage({ img, scale, colors, latmin, latmax, lonmin, lonmax, ... })
 *   layer.addTo(map)           // 添加到地图，等价于 map.addLayer(layer, beforeId)
 *   layer.changeImage(url)     // 更新数据图片
 *   layer.changeAll({ ... })   // 批量更新配置
 *   layer.getGridDataByLatLon(lat, lon)  // 查询指定位置的解码数值
 *   layer.destroy()            // 移除图层并清理资源
 *
 * 渲染模式：renderingMode = '2d'
 *   以 2D 叠加层方式渲染到 MapLibre 主画布，不使用深度缓冲。
 *
 * 图层顺序：beforeId 参数
 *   MapLibre 中图层顺序由添加顺序决定，beforeId 指定插入到哪个图层之前。
 *   替代原 hxmap GlImg 中通过 CSS z-index 控制层叠的 index 参数。
 */
export class ColorfulMapImage implements maplibregl.CustomLayerInterface {
  // ---- maplibregl.CustomLayerInterface 接口要求 ----
  id: string
  type: 'custom' = 'custom'
  renderingMode: '2d' = '2d'

  // ---- MapLibre & WebGL 上下文 ----
  /** MapLibre 地图实例引用（onAdd 时注入） */
  private map: maplibregl.Map | null = null
  /** WebGL2 渲染上下文（onAdd 时注入，每次 render 使用同一 context） */
  private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null

  // ---- WebGL 资源 ----
  /** 链接好的 Shader Program */
  private program: WebGLProgram | null = null
  /** Vertex Array Object：封装地理范围矩形的顶点属性绑定 */
  private vao: WebGLVertexArrayObject | null = null
  /** Vertex Buffer Object：存储数据边界四角的 Web Mercator 坐标 */
  private vbuffer: WebGLBuffer | null = null
  /** 数据纹理（TEXTURE0）：编码了数据值的 PNG 图片 */
  private dataTexture: WebGLTexture | null = null
  /** 颜色渐变纹理（TEXTURE1）：Canvas 2D 生成的 1D 颜色查找表 */
  private colorTexture: WebGLTexture | null = null
  /** 裁剪遮罩纹理（TEXTURE2，可选）：控制哪些区域不渲染 */
  private cutTexture: WebGLTexture | null = null

  // ---- Uniform 位置缓存 ----
  // 在 onAdd 时通过 getUniformLocation 获取并缓存，避免每帧查询
  private u_matrix: WebGLUniformLocation | null = null // MapLibre Mercator → clip-space 投影矩阵
  private u_worldOffset: WebGLUniformLocation | null = null // 横向世界副本偏移
  private u_tbound: WebGLUniformLocation | null = null // 数据地理边界
  private u_scale: WebGLUniformLocation | null = null // 数据解码比例
  private u_tminOpacity: WebGLUniformLocation | null = null // 低值淡化开关
  private u_vrange: WebGLUniformLocation | null = null // 颜色值域
  private u_img: WebGLUniformLocation | null = null // 数据纹理采样器
  private u_color: WebGLUniformLocation | null = null // 颜色纹理采样器
  private u_cut: WebGLUniformLocation | null = null // 遮罩纹理采样器（有遮罩时）
  private u_cutArea: WebGLUniformLocation | null = null // 遮罩地理范围（有遮罩时）

  // ---- 用户配置 ----
  /** 合并默认值后的完整配置 */
  private opts: IColorfulMapImageOptions

  // ---- 状态标志 ----
  /** 图片加载完毕、纹理创建完成 */
  private ready = false
  /** 数据纹理中是否有有效数据（图片加载失败时为 false） */
  private hasData = false
  /** 是否启用了像素值查询（setGetGrid(true) 后为 true） */
  private eventable = false
  /** 是否已调用 destroy() */
  private isDestroyed = false

  // ---- 颜色映射缓存 ----
  /** 颜色查找表的最小值 */
  private vmin = 0
  /** 颜色查找表的最大值（实际 max value + 5） */
  private vmax = 0

  // ---- 像素查询用 ----
  /**
   * 原始图像数据的 Canvas 副本
   * 用于 getGridDataByLatLon() 通过 getImageData 解码像素值，
   * 避免依赖 WebGL readPixels（需要 framebuffer，且 MapLibre 管线中难以注入）。
   */
  private rawImageCanvas: HTMLCanvasElement | null = null
  /**
   * 上传投影矩阵用的 Float32 缓冲。
   * MapLibre 的矩阵可能以 Float64Array 提供，而 WebGL uniformMatrix4fv 要求 Float32Array；
   * 每帧复用该对象可避免不断分配临时数组。
   */
  private projectionMatrix = new Float32Array(16)

  /**
   * 构造函数
   *
   * @param options 图层配置选项，与 hxmap GlImg 构造函数参数完全对应
   *
   * 必填项：
   *   img       — 数据纹理（URL 字符串 / Image / Canvas）
   *   lonmin/max, latmin/max — 地理范围
   *   scale     — 数据解码比例 { r, g, b, a }
   *   colors    — 颜色映射配置 { r[], g[], b[], v[], o[] }
   *
   * 可选项：
   *   beforeId  — 图层插入位置（替代 hxmap 的 index）
   *   interval  — 经纬度间隔（用于像素查询的坐标 → 像素索引转换）
   *   grid      — 最近邻采样（数据纹理无插值）
   *   linear    — 颜色渐变线性度
   *   flipy     — 垂直翻转纹理
   *   minOpacity — 低值像素透明淡化
   *   cut/cutUrl/cutlatmin/cutlatmax/cutlonmin/cutlonmax — 遮罩裁剪
   *   useCros   — 图片加载时设置 crossOrigin = 'anonymous'
   */
  constructor(options: IColorfulMapImageOptions) {
    // 生成唯一图层 ID：优先使用 beforeId，否则自动生成
    this.id =
      options.beforeId ||
      `colorful-map-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // 合并默认值（与 hxmap GlImg 默认参数一致）
    this.opts = {
      linear: 0, // 默认完全线性渐变
      flipy: 0, // 默认不翻转 Y 轴
      grid: false, // 默认线性插值（平滑）
      minOpacity: false, // 默认不淡化低值
      useCorrect: false, // 兼容参数，暂未实现
      cut: false, // 默认不启用遮罩
      useCros: false, // 默认不设置跨域
      preserveDrawingBuffer: false, // 兼容参数
      ...options, // 用户配置覆盖默认值
    }
  }

  /**
   * MapLibre 图层生命周期：添加到地图时调用
   *
   * 完成所有 WebGL 资源初始化：
   *   1. 编译 Shader、链接 Program
   *   2. 获取所有 Uniform 位置并缓存
   *   3. 根据数据经纬度范围创建 Web Mercator 地面矩形 VAO
   *   4. 加载数据纹理图片
   *   5. 生成颜色渐变查找纹理
   *   6. 加载裁剪遮罩（如果启用）
   *
   * @param map MapLibre 地图实例
   * @param gl  WebGL2 渲染上下文（MapLibre 内部创建）
   */
  onAdd(map: maplibregl.Map, gl: WebGL2RenderingContext | WebGLRenderingContext): void {
    this.map = map
    this.gl = gl

    // 判断是否启用遮罩裁剪（需要 cut=true 且提供了 cutUrl）
    const useCut = this.opts.cut && this.opts.cutUrl

    // ---- 编译 Shader & 链接 Program ----
    // 根据 useCut 选择对应的 Fragment Shader 变体
    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      useCut ? FRAGMENT_SHADER_WITH_CUT : FRAGMENT_SHADER_NO_CUT
    )
    this.program = createProgram(gl, vs, fs)
    // Program 链接后 Shader 对象不再需要，立即删除释放显存
    gl.deleteShader(vs)
    gl.deleteShader(fs)

    // ---- 缓存所有 Uniform 位置 ----
    // 提前获取并缓存，避免每帧重复调用 getUniformLocation（减少 CPU 开销）
    this.u_matrix = gl.getUniformLocation(this.program, 'u_matrix')
    this.u_worldOffset = gl.getUniformLocation(this.program, 'u_worldOffset')
    this.u_tbound = gl.getUniformLocation(this.program, 'tbound')
    this.u_scale = gl.getUniformLocation(this.program, 'scale')
    this.u_tminOpacity = gl.getUniformLocation(this.program, 'tminOpacity')
    this.u_vrange = gl.getUniformLocation(this.program, 'vrange')
    this.u_img = gl.getUniformLocation(this.program, 'u_img')
    this.u_color = gl.getUniformLocation(this.program, 'u_color')
    if (useCut) {
      this.u_cut = gl.getUniformLocation(this.program, 'cutImg')
      this.u_cutArea = gl.getUniformLocation(this.program, 'cutArea')
    }

    // ---- 创建数据地理范围矩形 VAO ----
    // VBO 创建后由 updateGeometry() 根据 lat/lon 边界填入归一化 Mercator 坐标。
    // 4 个顶点仍按 Triangle Strip 排列：西北 → 西南 → 东北 → 东南。
    this.vbuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbuffer)
    this.updateGeometry()

    // VAO 封装了顶点属性绑定：position 属性 → a_position location
    this.vao = (gl as WebGL2RenderingContext).createVertexArray()
    ;(gl as WebGL2RenderingContext).bindVertexArray(this.vao)
    // updateGeometry() 在 VAO 创建前绑定了 VBO；这里显式重绑，避免依赖外部 GL 状态。
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbuffer)
    const posLoc = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    // stride=0, offset=0：顶点数据紧密排列 (x,y) (x,y) ...
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    ;(gl as WebGL2RenderingContext).bindVertexArray(null) // 解绑 VAO，防止后续意外修改

    // ---- 加载资源 ----
    // 数据纹理加载是异步的（图片需要网络请求），加载完成后设置 this.ready = true
    this.loadImage(this.opts.img)
    // 颜色渐变纹理是同步的（Canvas 2D 立即生成）
    this.updateColorRamp()

    if (useCut) {
      this.loadCutImage(this.opts.cutUrl!)
    }
  }

  /**
   * MapLibre 图层生命周期：从地图移除时调用
   *
   * 清理所有 WebGL 资源（Program / VAO / VBO / 纹理），防止显存泄漏。
   * 将所有引用置 null 确保 GC 可以回收。
   *
   * @param _map 未使用
   * @param gl   WebGL2 渲染上下文
   */
  onRemove(_map: maplibregl.Map, gl: WebGL2RenderingContext | WebGLRenderingContext): void {
    if (this.program) gl.deleteProgram(this.program)
    if (this.vao) (gl as WebGL2RenderingContext).deleteVertexArray(this.vao)
    if (this.vbuffer) gl.deleteBuffer(this.vbuffer)
    if (this.dataTexture) gl.deleteTexture(this.dataTexture)
    if (this.colorTexture) gl.deleteTexture(this.colorTexture)
    if (this.cutTexture) gl.deleteTexture(this.cutTexture)

    // 清空所有引用
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

  /**
   * MapLibre 每帧渲染回调
   *
   * 在 MapLibre 渲染管线中，自定义图层的 render() 在每个动画帧被调用。
   * 此方法完成：
   *   1. 上传 MapLibre 当前帧的 Web Mercator 投影矩阵
   *   2. 传入地理边界、解码比例、颜色值域等 uniform
   *   3. 绑定 3 张纹理（数据 / 颜色 / 遮罩）
   *   4. 按 renderWorldCopies 设置绘制当前世界及相邻世界的数据矩形
   *
   * MapLibre 默认 blend 模式为 (ONE, ONE_MINUS_SRC_ALPHA)，期望预乘 alpha。
   * Fragment Shader 中已做预乘（outColor.rgb *= outColor.a），无需覆盖 blend。
   *
   * @param gl      WebGL2 渲染上下文
   * @param options MapLibre 当前帧的相机及投影数据
   */
  render(
    gl: WebGL2RenderingContext | WebGLRenderingContext,
    options: maplibregl.CustomRenderMethodInput
  ): void {
    // 未就绪（图片未加载完毕）或已销毁时跳过渲染
    if (!this.program || !this.ready) return

    const map = this.map!
    // ---- 绑定 Program & VAO ----
    gl.useProgram(this.program)
    ;(gl as WebGL2RenderingContext).bindVertexArray(this.vao)

    // ---- 设置 Uniform ----

    // defaultProjectionData.mainMatrix 接受 [0,1] Web Mercator 世界坐标，输出 clip-space。
    // 它已经包含当前 pitch、bearing、zoom、center 和透视参数，是倾斜渲染正确的关键。
    // 复制到复用的 Float32Array 后再上传，兼容 MapLibre 内部提供的 64 位矩阵。
    this.projectionMatrix.set(options.defaultProjectionData.mainMatrix)
    gl.uniformMatrix4fv(this.u_matrix, false, this.projectionMatrix)

    // u_tbound: 数据地理边界 (latmin, latmax, lonmin, lonmax)
    //   Shader 中用于判断像素是否在数据范围内，以及计算纹理 UV
    gl.uniform4f(
      this.u_tbound,
      this.opts.latmin,
      this.opts.latmax,
      this.opts.lonmin,
      this.opts.lonmax
    )

    // u_scale: 数据解码比例 (r, g, b, a)
    //   Shader 中 value = R/r + G/g + B/b + A/a
    //   通常设为 (1,1,1,1) 直接求和，或根据编码方式调节各通道权重
    gl.uniform4f(
      this.u_scale,
      this.opts.scale.r,
      this.opts.scale.g,
      this.opts.scale.b,
      this.opts.scale.a
    )

    // GLSL bool uniform 应通过 uniform1i 传递 0/1。
    gl.uniform1i(this.u_tminOpacity, this.opts.minOpacity ? 1 : 0)

    // u_vrange: 颜色映射的值域 [vmin, vmax]
    //   由 generateColorRamp() 计算，vmax = 最后台阶值 + 5
    gl.uniform2f(this.u_vrange, this.vmin, this.vmax)

    // ---- 绑定纹理 ----

    // TEXTURE0: 数据纹理（编码了数据值的 PNG）
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture)
    gl.uniform1i(this.u_img, 0) // sampler2D u_img → 纹理单元 0

    // TEXTURE1: 颜色渐变查找纹理（Canvas 生成的渐变）
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.colorTexture)
    gl.uniform1i(this.u_color, 1) // sampler2D u_color → 纹理单元 1

    // TEXTURE2: 裁剪遮罩纹理（可选）
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

    // ---- 绘制当前世界及横向副本 ----
    // 经度每增加 360°，Mercator X 增加 1。先根据中心经度找出相机所在的世界编号，
    // 开启 renderWorldCopies 时再绘制左右相邻世界，确保跨越 ±180° 平移时图层连续。
    // 片元 varying 始终使用未偏移的 a_position，所以所有副本采样相同的数据纹理。
    const centerWorld = Math.floor((map.getCenter().lng + 180) / 360)
    const worldOffsets = map.getRenderWorldCopies()
      ? [centerWorld - 1, centerWorld, centerWorld + 1]
      : [0]
    for (const worldOffset of worldOffsets) {
      gl.uniform1f(this.u_worldOffset, worldOffset)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
  }

  // ========================================================================
  // Public API — 图层操作
  // ========================================================================

  /**
   * 将图层添加到地图
   *
   * 等价于 map.addLayer(this, beforeId)，支持链式调用。
   *
   * @param map      MapLibre 地图实例
   * @param beforeId 插入到哪个图层之前（可选，未指定时使用构造参数中的 beforeId）
   * @returns this，支持链式调用
   */
  addTo(map: maplibregl.Map, beforeId?: string): this {
    map.addLayer(this, beforeId || this.opts.beforeId)
    return this
  }

  /**
   * 更新数据纹理图片
   *
   * 支持三种输入类型：
   *   - string:       图片 URL，异步加载后上传到 GPU
   *   - HTMLImageElement: 已加载的 Image 对象
   *   - HTMLCanvasElement: Canvas 对象（可用于动态生成数据纹理）
   *
   * @param img 新的图片源
   */
  changeImage(img: string | HTMLImageElement | HTMLCanvasElement): void {
    this.opts.img = img
    this.loadImage(img) // 触发重新加载 → handleImageLoaded → 更新 dataTexture
  }

  /**
   * 批量更新图层配置
   *
   * 可以同时更新 scale、colors、img（url）、minOpacity。
   * 如果只传 img 不传其他，等价于 changeImage()。
   *
   * 注意：此方法不更新地理边界（latmin/latmax/lonmin/lonmax），
   *       需要更新边界时请使用 changeImageArea()。
   *
   * @param options 部分配置更新（只传需要改的字段）
   */
  changeAll(options: Partial<IColorfulMapImageOptions>): void {
    const gl = this.gl
    if (!gl || !this.program) return

    gl.useProgram(this.program)

    // minOpacity: 先更新 JS 状态，GPU 端在每帧 render() 中读取，无需额外操作
    if ('minOpacity' in options) {
      this.opts.minOpacity = options.minOpacity
    }

    // scale: 更新 JS 状态 + 立即设置 GPU uniform（无需等下帧）
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

    // colors: 重新生成颜色渐变纹理并上传 GPU
    if (options.colors) {
      this.opts.colors = options.colors
      this.updateColorRamp()
    }

    // img (url): 等价于 changeImage，异步加载新图片
    if (options.img !== undefined) {
      this.changeImage(options.img)
    } else {
      this.requestRepaint() // 没有图片更新时仍需触发重绘（颜色可能变了）
    }
  }

  /**
   * 更新数据图片、地理范围及附属选项
   *
   * 这是最完整的更新方法，一次性完成：
   *   - 地理边界更新（latmin/max, lonmin/max）
   *   - 图片 URL 更新
   *   - 可选：flipy、interval、grid、colors
   *
   * 如果图层尚未就绪（图片未加载），通过 requestAnimationFrame 延迟重试。
   *
   * @param url     新的数据图片 URL
   * @param latmin  数据南边界
   * @param latmax  数据北边界
   * @param lonmin  数据西边界
   * @param lonmax  数据东边界
   * @param extra   可选的额外更新（flipy, interval, grid, colors）
   */
  changeImageArea(
    url: string,
    latmin: number,
    latmax: number,
    lonmin: number,
    lonmax: number,
    extra?: Partial<IColorfulMapImageOptions>
  ): void {
    // 图片尚未加载完成时，等待下一帧重试
    if (!this.ready) {
      requestAnimationFrame(() => this.changeImageArea(url, latmin, latmax, lonmin, lonmax, extra))
      return
    }

    // 更新地理边界
    this.opts.latmin = latmin
    this.opts.latmax = latmax
    this.opts.lonmin = lonmin
    this.opts.lonmax = lonmax
    // 边界同时决定 VBO 中地面矩形的位置；只更新 tbound 会导致纹理与几何范围不一致。
    this.updateGeometry()

    // 更新附加选项
    if (extra?.flipy !== undefined) this.opts.flipy = extra.flipy
    if (extra?.interval !== undefined) this.opts.interval = extra.interval

    const gl = this.gl!
    gl.useProgram(this.program!)

    // grid 切换：更改数据纹理的采样方式
    if (extra?.grid !== undefined) {
      this.opts.grid = extra.grid
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.dataTexture)
      if (extra.grid) {
        // 最近邻采样：不插值，适合网格数据的精确取值
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      } else {
        // 线性采样：双线性插值，画面更平滑
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

  /**
   * 更新颜色映射配置
   *
   * @param colors 新的颜色范围配置 { r[], g[], b[], v[], o[] }
   */
  changeColors(colors: IColorRange): void {
    this.opts.colors = colors
    this.updateColorRamp()
  }

  /**
   * 更新颜色渐变线性度
   *
   * linear = 0：完全线性渐变
   * linear > 0：颜色台阶之间的过渡更陡峭（向低值偏移）
   *
   * @param n 新的线性度值
   */
  changeLinear(n: number): void {
    this.opts.linear = n
    this.updateColorRamp()
  }

  /**
   * 切换数据纹理的采样方式
   *
   * grid = false（默认）：LINEAR 双线性插值 → 渲染平滑
   * grid = true：NEAREST 最近邻采样 → 每个数据格点边缘清晰
   *
   * 直接通过 gl.texParameteri 修改当前绑定纹理的采样参数，无需重建纹理。
   *
   * @param enabled true=最近邻, false=双线性
   */
  changeGrid(enabled: boolean): void {
    if (this.opts.grid === enabled) return
    this.opts.grid = enabled

    const gl = this.gl
    if (!gl) return

    // 绑定数据纹理，直接修改其采样参数
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

  /**
   * 启用/禁用像素值查询
   *
   * 启用后，可通过 getGridDataByLatLon() 查询指定经纬度的解码数值。
   * 如果图层尚未就绪，通过 requestAnimationFrame 延迟重试。
   *
   * 实现方式：通过 Canvas 2D getImageData 读取原始图片像素，
   * 再用 scale 解码为数据值。不依赖 WebGL framebuffer。
   *
   * @param enabled true=启用查询, false=禁用
   */
  setGetGrid(enabled: boolean): void {
    if (!this.ready) {
      requestAnimationFrame(() => this.setGetGrid(enabled))
      return
    }
    this.eventable = enabled
  }

  /**
   * 查询指定经纬度的解码数据值
   *
   * 前提条件：
   *   1. setGetGrid(true) 已调用（eventable = true）
   *   2. 图片已成功加载（rawImageCanvas 存在）
   *   3. 构造参数中提供了 interval（经纬度间隔）
   *
   * 坐标 → 像素索引公式：
   *   x = Math.round((lon - lonmin) / interval)
   *   y = Math.round((lat - latmin) / interval)
   *
   * 解码公式（与 Shader 一致）：
   *   value = pixel.R/scale.r + pixel.G/scale.g + pixel.B/scale.b + pixel.A/scale.a
   *
   * @param lat 纬度
   * @param lon 经度
   * @returns { data, lat, lon } 或 null（条件不满足时）
   */
  getGridDataByLatLon(lat: number, lon: number): IGridDataResult | null {
    if (!this.eventable || !this.rawImageCanvas) return null

    const { interval, latmin, latmax, lonmin, lonmax, scale } = this.opts
    if (!interval) {
      console.warn('启用获取数值，需要传入经纬度间隔')
      return null
    }

    // 超出数据地理范围 → 返回 data=null
    if (lat < latmin || lat > latmax || lon < lonmin || lon > lonmax) {
      return { data: null, lat, lon }
    }

    // 经纬度 → 数据纹理像素索引（与 hxmap J() 函数逻辑一致）
    const x = Math.round((lon - lonmin) / interval)
    const y = Math.round((lat - latmin) / interval)

    const ctx = this.rawImageCanvas.getContext('2d')
    if (!ctx) return { data: null, lat, lon }

    try {
      // 读取单个像素的 RGBA 值
      const pixel = ctx.getImageData(x, y, 1, 1).data
      // 解码数据值（与 Shader 中解码公式完全一致）
      return {
        data: pixel[0] / scale.r + pixel[1] / scale.g + pixel[2] / scale.b + pixel[3] / scale.a,
        lat,
        lon,
      }
    } catch {
      // getImageData 越界等情况
      return { data: null, lat, lon }
    }
  }

  /**
   * 销毁图层
   *
   * 调用 map.removeLayer(id) 从地图中移除本图层。
   * MapLibre 会触发 onRemove 回调清理 WebGL 资源。
   * 幂等操作：重复调用无副作用。
   */
  destroy(): void {
    if (this.isDestroyed) return
    this.isDestroyed = true
    if (this.map) {
      this.map.removeLayer(this.id)
    }
  }

  // ========================================================================
  // Private Methods — 内部实现
  // ========================================================================

  /**
   * 根据当前经纬度边界创建地面矩形顶点
   *
   * 经纬度不能直接参与 MapLibre 的矩阵运算，需要先转换为归一化 Web Mercator：
   *   x = lon / 360 + 0.5
   *   y = 0.5 - ln(tan(π/4 + lat/2)) / (2π)
   *
   * 顶点按 Triangle Strip 排列：
   *   西北(northWest) ───── 东北
   *          │            / │
   *          │  两个三角形  │
   *          │ /            │
   *   西南 ──────────── 东南(southEast)
   *
   * changeImageArea() 更新边界时会再次调用本方法，因此图像范围可以动态变化。
   * VBO 使用 STATIC_DRAW 是因为边界相对每帧相机变化频率很低；相机变化只更新矩阵。
   */
  private updateGeometry(): void {
    if (!this.gl || !this.vbuffer) return

    const northWest = lngLatToMercator(this.opts.lonmin, this.opts.latmax)
    const southEast = lngLatToMercator(this.opts.lonmax, this.opts.latmin)
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

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vbuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW)
    this.requestRepaint()
  }

  /**
   * 加载数据纹理图片
   *
   * 处理三种输入类型：
   *   - string: 创建 Image 异步加载
   *   - HTMLCanvasElement: 直接使用
   *   - HTMLImageElement: 可能已加载完成，也可能需要等待 onload
   *
   * 加载成功后调用 handleImageLoaded()：
   *   1. 创建 Canvas 副本（用于 getGridDataByLatLon 查询）
   *   2. 创建/更新 WebGL 纹理
   *   3. 设置 ready = true
   *
   * 加载失败时创建 1×1 占位 Canvas，避免渲染报错。
   *
   * @param img 图片源
   */
  private loadImage(img: string | HTMLImageElement | HTMLCanvasElement): void {
    const gl = this.gl!
    if (typeof img === 'string') {
      // 字符串 URL → 创建 Image 异步加载
      const image = new Image()
      if (this.opts.useCros) image.crossOrigin = 'anonymous' // 跨域图片需要设置
      image.onload = () => {
        if (this.isDestroyed) return // 加载完成时图层可能已被销毁
        this.handleImageLoaded(gl, image)
      }
      image.onerror = () => {
        if (this.isDestroyed) return
        console.warn(`图片加载失败: ${img}`)
        // 创建 1×1 占位 Canvas 防止后续渲染报错
        const c = document.createElement('canvas')
        c.width = 1
        c.height = 1
        this.rawImageCanvas = c
        this.ready = true
        this.hasData = false // 标记无有效数据
        this.requestRepaint()
      }
      image.src = img
    } else if (img instanceof HTMLCanvasElement) {
      // Canvas → 直接使用
      this.handleImageLoaded(gl, img)
    } else {
      // HTMLImageElement → 可能已加载，也可能未加载
      if (img.complete && img.naturalWidth > 0) {
        // 已加载完成（缓存命中或 <img> 标签已显示）
        this.handleImageLoaded(gl, img)
      } else {
        // 等待加载完成
        img.onload = () => {
          if (this.isDestroyed) return
          this.handleImageLoaded(gl, img as HTMLImageElement)
        }
      }
    }
  }

  /**
   * 图片加载成功后的处理
   *
   * 1. 创建 Canvas 副本 → rawImageCanvas
   *    用于 getGridDataByLatLon() 通过 getImageData 读取像素值。
   *    注意：如果图片是跨域加载且未设置 CORS，drawImage → getImageData 会报安全错误。
   *    可通过设置构造参数 useCros=true 让 Image 以 crossOrigin="anonymous" 加载。
   *
   * 2. 创建/更新 WebGL 数据纹理（TEXTURE0）
   *    首次加载时创建新纹理，后续更新时通过 texImage2D 替换纹理内容。
   *    flipy: 控制 UNPACK_FLIP_Y_WEBGL（垂直翻转图像数据）
   *    grid:  控制 NEAREST/LINEAR 采样方式
   *
   * 3. 标记 ready=true 并触发重绘
   *
   * @param gl  WebGL2 上下文
   * @param img 已加载的 Image 或 Canvas
   */
  private handleImageLoaded(
    gl: WebGL2RenderingContext | WebGLRenderingContext,
    img: HTMLImageElement | HTMLCanvasElement
  ): void {
    // ---- 创建 Canvas 副本用于像素查询 ----
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    this.rawImageCanvas = canvas

    // ---- 创建/更新 WebGL 纹理 ----
    if (!this.dataTexture) {
      // 首次创建纹理
      this.dataTexture = createTexture(
        gl,
        img,
        0, // TEXTURE0
        this.opts.grid!, // 是否最近邻采样
        this.opts.flipy === 1 // 是否翻转 Y 轴
      )
    } else {
      // 更新已有纹理内容（保留原纹理对象，只替换数据）
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.dataTexture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.opts.flipy === 1 ? 1 : 0)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    }

    this.ready = true // 标记就绪，render() 开始绘制
    this.hasData = true // 标记有有效数据
    this.requestRepaint()
  }

  /**
   * 加载裁剪遮罩图片
   *
   * 遮罩是一个灰度图，在 Shader 中采样其 R 通道：
   *   若 R > 0.5 → 该像素被遮罩覆盖 → discard 不渲染
   *   若 R ≤ 0.5 → 正常渲染
   *
   * 遮罩纹理位于 TEXTURE2，设置 flipY=true（遮罩图片需要 Y 轴翻转以匹配屏幕坐标）。
   *
   * @param url 遮罩图片 URL
   */
  private loadCutImage(url: string): void {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (this.isDestroyed || !this.gl || !this.program) return
      const gl = this.gl
      gl.useProgram(this.program)
      this.cutTexture = createTexture(gl, image, 2, false, true)
      // 设置 cutImg 采样器指向纹理单元 2
      if (this.u_cut) gl.uniform1i(this.u_cut, 2)
      // 设置遮罩地理范围
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

  /**
   * 更新颜色渐变纹理
   *
   * 调用 generateColorRamp() 生成新的 Canvas 渐变 → 上传到 TEXTURE1。
   * 同时更新 vmin/vmax 缓存，供 render() 中设置 u_vrange uniform。
   *
   * 首次调用时创建新纹理，后续调用时通过 texImage2D 替换内容。
   */
  private updateColorRamp(): void {
    if (!this.gl || !this.program) return
    const gl = this.gl

    // 生成新的颜色渐变 Canvas
    const { vmin, vmax, canvas } = generateColorRamp(this.opts.colors, this.opts.linear)
    this.vmin = vmin
    this.vmax = vmax

    if (!this.colorTexture) {
      // 首次创建颜色纹理
      this.colorTexture = createTexture(gl, canvas, 1, false, false)
    } else {
      // 更新已有纹理内容
      gl.useProgram(this.program)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, this.colorTexture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
      gl.uniform2f(this.u_vrange, vmin, vmax)
    }
    this.requestRepaint()
  }

  /**
   * 请求 MapLibre 重绘
   *
   * 在以下场景调用：
   *   - 图片加载完成 → 需要显示新纹理
   *   - 颜色/scale 等配置变化 → 需要更新渲染效果
   *   - 纹理内容更新 → 下一帧应用新数据
   *
   * triggerRepaint() 请求 MapLibre 在下一个动画帧调用 render()。
   */
  private requestRepaint(): void {
    if (this.map) {
      this.map.triggerRepaint()
    }
  }
}
