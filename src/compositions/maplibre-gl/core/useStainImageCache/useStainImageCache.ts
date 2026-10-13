import type { Ref } from 'vue'
import { ref, onBeforeUnmount } from 'vue'
import { ResumableImageLoader } from './ResumableImageLoader'

export function useStainImageCache<T>(
  timelineList: Ref<string[]>,
  // eslint-disable-next-line no-shadow
  getUrl: (time: string, getUrlProperties: T) => string,
  getUrlProperties: T & { cacheDelay?: number }
) {
  const imageCacheMap = new Map<string, ResumableImageLoader>()
  let currentRequest: { url: string; promise: Promise<string>; cancel: () => void } | null = null
  let timeId: ReturnType<typeof setTimeout> | null = null
  let disposed = false
  onBeforeUnmount(() => {
    disposed = true
    if (timeId) clearTimeout(timeId)
    clearLoaders()
  })

  const clearLoaders = () => {
    currentRequest?.cancel()
    currentRequest = null
    for (const loader of imageCacheMap.values()) loader.revoke()
    imageCacheMap.clear()
  }
  // 暂停所有正在缓存的任务
  const pauseLoaders = () => {
    currentRequest?.cancel()
    currentRequest = null
    for (const loader of imageCacheMap.values()) {
      loader.pause() // 对于已经缓存完成的什么也没做
      loader.onLoad = null
    }
  }
  // 开始所有缓存任务
  const startLoaders = () => {
    for (const loader of imageCacheMap.values()) {
      if (loader.isComplete) continue // 已经缓存完成
      loader.start()
    }
  }

  // 当前时刻图片加载完毕后，开始缓存
  function startCache() {
    const cachedImageUrls = [...imageCacheMap.keys()]
    const newTimelineListUrls = timelineList.value.map((time) => getUrl(time, getUrlProperties))
    const removeCacheUrls = differenceSet(cachedImageUrls, newTimelineListUrls)
    const needCacheUrls = differenceSet(newTimelineListUrls, cachedImageUrls)
    for (const rUrl of removeCacheUrls) {
      imageCacheMap.get(rUrl)?.revoke()
      imageCacheMap.delete(rUrl)
    }
    for (const nUrl of needCacheUrls) {
      const cacheImageLoader = new ResumableImageLoader(nUrl)
      cacheImageLoader.onError = () => {
        imageCacheMap.delete(nUrl)
      }
      imageCacheMap.set(nUrl, cacheImageLoader)
    }
    startLoaders()
  }

  function handleImageCache(currentUrl: string): Promise<string> {
    if (disposed) return Promise.reject(new DOMException('Cache disposed', 'AbortError'))
    if (currentRequest?.url === currentUrl) return currentRequest.promise
    pauseLoaders()
    const cacheImageLoader = imageCacheMap.get(currentUrl)
    if (cacheImageLoader?.isComplete) return Promise.resolve(cacheImageLoader.src)
    const imageLoader = cacheImageLoader ?? new ResumableImageLoader(currentUrl)
    let cancel!: () => void
    const promise = new Promise<string>((resolve, reject) => {
      cancel = () => reject(new DOMException('Image request superseded', 'AbortError'))
      imageLoader.onLoad = resolve
      imageLoader.onError = (error) => {
        imageCacheMap.delete(currentUrl)
        reject(error)
      }
    })
    const request = { url: currentUrl, promise, cancel }
    request.promise = promise.finally(() => {
      if (currentRequest === request) currentRequest = null
    })
    currentRequest = request
    imageCacheMap.set(currentUrl, imageLoader)
    imageLoader.start()
    return request.promise
  }

  const loading = ref(false)
  function getCurrentUrlWithCache(currentTime: string) {
    if (timeId) clearTimeout(timeId)
    timeId = null
    loading.value = true
    return handleImageCache(getUrl(currentTime, getUrlProperties)).finally(() => {
      loading.value = !!currentRequest
      if (!disposed && !loading.value) {
        if (timeId) clearTimeout(timeId)
        timeId = setTimeout(() => startCache(), getUrlProperties.cacheDelay ?? 0)
      }
    })
  }
  return {
    loading,
    getCurrentUrlWithCache,
  }
}

/**
 * 计算两个集合的差集
 * @param a [1, 2, 3]
 * @param b [2]
 * @returns [1, 3]
 */
function differenceSet(a: any[], b: any[]) {
  const bs = new Set([...b])
  return [...new Set([...a].filter((x) => !bs.has(x)))]
}
