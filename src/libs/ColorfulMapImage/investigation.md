# ColorfulMapImage 色带末尾纯色问题排查

排查日期：2026-10-13。

以下第 1–5 节记录修复前的证据与建议；当前修复结果见文末。

已在系统 Chrome 中复现与 `issue.md` 相同的故障机制：损坏 PNG 进入图片加载成功路径，`texImage2D` 报 `INVALID_VALUE: bad image data`，图层继续提交失败纹理，画面变成色带末尾色；重新提交正常 PNG 后恢复。

此次仅新增诊断用例和本记录，应用、缓存和图层实现保持原样。测试使用受控 `Response` / 原生 `ReadableStream` 模拟 HTTP 响应；PNG 加载、解码、WebGL 上传和 Shader 绘制使用 Chrome 原生实现。尚未取得原故障请求的响应头和完整字节，不能确定现场命中了下面哪种续传分支。

## 1. 缓存续传能够生成损坏 PNG

位置：`src/compositions/maplibre-gl/core/useStainImageCache/ResumableImageLoader.ts`。

### 暂停后旧读取任务仍可追加字节

`run()` 第 103–107 行在 `await reader.read()` 后直接修改共享的 `receivedBytes` 和 `chunks`，未检查此次请求是否已取消，也没有隔离旧、新读取任务。`pause()` 只改变暂停状态并调用 `abort()`。

在受控时序中，旧 `read()` 已取得一个 10 字节的数据块，但其后续代码尚未运行：

1. 已确认缓存了 3826 字节。
2. 旧读取获得下一块 10 字节。
3. 暂停后立即续传，发出 `Range: bytes=3826-`。
4. 旧读取的后续代码仍追加那 10 字节。
5. 正确的 206 响应从 3826 开始返回剩余数据，又包含那 10 字节。

最终文件从 7652 字节变为 7662 字节。这次服务端响应范围正确，损坏发生在客户端拼接。

### 200 和 206 缺少必要校验

- 续传收到 200 完整响应时，没有丢弃此前前缀，直接把整份文件追加到前缀后面。
- 206 只用于设置 `isPart`；`Content-Range` 仅在 `totalBytes === 0` 时用于读取总长度，没有验证范围起点是否等于请求偏移。
- `reader.read()` 返回 `done` 后直接生成 Blob，没有验证累计字节是否覆盖整个文件。一次部分响应结束并不表示完整文件已下载。
- 没有保存资源验证器或发送 `If-Range`，文件在两次请求间发生变化时也可能混合不同版本。此项为源码风险，未在本次复现中验证。

服务器可以忽略 Range；206 也允许只返回所请求范围的一部分，需要客户端继续获取剩余部分。参见 [RFC 9110 §14.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2)、[§13.1.5 If-Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5)。

### 实测对照

原始图片为仓库已有的 65 × 65 PNG，长度 7652 字节，暂停位置为 3826。

| 情况                                       | 输出 Blob 字节数 | 字节与原文件一致 | Image.decode() | WebGL 上传            |
| ------------------------------------------ | ---------------: | ---------------- | -------------- | --------------------- |
| 正确 206，旧读取已结束                     |             7652 | 是               | 成功           | NO_ERROR              |
| Range 被忽略，续传返回 200                 |            11478 | 否               | 成功           | INVALID_VALUE（1281） |
| 206 只返回接下来的 10 字节                 |             3836 | 否               | 成功           | INVALID_VALUE（1281） |
| 206 起点比请求偏移晚 10 字节               |             7642 | 否               | 成功           | INVALID_VALUE（1281） |
| 正确 206，但暂停后的旧读取重复追加 10 字节 |             7662 | 否               | 成功           | INVALID_VALUE（1281） |

所有损坏输出都被 `isComplete` 标记为完成，因为该属性只检查 Blob URL 是否存在。本次损坏 PNG 的 `Image.decode()` 仍成功，图片尺寸仍为 65 × 65；所以增加 `decode()` 或只检查尺寸不足以阻止这条失败链。

## 2. 图层把上传失败的纹理当作成功结果提交

位置：`ColorfulMapImage.ts`：

- 第 151–179 行：`createTexture()` 只捕获 JavaScript 异常，没有检查 WebGL 错误状态。
- 第 520–521 行：图片加载成功的判断只检查 `naturalWidth > 0`。
- 第 620 行：`applyMain()` 删除旧数据纹理，保存新纹理。
- 第 567 行：`commitOptions()` 提交新参数。

把上表中不完整 206 对应的 3836 字节 PNG 交给原版图层，得到以下实测结果；这个用例没有替换或打桩 `texImage2D`：

```text
WebGL: INVALID_VALUE: texImage2D: bad image data
图片 complete = true，naturalWidth = 65，naturalHeight = 65
gl.getError() = 1281
旧纹理被删除 = true
当前纹理被替换 = true
图片与范围参数被提交 = true
图层仍接受绘制状态 = true
```

诊断使用两个颜色端点的色带，并实际读取 WebGL 绘制像素：

```text
正常图：          [0, 0, 255, 255]
损坏 PNG 提交后： [255, 0, 0, 255]  // 色带末尾色
正常 PNG 重载后： [0, 0, 255, 255]
恢复后的 GL 错误：NO_ERROR
```

另一个控制用例直接制造不抛 JavaScript 异常的 GL 上传错误，也复现了同样的旧纹理删除、失败纹理提交和末尾色现象。

Chromium 在无法从图像取得用于上传的像素表示时会合成 `GL_INVALID_VALUE` 和 `bad image data`；参见 [Chromium WebGL 实现的 TexImageHelperHTMLImageElement](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc)。

### 为什么是温度色带末尾

当前业务温度 `scale` 为 `{ r: 10, g: 10, b: 10, a: 1 }`。上传失败的未完整纹理在本次绘制中产生了能映射到色带末尾的采样结果；按当前 Shader 的解码公式，黑色不透明采样 `(0, 0, 0, 1)` 解码为 `255`。

温度色带的最大值为 `42`，业务加上 `50` 的偏移，图层再加 `5`，最终上界为 `97`。`255 > 97`，纹理坐标越界后由 `CLAMP_TO_EDGE` 取末尾颜色。这与原描述吻合，诊断也验证了实际输出像素。

## 3. 另一个独立问题：取消重启可能让请求悬挂

响应头尚未返回时连续调用两次 `getCurrentUrlWithCache()`：

1. 第二次调用通过 `pauseLoaders()` 中断第一次请求，并清掉旧 `onLoad`。
2. 立即调用 `start()`，此时旧请求的 `fetchLoading` 仍为 `true`。
3. `run()` 输出 `Task is running` 并返回，没有发起后继请求。
4. 旧请求随后处理 `AbortError`，也不会通知加载完成或错误。

实测只发起一次 fetch，两次外层 Promise 均未完成，`loading` 保持 `true`。这能解释之前回归中伴随 `Task is running` 的加载停滞，是另一条失败路径。

此外，404 等 HTTP 失败统一被写成 `Server does not support Range requests`，该错误文本不能证明服务器不支持 Range。`start()` 未处理 `run()` 抛出的 Promise 拒绝，也能解释日志中的 `Uncaught (in promise)`。

## 4. 已检查的其他方向

- 当前缓存传出的是 Blob URL，没有创建、复用或修改 `HTMLImageElement`；图层接收字符串时每次创建新的 `Image`。
- 对正常 PNG，等待 `Image.load` 后撤销 Blob URL，再上传该已加载 Image，实测结果是 `NO_ERROR`。因此普通的“加载完成后撤销 URL”不足以解释本次现象。撤销尚未加载的 URL 仍可能导致另一条 `Image.error` 路径。
- 使用 65 × 65 的小图也复现了故障，所以大图和显存不足不是这条机制的必要条件；大图仍可能放大时序窗口或资源压力。

## 5. 建议的局部修复顺序

1. **修复现有 loader 的取消和续传边界，保留现有 API。** 每次请求持有局部 controller / 请求版本；读取后检查是否仍为有效任务；旧任务不能修改新任务的字节数组、计数或清理状态。取消期间的重启要真正执行，不能仅输出警告并返回。
2. **补齐响应和完整性检查。** 200 完整响应重置已有片段；206 验证 `Content-Range` 起点、结束、总长度和实际响应长度；只有累计覆盖完整文件才能生成完成缓存。无法验证或发生不一致时丢弃片段并重新完整下载。资源可能变化时使用强验证器与 `If-Range`。
3. **让纹理上传失败阻止提交。** 在自身上传操作的边界检查 GL 错误并抛出明确错误，让已有回滚流程保留旧纹理和已应用参数。MapLibre 共用 GL 上下文，检查时需区分先前错误与本次上传错误，避免误归因。查询或尺寸检查不能替代上传成功检查。
4. **完善错误和 Promise 的收尾。** 报告 HTTP 状态与 URL，处理 `run()` 的拒绝；激活预取 loader 时，当前请求也必须接收到失败通知。

确定现场触发分支仍需对齐同一请求的 URL、Range、状态码、Content-Range、Content-Length、ETag，以及拼接前后的字节数。已经有足够证据确认上述实现缺陷可共同产生原问题，不需要先假定显存不足。

## 诊断复跑

```sh
npm.cmd exec playwright test -- --config tests/colorful-image-diagnostics.config.ts
```

排查阶段的 5 项诊断断言验证了旧实现的缺陷和正常对照。用例已改为修复回归，测试结果包含 Range、取消、纹理提交和 URL 撤销的 JSON 附件。

诊断文件：`tests/colorful-image-diagnostics.spec.ts`、`tests/colorful-image-diagnostics.config.ts`。运行配置使用系统 Chrome、最大化窗口和本地 4125 端口。

## 修复结果

修复保留原缓存 API 和预取流程，仅调整现有 loader、缓存请求收尾和纹理上传检查：

- 每个 loader 请求使用独立 controller，暂停时立即失效；读取完成后检查请求身份，旧请求不能追加字节或清理新请求状态。
- 200 重置旧片段；206 校验范围、资源验证器、响应长度和文件总长，合法的多段 206 会继续请求剩余数据。
- 使用强 ETag 与 `If-Range` 确认资源版本。缺少强 ETag、范围不符、资源版本变化、续传 fetch 失败或收到 416 时回退完整下载；无法恢复的响应按错误结束，缓存不会标记为完成。
- 已确认收齐字节后暂停，重新开始可直接完成缓存，无需发送超出末尾的 Range。
- 相同 URL 的并发请求共享当前 Promise；切换 URL 或卸载时，旧请求以 `AbortError` 结束。激活预取任务后，当前调用能收到 HTTP 或读取错误；失败资源移出缓存，后续调用可以重试。
- 卸载时清除预取定时器，避免销毁后的异步收尾再次启动缓存。
- 纹理上传后检查 GL 错误，失败的新纹理被释放，旧纹理及已应用参数保持不变；正常图片可继续提交。上传前已有的共享上下文错误单独记录，避免误归因。

最终专项回归 9 项通过，包含 10 种续传场景、同 URL 并发、A→B→A 切换、预取失败、非法响应、真实损坏 PNG 和 GL 错误回滚。续传成功输出均与原图逐字节一致；损坏 PNG 上传失败后实际像素保持 `[0, 0, 255, 255]`，旧纹理和范围未被替换；正常图片重试成功。

两个业务页面的 4 项地图回归通过，生产构建通过。类型检查仍报告原先三处 `vue-component-type-helpers` 缺失，与此次修复无关。
