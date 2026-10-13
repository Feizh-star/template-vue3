import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref } from 'vue'
import { ResumableImageLoader } from '../useStainImageCache/ResumableImageLoader'
import { useStainImageCache } from '../useStainImageCache/useStainImageCache'

const fetchMock = vi.fn()
const createUrl = vi.fn()
const revokeUrl = vi.fn()
const unmounts: (() => void)[] = []
const loaders: ResumableImageLoader[] = []
function response(status = 200, headers: Record<string, string> = {}, chunks = [[1, 2, 3, 4]]) {
  let index = 0
  return {
    status,
    headers: new Headers(headers),
    body: {
      cancel: vi.fn(),
      getReader: () => ({
        read: async () =>
          index < chunks.length
            ? { done: false, value: new Uint8Array(chunks[index++]) }
            : { done: true },
      }),
    },
  }
}
async function settle() {
  for (let i = 0; i < 30; i++) await Promise.resolve()
}
function loader() {
  const value = new ResumableImageLoader('/image.png')
  loaders.push(value)
  return value
}
beforeEach(() => {
  vi.useFakeTimers()
  fetchMock.mockReset()
  createUrl.mockReset().mockImplementation((_blob: Blob) => `blob:${createUrl.mock.calls.length}`)
  revokeUrl.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createUrl
      static revokeObjectURL = revokeUrl
    }
  )
})
afterEach(() => {
  unmounts.splice(0).forEach((unmount) => unmount())
  loaders.splice(0).forEach((value) => value.revoke())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('resumable image bytes', () => {
  it('resumes with a verified range and ignores an old read after pause', async () => {
    let lateRead!: (value: { done: boolean; value: Uint8Array }) => void
    let readCount = 0
    const first = response(200, { 'Content-Length': '4', ETag: '"v1"' })
    first.body.getReader = () =>
      ({
        read: () =>
          ++readCount === 1
            ? Promise.resolve({ done: false, value: new Uint8Array([1, 2]) })
            : new Promise((resolve) => {
                lateRead = resolve
              }),
      } as ReturnType<typeof first.body.getReader>)
    fetchMock
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(
        response(206, { 'Content-Length': '2', 'Content-Range': 'bytes 2-3/4', ETag: '"v1"' }, [
          [3, 4],
        ])
      )
    const image = loader()
    image.start()
    await settle()
    image.pause()
    image.start()
    lateRead({ done: false, value: new Uint8Array([99, 99]) })
    await settle()
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ Range: 'bytes=2-', 'If-Range': '"v1"' })
    expect(createUrl.mock.calls[0][0].size).toBe(4)
    expect(image.isComplete).toBe(true)
  })

  it('replaces partial bytes when the server returns a full response', async () => {
    let readCount = 0
    const first = response(200, { 'Content-Length': '4', ETag: '"v1"' })
    first.body.getReader = () =>
      ({
        read: () =>
          ++readCount === 1
            ? Promise.resolve({ done: false, value: new Uint8Array([1, 2]) })
            : new Promise(() => {}),
      } as ReturnType<typeof first.body.getReader>)
    fetchMock
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(response(200, { 'Content-Length': '4' }))
    const image = loader()
    image.start()
    await settle()
    image.pause()
    image.start()
    await settle()
    expect(createUrl.mock.calls[0][0].size).toBe(4)
  })

  it.each([
    [404, {}, [[1, 2, 3, 4]]],
    [200, { 'Content-Length': '8' }, [[1, 2, 3, 4]]],
  ])('never caches failed or truncated responses (%s)', async (status, headers, chunks) => {
    fetchMock.mockResolvedValueOnce(
      response(status as number, headers as Record<string, string>, chunks as number[][])
    )
    const image = loader()
    const error = vi.fn()
    image.onError = error
    image.start()
    await settle()
    expect(error).toHaveBeenCalledOnce()
    expect(createUrl).not.toHaveBeenCalled()
    expect(image.isComplete).toBe(false)
  })
})

it('cancels stale selections, prefetches after the delay, reuses completed images and cleans up', async () => {
  fetchMock.mockImplementation((url: string) =>
    url === '/A.png' ? new Promise(() => {}) : Promise.resolve(response())
  )
  let cache!: ReturnType<typeof useStainImageCache>
  const app = createApp(
    defineComponent({
      setup() {
        cache = useStainImageCache(ref(['B', 'C', 'D']), (time) => `/${time}.png`, {
          cacheDelay: 800,
        })
        return () => h('div')
      },
    })
  )
  app.mount(document.createElement('div'))
  unmounts.push(() => app.unmount())
  const oldRequest = cache.getCurrentUrlWithCache('A').catch((error) => error)
  const b = await cache.getCurrentUrlWithCache('B')
  expect((await oldRequest).name).toBe('AbortError')
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
  vi.advanceTimersByTime(799)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  vi.advanceTimersByTime(1)
  await settle()
  expect(fetchMock).toHaveBeenCalledTimes(4)
  expect(revokeUrl).not.toHaveBeenCalledWith(b)
  const calls = fetchMock.mock.calls.length
  await cache.getCurrentUrlWithCache('C')
  expect(fetchMock).toHaveBeenCalledTimes(calls)
  unmounts.pop()!()
  expect(revokeUrl).toHaveBeenCalledTimes(3)
  await expect(cache.getCurrentUrlWithCache('D')).rejects.toMatchObject({ name: 'AbortError' })
})
