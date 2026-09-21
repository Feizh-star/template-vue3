# ColorfulMapImage 实现原理与 API 注解

## 1. 组件定位

`ColorfulMapImage` 是一个 MapLibre 自定义图层（`CustomLayerInterface`）。它不是把 PNG 当作普通图片覆盖到地图上，而是把 PNG 的每个像素视为一份由 RGBA 四通道编码的数值数据，在 GPU 中完成以下工作：

1. 将数据覆盖的经纬度范围转换为 Web Mercator 地面矩形；
2. 使用 MapLibre 当前帧的相机矩阵，把矩形投影到地图画布；
3. 根据每个片元对应的经纬度采样数据 PNG；
4. 从 PNG 的 RGBA 通道解码原始数值；
5. 使用颜色查找纹理把数值转换成最终颜色；
6. 可选地使用遮罩图片裁剪显示区域；
7. 把结果以支持缩放、旋转、俯仰和世界副本的图层形式混合到底图上。

核心源码：

- `ColorfulMapImage.ts`：图层、Shader、纹理及公开方法的实现；
- `types.ts`：构造参数、颜色、比例和查询结果类型；
- `index.ts`：统一导出入口；
- `ColorfulMapImage_anno.ts`：与核心实现对应的行内注释版本；
- `useStainImg.ts`：项目中的实际调用示例。

> 当前 Shader 使用 `#version 300 es`，并使用 VAO，因此实际运行环境需要 WebGL2。源码类型虽然同时写了 `WebGLRenderingContext`，但 WebGL1 不能直接运行这套 Shader 和 VAO 代码。

---

## 2. 从数据到展示图层：整体原理

### 2.1 输入数据

图层接收三组核心输入：

#### 数据图片 `img`

```ts
img: string | HTMLImageElement | HTMLCanvasElement
```

图片不是最终显示颜色，而是数据载体。GPU 采样一个像素后，将归一化的 RGBA 恢复成 `0~255` 字节值，再按 `scale` 解码：

```glsl
vec4 color = texture(u_img, vec2(a, b)) * 255.0;
value = color.r / scale.x
      + color.g / scale.y
      + color.b / scale.z
      + color.a / scale.w;
```

因此数据生产端和图层必须约定同一套 RGBA 编码规则。例如 `scale={r:1,g:1,b:1,a:1}` 时，数值就是四通道字节之和。

#### 数据地理范围

```ts
latmin: number
latmax: number
lonmin: number
lonmax: number
```

这四个值同时承担两个职责：

- 决定地面矩形放在地图的什么位置；
- 决定经纬度到数据纹理 UV 的映射。

#### 颜色配置 `colors`

```ts
interface IColorRange {
  r: number[]
  g: number[]
  b: number[]
  v: number[]
  o: number[]
}
```

`v[i]` 是数值节点，`r[i] / g[i] / b[i] / o[i]` 是该节点对应的颜色和透明度。代码先在 Canvas 上生成一张横向颜色渐变图，再将它上传到 GPU，作为颜色查找纹理。

### 2.2 CPU 和 GPU 的职责划分

```text
数据 PNG ──────────────> dataTexture (TEXTURE0) ──┐
                                                  │
colors + linear -> Canvas 渐变 -> colorTexture ──┼─> Fragment Shader
                                      (TEXTURE1)  │   解码数值、查色、输出颜色
                                                  │
可选遮罩 PNG ──────────> cutTexture (TEXTURE2) ───┘

经纬度边界 -> Web Mercator 四角 -> VBO/VAO
                                     │
MapLibre 当前相机矩阵 ----------------┴─> Vertex Shader -> 屏幕上的地面矩形
```

CPU 主要负责资源准备：加载图片、生成颜色表、构造地面矩形、更新参数。GPU 主要负责逐像素采样、数据解码、颜色映射和遮罩判断。

### 2.3 三张纹理

| 纹理单元   | Shader 变量 | 来源                      | 用途                         |
| ---------- | ----------- | ------------------------- | ---------------------------- |
| `TEXTURE0` | `u_img`     | 数据 PNG / Image / Canvas | 保存 RGBA 编码后的数值       |
| `TEXTURE1` | `u_color`   | Canvas 生成的颜色渐变     | 将归一化数值映射为 RGBA 颜色 |
| `TEXTURE2` | `cutImg`    | 可选遮罩 PNG              | R 通道大于 `0.5` 时丢弃片元  |

### 2.4 最终展示图层

图层实现 MapLibre 的 `CustomLayerInterface`：

```ts
export class ColorfulMapImage implements maplibregl.CustomLayerInterface {
  id: string
  type: 'custom' = 'custom'
  renderingMode: '2d' = '2d'
}
```

通过 `map.addLayer()` 加入 MapLibre 的同一 WebGL 渲染管线。`renderingMode='2d'` 表示它作为二维地图覆盖层绘制，不参与三维深度共享；但它的顶点仍由包含 pitch、bearing 和透视信息的 MapLibre 相机矩阵投影，所以能贴合倾斜后的地面。

---

## 3. 此次升级为什么支持地图俯仰

### 3.1 旧方案的问题

升级前，顶点着色器直接绘制覆盖整个裁剪空间的矩形：

```glsl
in vec4 a_position;
void main() {
    gl_Position = a_position;
}
```

片元着色器再根据 `gl_FragCoord`、地图中心、zoom、画布大小和 DPR 反推经纬度。该计算本质上假设“屏幕像素与地图平面是轴对齐的线性关系”，只覆盖平移和缩放，没有使用 MapLibre 的相机投影矩阵，因此：

- 地图 `pitch` 后，屏幕不同位置对应的地面尺度发生透视变化，旧公式无法表达；
- 地图 `bearing` 后，地图坐标轴相对屏幕发生旋转，旧公式仍按水平/垂直方向计算；
- 图像看起来像固定在屏幕上，而不是贴在地图地面上。

### 3.2 新方案的关键变化

新版不再画全屏矩形，也不再从 `gl_FragCoord` 反推地图位置，而是：

1. 把数据经纬度范围转换成真实的 Web Mercator 地面矩形；
2. 每帧取得 `options.defaultProjectionData.mainMatrix`；
3. 顶点着色器使用该矩阵将地面矩形投影到裁剪空间；
4. 将原始 Mercator 坐标传给片元着色器，用于后续数据纹理寻址。

```glsl
in vec2 a_position;
uniform mat4 u_matrix;
uniform float u_worldOffset;
out vec2 mercatorPosition;

void main() {
    gl_Position = u_matrix * vec4(
        a_position.x + u_worldOffset,
        a_position.y,
        0.0,
        1.0
    );
    mercatorPosition = a_position;
}
```

`mainMatrix` 已包含当前地图的中心点、缩放、bearing、pitch、相机透视和视口变换。图层直接复用 MapLibre 的投影结果，不需要自己重复计算俯仰。

### 3.3 为什么片元着色器仍能得到正确经纬度

`mercatorPosition` 是地面矩形四个顶点的 Mercator 坐标。经过光栅化后，GPU 会在三角形内部对它进行透视校正插值。片元着色器将插值结果反算成经纬度：

```glsl
vec2 mercatorToLatlng(vec2 mercator) {
    float lon = (mercator.x - 0.5) * 360.0;
    float y = -(mercator.y - 0.5) * PI * 2.0;
    float lat = (2.0 * atan(exp(y)) - (PI / 2.0)) * PID;
    return vec2(lat, lon);
}
```

因此地图倾斜或旋转时，几何位置由相机矩阵处理，数据采样坐标由地面 Mercator 坐标决定，两者始终保持一致。

---

## 4. 详细实现步骤

### 4.1 构造图层并合并默认配置

```ts
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
```

构造阶段只保存参数并生成图层 ID，不创建 WebGL 资源。真正的初始化发生在图层加入地图、MapLibre 调用 `onAdd()` 时。

需要注意：当前代码在未另外传 ID 参数的情况下，会把 `beforeId` 同时当作本图层的 `id`。而 `addTo()` 又把它当作“插入到哪个图层之前”的 ID。若传入的是一个已经存在的目标图层 ID，会与 MapLibre 的图层 ID 唯一性要求冲突。通常建议不传构造参数 `beforeId`，而是在 `addTo(map, beforeId)` 中指定插入位置。

### 4.2 MapLibre 调用 `onAdd()` 初始化 WebGL

```ts
onAdd(map, gl): void {
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
  // ...缓存 uniform、创建 VBO/VAO、加载纹理
}
```

该阶段依次完成：

1. 保存 MapLibre 地图和共享 WebGL 上下文；
2. 根据是否启用遮罩，选择对应的片元着色器；
3. 编译顶点/片元 Shader 并链接 Program；
4. 缓存所有 uniform location；
5. 创建数据范围矩形的 VBO 和 VAO；
6. 异步加载数据图片；
7. 同步生成颜色纹理；
8. 可选地异步加载遮罩纹理。

遮罩 Shader 在 `onAdd()` 时确定。运行中仅修改 `opts.cut` 或 `cutUrl` 不会重新编译 Shader，也不会加载新的遮罩；如果需要切换有/无遮罩模式，应重建图层。

### 4.3 经纬度边界转成 Web Mercator

```ts
function lngLatToMercator(lng: number, lat: number) {
  const x = lng / 360 + 0.5
  const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat / 2) * (Math.PI / 180))) / (2 * Math.PI)
  return { x, y }
}
```

归一化 Web Mercator 世界坐标中：

- `x=0` 对应西经 180°，`x=1` 对应东经 180°；
- `y=0` 接近北纬 85.0511°，`y=1` 接近南纬 85.0511°；
- 一个完整世界的宽度为 `1`。

使用西北角和东南角组装四个顶点：

```ts
const northWest = lngLatToMercator(this.opts.lonmin, this.opts.latmax)
const southEast = lngLatToMercator(this.opts.lonmax, this.opts.latmin)
const vertices = new Float32Array([
  northWest.x,
  northWest.y, // 西北
  northWest.x,
  southEast.y, // 西南
  southEast.x,
  northWest.y, // 东北
  southEast.x,
  southEast.y, // 东南
])

gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
```

四点使用 `TRIANGLE_STRIP` 组成两个三角形。`changeImageArea()` 修改边界后会重新上传这组顶点，避免“纹理边界更新了但地面几何还在旧位置”的错位。

### 4.4 建立 VAO 顶点属性

```ts
this.vao = gl.createVertexArray()
gl.bindVertexArray(this.vao)
gl.bindBuffer(gl.ARRAY_BUFFER, this.vbuffer)

const posLoc = gl.getAttribLocation(this.program, 'a_position')
gl.enableVertexAttribArray(posLoc)
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

gl.bindVertexArray(null)
```

每个顶点只包含两个 `float`：Mercator `x` 和 `y`。VAO 保存 `a_position` 到 VBO 的绑定，渲染时只需重新绑定 VAO。

### 4.5 加载数据图片并建立数据纹理

`loadImage()` 支持 URL、Image 和 Canvas：

```ts
private loadImage(img): void {
  if (typeof img === 'string') {
    const image = new Image()
    if (this.opts.useCros) image.crossOrigin = 'anonymous'
    image.onload = () => this.handleImageLoaded(this.gl!, image)
    image.src = img
  } else if (img instanceof HTMLCanvasElement) {
    this.handleImageLoaded(this.gl!, img)
  } else if (img.complete && img.naturalWidth > 0) {
    this.handleImageLoaded(this.gl!, img)
  } else {
    img.onload = () => this.handleImageLoaded(this.gl!, img)
  }
}
```

加载完成后做两份保存：

```ts
const canvas = document.createElement('canvas')
canvas.width = img.width
canvas.height = img.height
canvas.getContext('2d')!.drawImage(img, 0, 0)
this.rawImageCanvas = canvas

this.dataTexture = createTexture(gl, img, 0, this.opts.grid!, this.opts.flipy === 1)
```

- GPU 纹理用于渲染；
- Canvas 副本用于 `getGridDataByLatLon()` 在 CPU 侧读取像素。

`grid=true` 使用 `NEAREST`，保留网格像素边界；`grid=false` 使用 `LINEAR`，显示效果更平滑。`flipy=1` 通过 `UNPACK_FLIP_Y_WEBGL` 翻转上传方向。

若 URL 图片需要跨域读取像素，服务器必须返回允许跨域的响应头，并设置 `useCros=true`。否则 Canvas 会被污染，`getImageData()` 将因浏览器安全策略失败。

### 4.6 生成颜色查找纹理

```ts
const vmin = colors.v[0]
const vmax = colors.v[len - 1] + 5
const canvas = document.createElement('canvas')
canvas.width = 25 * len + 5
canvas.height = 3
const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
```

每个数值节点转换成渐变 stop：

```ts
const stop1 = (colors.v[i] - vmin) / (vmax - vmin)
const stop2 = (colors.v[i + 1] - (colors.v[i + 1] - colors.v[i]) * linear - vmin) / (vmax - vmin)

gradient.addColorStop(stop1, color)
gradient.addColorStop(stop2, color)
```

`linear` 控制同一颜色在下一个区间内保持多久：

- `linear=0` 时，当前颜色会保持到下一个值节点附近，效果更接近分段色阶；
- `linear` 增大时，`stop2` 向当前节点移动，当前色到下一色的过渡区间变长；
- 实际可用范围还受 Canvas `addColorStop()` 要求限制，通常使用 `0~1`。

Canvas 被上传到 `TEXTURE1`。片元着色器把解码值归一化后，以 `vin` 作为横坐标查色：

```glsl
float vin = (value - vrange.x) / (vrange.y - vrange.x);
outColor = texture(u_color, vec2(vin, 0.5));
```

颜色数组应满足：

- `r/g/b/v/o` 长度一致；
- 至少包含一个节点，实际使用建议至少两个；
- `v` 按升序排列；
- `r/g/b` 一般为 `0~255`；
- `o` 为 Canvas CSS `rgba()` 接受的透明度，通常为 `0~1`。

### 4.7 可选的遮罩裁剪

只有构造时同时满足 `cut=true` 且存在 `cutUrl`，才会编译遮罩版片元 Shader 并加载遮罩纹理。

```glsl
float cuta = (latlng.x - cutArea.x) / (cutArea.y - cutArea.x);
float cutb = (latlng.y - cutArea.z) / (cutArea.w - cutArea.z);
float cutValue = texture(cutImg, vec2(cutb, cuta)).r;
if (cutValue > 0.5) {
    discard;
}
```

其中：

```text
cutArea = [cutlatmin, cutlatmax, cutlonmin, cutlonmax]
遮罩 UV = [经度方向 cutb, 纬度方向 cuta]
```

遮罩的 R 通道大于 `0.5` 时不绘制该片元。遮罩纹理固定使用线性采样并进行 Y 翻转。

无遮罩 Shader 会显式检查片元是否位于 `tbound` 内。遮罩 Shader 依靠地面矩形本身限制数据范围，但遮罩 UV 超出 `cutArea` 时会因为 `CLAMP_TO_EDGE` 而沿用遮罩边缘值，所以遮罩地理范围应覆盖数据矩形，或确保边缘像素符合预期。

### 4.8 每帧接收 MapLibre 相机矩阵

```ts
this.projectionMatrix.set(options.defaultProjectionData.mainMatrix)
gl.uniformMatrix4fv(this.u_matrix, false, this.projectionMatrix)
```

复用 `Float32Array(16)` 有两个目的：

- 将 MapLibre 可能提供的 64 位矩阵转换成 WebGL uniform 接受的 32 位数据；
- 避免每帧创建临时数组。

这一步是 pitch/bearing 支持的核心。之后上传边界、解码比例、颜色值域和低值透明开关：

```ts
gl.uniform4f(u_tbound, latmin, latmax, lonmin, lonmax)
gl.uniform4f(u_scale, scale.r, scale.g, scale.b, scale.a)
gl.uniform1i(u_tminOpacity, minOpacity ? 1 : 0)
gl.uniform2f(u_vrange, vmin, vmax)
```

### 4.9 片元着色器逐像素解码和着色

完整过程为：

```glsl
// 1. 地面 Mercator 坐标转经纬度
vec2 latlng = mercatorToLatlng(mercatorPosition);

// 2. 经纬度在数据边界中归一化为纹理坐标
float b = (latlng.x - tbound.x) / (tbound.y - tbound.x); // 纬度
float a = (latlng.y - tbound.z) / (tbound.w - tbound.z); // 经度

// 3. 采样并恢复 RGBA 字节
vec4 color = texture(u_img, vec2(a, b)) * 255.0;

// 4. 按数据编码协议解码
float value = color.r / scale.x
            + color.g / scale.y
            + color.b / scale.z
            + color.a / scale.w;

// 5. 数值归一化并查询颜色
float vin = (value - vrange.x) / (vrange.y - vrange.x);
outColor = texture(u_color, vec2(vin, 0.5));

// 6. 预乘 alpha
outColor.rgb *= outColor.a;
```

Shader 中变量名 `a/b` 分别对应经度/纬度归一化结果，最终采样顺序为 `vec2(a, b)`，即纹理 U 轴对应经度、V 轴对应纬度。

`minOpacity=true` 时，低值区域会进一步降低 alpha：

- 遮罩 Shader：`smoothstep(vmin*0.5, vmin*2.0, value)`；
- 无遮罩 Shader：在约 `vmin*0.8 ~ vmin*1.3` 之间线性过渡。

两条 Shader 路径的淡化公式并不相同，这是当前实现的既有行为。

最后执行 `outColor.rgb *= outColor.a`，输出预乘 alpha 颜色，以配合 MapLibre 默认的 `(ONE, ONE_MINUS_SRC_ALPHA)` 混合方式。

### 4.10 绘制世界副本

Mercator 世界宽度为 `1`。给顶点 X 加减整数，即可把同一个图层放到相邻世界：

```ts
const centerWorld = Math.floor((map.getCenter().lng + 180) / 360)
const worldOffsets = map.getRenderWorldCopies()
  ? [centerWorld - 1, centerWorld, centerWorld + 1]
  : [0]

for (const worldOffset of worldOffsets) {
  gl.uniform1f(this.u_worldOffset, worldOffset)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}
```

顶点位置使用偏移后的 X，传给片元着色器的 `mercatorPosition` 仍是未偏移坐标，所以每个世界副本都采样同一份数据纹理。

### 4.11 数据更新和重绘

资源发生变化后调用：

```ts
private requestRepaint(): void {
  if (this.map) {
    this.map.triggerRepaint()
  }
}
```

它只通知 MapLibre 安排下一帧，不会建立独立动画循环。以下操作会触发重绘：图片加载完成、边界改变、颜色纹理改变、采样模式改变、遮罩加载完成等。

### 4.12 移除图层和释放资源

用户调用 `destroy()`：

```ts
destroy(): void {
  if (this.isDestroyed) return
  this.isDestroyed = true
  if (this.map) {
    this.map.removeLayer(this.id)
  }
}
```

MapLibre 随后调用 `onRemove()`，删除：

- Shader Program；
- VAO；
- VBO；
- 数据纹理；
- 颜色纹理；
- 遮罩纹理。

`destroy()` 是幂等的，但当前实例销毁后不能重新 `addTo()`，因为 `isDestroyed` 不会复位，异步图片回调也会被忽略。

---

## 5. 使用示例

下面的结构取自项目中的 `useStainImg.ts`，省略了业务 URL：

```ts
import { ColorfulMapImage } from '@/libs/ColorfulMapImage'
import type { IColorRange, IScaleProps } from '@/libs/ColorfulMapImage'

const colors: IColorRange = {
  r: [235, 111, 124, 129],
  g: [235, 117, 150, 169],
  b: [235, 209, 217, 218],
  v: [0, 50, 100, 150],
  o: [0.8, 0.8, 0.8, 0.8],
}

const scale: IScaleProps = {
  r: 1,
  g: 1,
  b: 1,
  a: 1,
}

const layer = new ColorfulMapImage({
  img: '/data/202605171000_ghi.png',
  scale,
  colors,
  latmin: 17,
  latmax: 55,
  lonmin: 72,
  lonmax: 136,
  interval: 0.1,
  linear: 1,
  flipy: 0,
  grid: false,
  minOpacity: false,
  useCros: true,
  cut: true,
  cutUrl: '/mask/100000.png',
  cutlatmin: 18.15,
  cutlatmax: 53.57,
  cutlonmin: 73.49,
  cutlonmax: 135.1,
})

layer.setGetGrid(true)
layer.addTo(map)

// 只替换时次图片，复用 Program、VBO 和 Texture 对象
layer.changeImage('/data/202605171100_ghi.png')

// 批量替换数据、比例和色标
layer.changeAll({
  img: '/data/202605171200_ghi.png',
  scale,
  colors,
  minOpacity: true,
})

// 查询指定经纬度对应的原始数据值
const result = layer.getGridDataByLatLon(39.9, 116.4)

// 页面卸载时释放
layer.destroy()
```

Vue 中应在 `onBeforeUnmount()` 调用 `destroy()`，避免地图图层和显存资源残留。

---

## 6. 类型与参数表

### 6.1 `IColorfulMapImageOptions`

| 参数                    | 类型                                              |       必填 | 默认值      | 说明                                                                                 |
| ----------------------- | ------------------------------------------------- | ---------: | ----------- | ------------------------------------------------------------------------------------ |
| `img`                   | `string \| HTMLImageElement \| HTMLCanvasElement` |         是 | 无          | RGBA 编码的数据图片；URL 会异步加载                                                  |
| `lonmin`                | `number`                                          |         是 | 无          | 数据西边界，经度                                                                     |
| `lonmax`                | `number`                                          |         是 | 无          | 数据东边界，经度                                                                     |
| `latmin`                | `number`                                          |         是 | 无          | 数据南边界，纬度                                                                     |
| `latmax`                | `number`                                          |         是 | 无          | 数据北边界，纬度                                                                     |
| `scale`                 | `IScaleProps`                                     |         是 | 无          | RGBA 解码除数，公式为 `R/r + G/g + B/b + A/a`；各值不能为 0                          |
| `colors`                | `IColorRange`                                     |         是 | 无          | 值域到颜色和透明度的映射                                                             |
| `beforeId`              | `string`                                          |         否 | `undefined` | 预期表示插入目标图层；当前实现也会把它用作本图层 ID，建议改用 `addTo(map, beforeId)` |
| `interval`              | `number`                                          |         否 | `undefined` | 数据网格经纬度间隔，仅用于 `getGridDataByLatLon()` 的坐标到像素换算                  |
| `grid`                  | `boolean`                                         |         否 | `false`     | `true` 使用 `NEAREST`；`false` 使用 `LINEAR`                                         |
| `linear`                | `number`                                          |         否 | `0`         | 颜色 stop 过渡参数，通常使用 `0~1`                                                   |
| `flipy`                 | `0 \| 1`                                          |         否 | `0`         | 上传数据纹理时是否垂直翻转                                                           |
| `minOpacity`            | `boolean`                                         |         否 | `false`     | 是否对颜色最小值附近的低值区域淡化                                                   |
| `useCorrect`            | `boolean`                                         |         否 | `false`     | 兼容保留参数，当前实现未读取，不影响渲染                                             |
| `cut`                   | `boolean`                                         |         否 | `false`     | 是否启用遮罩 Shader；需同时传 `cutUrl`                                               |
| `cutUrl`                | `string`                                          |   条件必填 | `undefined` | 遮罩图片 URL，遮罩 R 通道大于 `0.5` 的位置不显示                                     |
| `cutlatmin`             | `number`                                          | 遮罩时必填 | `undefined` | 遮罩南边界                                                                           |
| `cutlatmax`             | `number`                                          | 遮罩时必填 | `undefined` | 遮罩北边界                                                                           |
| `cutlonmin`             | `number`                                          | 遮罩时必填 | `undefined` | 遮罩西边界                                                                           |
| `cutlonmax`             | `number`                                          | 遮罩时必填 | `undefined` | 遮罩东边界                                                                           |
| `useCros`               | `boolean`                                         |         否 | `false`     | URL 数据图片加载前设置 `crossOrigin='anonymous'`；参数名保持现有拼写                 |
| `preserveDrawingBuffer` | `boolean`                                         |         否 | `false`     | 兼容保留参数；共享上下文由 MapLibre 创建，当前类未使用此值                           |

### 6.2 `IScaleProps`

| 字段 | 类型     | 说明               |
| ---- | -------- | ------------------ |
| `r`  | `number` | 红通道解码除数     |
| `g`  | `number` | 绿通道解码除数     |
| `b`  | `number` | 蓝通道解码除数     |
| `a`  | `number` | Alpha 通道解码除数 |

解码公式：

```ts
value = R / r + G / g + B / b + A / a
```

### 6.3 `IColorRange`

| 字段 | 类型       | 说明                                                |
| ---- | ---------- | --------------------------------------------------- |
| `r`  | `number[]` | 各数值节点的红色通道，一般为 `0~255`                |
| `g`  | `number[]` | 各数值节点的绿色通道，一般为 `0~255`                |
| `b`  | `number[]` | 各数值节点的蓝色通道，一般为 `0~255`                |
| `v`  | `number[]` | 升序数值节点；首项为 `vmin`，末项加 5 后作为 `vmax` |
| `o`  | `number[]` | 各数值节点的透明度，通常为 `0~1`                    |

五个数组依赖相同下标表达一条色标记录，因此长度必须一致。

### 6.4 `IGridDataResult`

```ts
interface IGridDataResult {
  data: number | null
  lat: number
  lon: number
}
```

| 字段   | 说明                                        |
| ------ | ------------------------------------------- |
| `data` | 解码后的数值；超出范围或读取失败时为 `null` |
| `lat`  | 调用方传入的纬度                            |
| `lon`  | 调用方传入的经度                            |

---

## 7. 对外属性和方法文档

### 7.1 MapLibre 接口属性

| 属性            | 值/类型    | 说明                               |
| --------------- | ---------- | ---------------------------------- |
| `id`            | `string`   | MapLibre 图层唯一 ID；默认自动生成 |
| `type`          | `'custom'` | 表示自定义 WebGL 图层              |
| `renderingMode` | `'2d'`     | 二维覆盖层模式，不共享三维深度     |

### 7.2 `constructor(options)`

```ts
new ColorfulMapImage(options: IColorfulMapImageOptions)
```

创建实例并合并默认配置。此时尚未获得 WebGL 上下文，不会加载纹理；需继续调用 `addTo()` 或 `map.addLayer(layer)`。

### 7.3 `addTo(map, beforeId?)`

```ts
addTo(map: maplibregl.Map, beforeId?: string): this
```

把当前实例添加到地图。`beforeId` 指定插入到某个已有图层之前；省略时读取构造参数中的 `beforeId`。返回当前实例，可链式调用。

```ts
const layer = new ColorfulMapImage(options).addTo(map, 'labels')
```

### 7.4 `changeImage(img)`

```ts
changeImage(
  img: string | HTMLImageElement | HTMLCanvasElement
): void
```

更新数据图片，不修改地理范围、色标和解码比例。首次纹理已创建时会复用 `WebGLTexture`，通过 `texImage2D()` 替换内容。

URL 加载是异步的；方法返回不代表新图已经显示。当前实现没有请求序号控制，多次快速传入 URL 时，最后完成加载的请求会覆盖纹理，不一定是最后调用的 URL。

### 7.5 `changeAll(options)`

```ts
changeAll(
  options: Partial<IColorfulMapImageOptions>
): void
```

当前实际处理的字段只有：

- `minOpacity`；
- `scale`；
- `colors`；
- `img`。

其他字段即使通过类型传入也不会在此方法中生效。修改经纬度范围应使用 `changeImageArea()`；修改 `linear` 或 `grid` 应分别调用专用方法。

另外，该方法只能在 `onAdd()` 完成、`gl` 和 `program` 已存在后工作；添加到地图之前调用会直接返回，传入参数不会保存。

### 7.6 `changeImageArea(...)`

```ts
changeImageArea(
  url: string,
  latmin: number,
  latmax: number,
  lonmin: number,
  lonmax: number,
  extra?: Partial<IColorfulMapImageOptions>
): void
```

一次更新图片 URL 和地理覆盖范围，并重建地面矩形顶点。`extra` 当前实际处理：

- `flipy`；
- `interval`；
- `grid`；
- `colors`。

如果首张图片尚未 ready，方法会使用 `requestAnimationFrame()` 持续重试。若首图一直无法进入 ready 状态或实例已销毁，调用方应避免继续发起该操作。

### 7.7 `changeColors(colors)`

```ts
changeColors(colors: IColorRange): void
```

重新生成颜色 Canvas 并更新 `TEXTURE1`，不重新加载数据图。

### 7.8 `changeLinear(n)`

```ts
changeLinear(n: number): void
```

更新颜色渐变 stop 的分布并重建颜色纹理。该值不是数据纹理的插值开关；数据纹理插值由 `changeGrid()` 控制。

### 7.9 `changeGrid(enabled)`

```ts
changeGrid(enabled: boolean): void
```

动态切换数据纹理过滤方式：

- `true`：`NEAREST`，强调离散格点；
- `false`：`LINEAR`，在相邻像素间插值。

状态没有变化时直接返回。

### 7.10 `setGetGrid(enabled)`

```ts
setGetGrid(enabled: boolean): void
```

启用或禁用 CPU 像素查询。只有启用后，`getGridDataByLatLon()` 才会返回查询结果。图层未 ready 时会在后续动画帧重试。

### 7.11 `getGridDataByLatLon(lat, lon)`

```ts
getGridDataByLatLon(
  lat: number,
  lon: number
): IGridDataResult | null
```

查询指定经纬度对应的原始数据值。

前置条件：

1. 已调用 `setGetGrid(true)`；
2. 数据图片已加载并存在 Canvas 副本；
3. 配置了非零 `interval`；
4. 跨域图片允许 Canvas 读取。

像素索引：

```ts
const x = Math.round((lon - lonmin) / interval)
const y = Math.round((lat - latmin) / interval)
```

返回规则：

- 查询功能未开启、Canvas 不存在或 `interval` 缺失：返回 `null`；
- 经纬度超出范围：返回 `{ data: null, lat, lon }`；
- 像素读取失败：返回 `{ data: null, lat, lon }`；
- 成功：返回解码值和原始经纬度。

该方法按统一的经纬度间隔计算 X/Y，不使用图片宽高反推间隔；调用方必须保证 `interval` 与图片网格一致。CPU 查询读取的是原始像素，不会应用 GPU 的线性纹理插值、颜色映射、遮罩或 `minOpacity`。

### 7.12 `destroy()`

```ts
destroy(): void
```

从地图移除图层，并通过 MapLibre 的 `onRemove()` 释放 WebGL 资源。可重复调用，但销毁后的实例不应再次使用。

### 7.13 MapLibre 生命周期方法

以下方法是公开成员，但通常由 MapLibre 调用，不应由业务代码直接调用。

| 方法                  | 调用时机                  | 主要职责                                                 |
| --------------------- | ------------------------- | -------------------------------------------------------- |
| `onAdd(map, gl)`      | `map.addLayer()` 后       | 编译 Shader，创建 Program/VBO/VAO，加载纹理              |
| `render(gl, options)` | MapLibre 每个需要绘制的帧 | 上传相机矩阵和 uniform，绑定纹理，绘制地面矩形及世界副本 |
| `onRemove(map, gl)`   | `map.removeLayer()` 后    | 删除 Program、VAO、VBO 和纹理，清空引用                  |

---

## 8. 模块导出

统一入口 `index.ts` 导出：

```ts
export { ColorfulMapImage } from './ColorfulMapImage'
export type { IColorRange, IScaleProps, IColorfulMapImageOptions, IGridDataResult } from './types'
```

推荐统一从模块入口导入：

```ts
import {
  ColorfulMapImage,
  type IColorRange,
  type IScaleProps,
  type IColorfulMapImageOptions,
  type IGridDataResult,
} from '@/libs/ColorfulMapImage'
```

---

## 9. 生命周期总览

```text
new ColorfulMapImage(options)
          │
          ▼
layer.addTo(map)
          │
          ▼
MapLibre: onAdd(map, gl)
  ├─ 编译并链接 Shader
  ├─ 构造 Mercator 地面矩形
  ├─ 加载数据纹理
  ├─ 创建颜色纹理
  └─ 可选加载遮罩纹理
          │
          ▼
数据图加载完成 -> ready=true -> triggerRepaint()
          │
          ▼
MapLibre: render(gl, options)
  ├─ 上传 mainMatrix（含 pitch/bearing）
  ├─ 上传边界、scale、值域等 uniform
  ├─ 绑定 2~3 张纹理
  └─ 绘制当前世界及可选世界副本
          │
          ├─ changeImage / changeColors / changeGrid / ...
          │       └─ 更新资源并 triggerRepaint()
          │
          ▼
layer.destroy()
          │
          ▼
MapLibre: onRemove(map, gl)
  └─ 释放全部 WebGL 资源
```

新版的核心可以概括为：**数据仍按原有 RGBA 协议解码，但承载数据的几何从“屏幕全屏矩形”升级为“Web Mercator 地面矩形”，并完全交给 MapLibre 相机矩阵投影，因此自然获得缩放、旋转、俯仰、透视及世界副本支持。**
