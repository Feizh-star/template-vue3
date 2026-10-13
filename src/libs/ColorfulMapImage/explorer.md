# ColorfulMapImage 实现原理与统一更新 API

ColorfulMapImage 是 MapLibre 自定义图层。输入图片的 RGBA 通道编码数值，
Fragment Shader 按 scale 解码，再使用 colors 生成的色带映射颜色。
可选遮罩的 R 通道大于 0.5 时丢弃片元。

## 使用方式

```ts
import { ColorfulMapImage } from '@/libs/ColorfulMapImage'

const layer = new ColorfulMapImage({
  img: '/data/a.png',
  latmin: 17,
  latmax: 55,
  lonmin: 72,
  lonmax: 136,
  scale: { r: 1, g: 1, b: 1, a: 1 },
  colors: {
    r: [0, 255],
    g: [0, 100],
    b: [255, 0],
    v: [0, 100],
    o: [0.8, 0.8],
  },
  interval: 0.1,
  getGrid: true,
}).addTo(map, 'labels')

layer.setOption({
  img: '/data/b.png',
  latmin: 20,
  scale: { r: 2, g: 2, b: 2, a: 2 },
  linear: 1,
})
// 图片、范围、解码参数、色带插值一起等待 b.png 就绪。

layer.setOption({ minOpacity: true })
// 若 b.png 仍在等待，该修改也并入同一次主图提交。

layer.setOption({
  cut: true,
  cutUrl: '/mask/china.png',
  cutlatmin: 18.15,
  cutlatmax: 53.57,
  cutlonmin: 73.49,
  cutlonmax: 135.1,
})
// 裁剪组独立等待 china.png，不阻塞主图组。

const value = layer.getGridDataByLatLon(30, 110)
layer.destroy()
```

## 公开 API

- 构造函数接收完整的 IColorfulMapImageOptions。
- setOption(options: Partial<IColorfulMapImageOptions>): this 是唯一参数更新入口。
- addTo(map, beforeId?): this 添加到地图，beforeId 指定插入位置。
- getGridDataByLatLon(lat, lon): IGridDataResult | null 查询原始数据。
- destroy(): void 销毁图层，重复调用无副作用。

旧的 changeImage、changeAll、changeImageArea、changeColors、changeLinear、
changeGrid、setGetGrid 已删除，查询开关改为 getGrid 选项。

setOption 按顶层浅合并；未提供或为 undefined 的字段保留旧值，false 和 0 正常生效。
scale 和 colors 必须传入完整对象，整体替换，不合并深层字段。
提交时复制 scale、colors 及其中数组，调用方后续修改对象不会改变正在绘制的状态。
显式提交 img/cutUrl 会重新准备资源，即使引用或 URL 相同，因此也支持刷新原地修改的 Canvas。

## 生效与等待规则

| 分组   | 参数                                                    | 规则                                           |
| ------ | ------------------------------------------------------- | ---------------------------------------------- |
| 主图组 | 除裁剪组以外的全部选项                                  | 提交 img 或已有主图等待时，整组等待图片就绪    |
| 裁剪组 | cut、cutUrl、cutlatmin、cutlatmax、cutlonmin、cutlonmax | 提交 cutUrl 或已有遮罩等待时，整组等待遮罩就绪 |

没有相关等待时，参数在下一次 MapLibre render 开始时生效。
Canvas 和已加载的 Image 无需网络等待，但仍在渲染开始时统一提交。
尚未加载的 HTMLImageElement 使用事件监听，不覆盖调用方的 onload/onerror。

两组独立：img 与 colors 一起等待；img 与裁剪范围同时更新时，裁剪范围可先提交。
img 和 cutUrl 同时更新时，各自就绪后分别提交，不要求同时完成。
prepareDrawState 在提交边界统一判断可绘制性，返回已生效参数、program 与纹理的本帧快照；
资源不足时返回 null。render 只消费快照，不检查目标配置或解释资源等待状态。
开启裁剪且 cutUrl 非空时，快照必须包含可用遮罩和裁剪 Shader 才能绘制。
首次加载或运行时首次开启裁剪时，主图先就绪也会等待遮罩，避免闪现未裁剪的色斑图。
首次遮罩加载失败时保持不绘制，可以重新提交 cutUrl 重试，或关闭裁剪后绘制。
已有生效遮罩时，替换遮罩的等待期间继续使用旧遮罩和旧裁剪范围绘制。
cutUrl 与 cut: false 一起提交时，也等待本次遮罩请求；仅 cut: false 则无需加载。
非空 cutUrl 即使 cut: false 也会加载并缓存，之后启用裁剪可直接使用。
cutUrl: '' 清除遮罩缓存并关闭遮罩 Shader，无需加载；undefined 不用于清除。

等待期间追加的同组修改合并到目标状态，最新字段值优先。
后续图片请求替代此前请求，但保留已合并的其他参数；
每组独立的版本号阻止旧请求回写。加载或资源准备失败时撤销该组待提交选项，
保留上一份可用状态，另一组不受影响。首次主图加载失败时不绘制。

## 初始化与更新共用流程

构造函数仅保存默认值和初始配置；添加前的 setOption 也只保存配置。

onAdd 创建 buffer、VAO 和初始无遮罩 program，然后通过 setOption 应用完整目标配置。
初次应用和后续修改共用以下流程：

1. 合并目标选项，按主图/遮罩划分待提交字段。
2. loadResource 准备图片，回调只标记资源就绪，不操作 GL。
3. render 开始时 prepareDrawState 调用 commitOptions，分别提交已就绪的组。
4. applyMain 按变化更新纹理、色带、几何、采样和图层顺序；
   applyCut 更新遮罩纹理和对应 Shader。
5. prepareDrawState 根据裁剪要求和已提交资源生成可绘制快照；
   render 使用快照，像素查询读取 applied，两者使用同一份已生效参数。

同一批范围修改只更新一次几何，colors 与 linear 同批修改只生成一次色带。
flipy 单独修改时使用缓存的 Image 或 Canvas 快照重新上传纹理，不下载图片。
Image 直接上传到 GL，原始 Canvas 副本仅供查询，避免中转影响 RGBA 编码值。
grid 单独修改时仅更新 NEAREST/LINEAR 采样方式。
切换裁剪 Shader 会重新绑定 attribute location，复用同一 VAO 和 buffer。
新图片采用新纹理，成功准备后释放旧纹理；移除图层时释放 GL 资源，
清除像素缓存并使未完成加载失效。移除后重新添加会从最新目标配置重新初始化。

## 参数说明

必填：img、latmin、latmax、lonmin、lonmax、scale、colors。

| 参数                                    | 默认值    | 作用                                                      |
| --------------------------------------- | --------- | --------------------------------------------------------- |
| linear                                  | 0         | 色带过渡参数                                              |
| grid                                    | false     | true 使用 NEAREST，false 使用 LINEAR                      |
| flipy                                   | 0         | 上传主图纹理时是否垂直翻转                                |
| minOpacity                              | false     | 低值透明度处理                                            |
| getGrid                                 | false     | 启用原始像素查询                                          |
| interval                                | undefined | 查询时使用的经纬度网格间隔                                |
| beforeId                                | undefined | 插入目标图层；更新时通过 moveLayer 调整，自身 id 保持稳定 |
| useCros                                 | false     | URL 主图加载时设置 crossOrigin='anonymous'                |
| cut                                     | false     | 启用裁剪；需要可用遮罩和完整裁剪范围                      |
| cutUrl                                  | undefined | 遮罩图片 URL，始终使用 anonymous 跨域模式                 |
| cutlatmin/cutlatmax/cutlonmin/cutlonmax | undefined | 遮罩地理范围                                              |

useCros 单独修改时保存到配置，影响后续 URL 加载；与 img 同传时影响本次加载。
服务器仍需提供对应跨域响应头，才能读取原始像素。

## 渲染与查询

几何矩形使用标准化 Web Mercator 坐标，经 MapLibre 相机矩阵投影。
主图 UV 根据经纬度范围计算，解码公式为：

```text
value = R / scale.r + G / scale.g + B / scale.b + A / scale.a
```

TEXTURE0 保存数据，TEXTURE1 保存色带，TEXTURE2 保存可选遮罩。
颜色输出采用预乘 alpha。按 map.getRenderWorldCopies() 绘制邻近世界副本。
当前 Shader 使用 GLSL ES 3.00 和 VAO，实际需要 WebGL2 上下文。

minOpacity 在裁剪与非裁剪 Shader 中共用同一函数，不随裁剪开关改变。
正数 vmin 沿用 smoothstep(0.5 * vmin, 2 * vmin, value)；
负数 vmin 将这两个边界按升序排列，保持数值越大透明度越高。
vmin 为零时使用阶跃阈值：value < 0 完全透明，value >= 0 保留色带 alpha。
关闭 minOpacity 时直接使用色带 alpha。

像素查询使用已生效的 interval、范围和 scale，读取未经 GPU 翻转的原始 Canvas，
保持原有查询语义；不应用颜色映射、采样插值、裁剪或 minOpacity。
未开启 getGrid、尚无主图或缺少 interval 时返回 null；
超出地理范围或读取失败时返回 { data: null, lat, lon }。
调用方需要保证 interval 与原始图片网格一致。

ColorfulMapImage_anno.ts 是正式实现的完整注释副本，保留同样的代码、Shader 与公开 API，
并添加详细中文注释说明渲染、参数分组、异步加载、资源提交和生命周期。
业务入口 index.ts 默认使用正式版；修改正式实现时应同步更新注释副本。

## 验证

使用独立配置运行图层与导出模块的资源行为测试，避免应用 Vite 插件影响：

```sh
npx vitest run --config src/libs/ColorfulMapImage/__tests__/vitest.config.ts
```
