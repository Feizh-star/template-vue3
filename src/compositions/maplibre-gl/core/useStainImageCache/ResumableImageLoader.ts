interface IResumableOptions {
  complementWait?: number
  onProgress?: (r: number, t: number) => void
  onLoad?: (src: string, url: string) => void
  onPause?: (r: number, t: number) => void
  onError?: (error: Error) => void
}

class ResumableImageLoader {
  private innerUrl: string
  set url(s: string) {
    this.clearObjectURL()
    this.clear()
    this.innerUrl = s
    this.start()
  }
  private oUrl: string | null = null
  // 在onLoad之后，revoke之前，都可以利用src，从内存中获取数据
  get src() {
    return this.oUrl || ''
  }
  // 在onLoad之后，revoke之前，返回true
  get isComplete() {
    return !!this.oUrl
  }
  private complementWait = 0 // 对于被打断而丢失的缓存，是否过一段时间后去补充（补充请求不可暂停），0表示不补充，刷新后再次加载需要临时加载缺失部分
  private controller: AbortController | null = null
  private receivedBytes: number = 0
  private totalBytes: number = 0
  private chunks: Uint8Array[] = []
  private etag: string | null = null
  private complementTimer: ReturnType<typeof setTimeout> | null = null

  private onProgressCb: IResumableOptions['onProgress'] | null = null
  private onLoadCb: IResumableOptions['onLoad'] | null = null
  private onPauseCb: IResumableOptions['onPause'] | null = null
  private onErrorCb: IResumableOptions['onError'] | null = null
  set onProgress(cb: IResumableOptions['onProgress'] | null) {
    this.onProgressCb = cb
  }
  set onLoad(cb: IResumableOptions['onLoad'] | null) {
    this.onLoadCb = cb
  }
  set onPause(cb: IResumableOptions['onPause'] | null) {
    this.onPauseCb = cb
  }
  set onError(cb: IResumableOptions['onError'] | null) {
    this.onErrorCb = cb
  }

  constructor(url: string, options: IResumableOptions = {}) {
    this.innerUrl = url
    this.complementWait = options.complementWait || 0
    this.onProgressCb = options.onProgress || null
    this.onLoadCb = options.onLoad || null
    this.onPauseCb = options.onPause || null
    this.onErrorCb = options.onError || null
  }

  private async run() {
    if (this.controller || this.isComplete) return
    const url = this.innerUrl
    const controller = new AbortController()
    this.controller = controller
    const isCurrent = () => this.controller === controller && !controller.signal.aborted
    let retriedFull = false
    let isPart = false
    try {
      while (isCurrent()) {
        if (this.totalBytes && this.receivedBytes === this.totalBytes) break
        // Byte offsets and resource identity must both be verifiable before resuming.
        if (this.receivedBytes && !this.etag) {
          if (retriedFull) throw new Error(`Unable to verify resumed resource: ${url}`)
          this.clearData()
          retriedFull = true
        }
        const offset = this.receivedBytes
        const headers: Record<string, string> = offset
          ? { Range: `bytes=${offset}-`, 'If-Range': this.etag! }
          : {}
        let resp: Response
        try {
          resp = await fetch(url, { headers, signal: controller.signal })
        } catch (error) {
          if (!isCurrent()) return
          if (!offset || retriedFull) throw error
          this.clearData()
          retriedFull = true
          continue
        }
        if (!isCurrent()) return
        if (resp.status === 416 && offset && !retriedFull) {
          await resp.body?.cancel()
          if (!isCurrent()) return
          this.clearData()
          retriedFull = true
          continue
        }
        if (resp.status !== 200 && resp.status !== 206) {
          throw new Error(`HTTP ${resp.status}: ${url}`)
        }
        const encoding = resp.headers.get('Content-Encoding')
        const encoded = !!encoding && encoding !== 'identity'
        const tag = resp.headers.get('ETag')
        const etag = tag && /^"[^"]*"$/.test(tag) ? tag : null
        const lengthHeader = resp.headers.get('Content-Length')
        const length = Number(lengthHeader || 0)
        let end: number
        if (resp.status === 206) {
          const range = resp.headers.get('Content-Range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/)
          const [start, last, total] = range ? range.slice(1).map(Number) : [-1, -1, -1]
          const valid =
            [start, last, total].every(Number.isSafeInteger) &&
            start === offset &&
            last >= start &&
            last < total &&
            (!this.totalBytes || total === this.totalBytes) &&
            (!offset || etag === this.etag) &&
            !encoded &&
            (lengthHeader === null || length === last - start + 1)
          if (!valid) {
            await resp.body?.cancel()
            if (!isCurrent()) return
            if (retriedFull) throw new Error(`Invalid Content-Range: ${url}`)
            this.clearData()
            retriedFull = true
            continue
          }
          this.totalBytes = total
          end = last + 1
          isPart = true
        } else {
          this.clearData()
          if (!Number.isSafeInteger(length) || length < 0) {
            throw new Error(`Invalid Content-Length: ${url}`)
          }
          // fetch exposes decoded bytes, whereas Content-Length describes encoded bytes.
          this.totalBytes = encoded ? 0 : length
          end = this.totalBytes
        }
        this.etag = encoded ? null : etag
        const reader = resp.body?.getReader()
        if (!reader) throw new Error(`Missing response body: ${url}`)
        while (isCurrent()) {
          const { done, value } = await reader.read()
          if (!isCurrent()) return
          if (done) break
          if (end && this.receivedBytes + value.length > end) {
            throw new Error(`Response exceeds expected length: ${url}`)
          }
          this.receivedBytes += value.length
          this.chunks.push(value)
          this.onProgressCb?.call(null, this.receivedBytes, this.totalBytes)
        }
        if (!isCurrent()) return
        if (!this.receivedBytes || (end && this.receivedBytes !== end)) {
          throw new Error(`Incomplete image response: ${url}`)
        }
        if (this.totalBytes && this.receivedBytes < this.totalBytes) continue
        break
      }
      if (!isCurrent()) return
      const blob = new Blob(this.chunks, { type: 'image/png' })
      this.oUrl = URL.createObjectURL(blob)
      this.controller = null
      this.clearData()
      if (isPart && this.complementWait) {
        this.complementTimer = setTimeout(() => {
          void fetch(url).catch(() => {})
        }, this.complementWait)
      }
      this.onLoadCb?.(this.oUrl, url)
    } catch (err) {
      if (!isCurrent()) return
      this.clear()
      this.onErrorCb?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  private clearData() {
    this.chunks = []
    this.receivedBytes = 0
    this.totalBytes = 0
    this.etag = null
  }
  // 只是清除有关请求过程的状态，不清除 this.oUrl = null，保证请求结束后依然可以通过src获取到已缓存（在内存中）的src
  private clear() {
    const controller = this.controller
    this.controller = null
    controller?.abort()
    this.clearData()
    if (this.complementTimer) clearTimeout(this.complementTimer)
    this.complementTimer = null
  }
  private removeAllEvent() {
    this.onProgressCb = null
    this.onLoadCb = null
    this.onPauseCb = null
    this.onErrorCb = null
  }
  // 需要释放内存时才清理this.oUrl
  private clearObjectURL() {
    this.oUrl && URL.revokeObjectURL(this.oUrl)
    this.oUrl = null
  }

  // 开始
  start() {
    void this.run().catch((error) => console.error(error))
  }
  // 暂停
  pause() {
    const controller = this.controller
    if (!controller) return
    this.controller = null
    controller.abort()
    this.onPauseCb?.(this.receivedBytes, this.totalBytes)
  }
  // 彻底释放资源
  revoke() {
    this.clearObjectURL()
    this.clear()
    this.removeAllEvent()
  }
}

export { ResumableImageLoader }
