import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref, shallowRef } from 'vue'
import type { Map } from 'maplibre-gl'
import {
  useStainImg,
  defaultOption,
  imgColor,
  imgScale,
} from '@/views/MapLibre/subpage/ColorfulMapTest/compositions/useStainImg'
import { useGlStainImg } from '../useGlStainImg'

const mocks = {
  getImage: vi.fn(),
  cache: vi.fn(),
  construct: vi.fn(),
  addTo: vi.fn(),
  setOption: vi.fn(),
  destroy: vi.fn(),
}
vi.mock('../useStainImageCache/useStainImageCache', () => ({
  useStainImageCache: (...args: unknown[]) => {
    mocks.cache(...args)
    return { getCurrentUrlWithCache: mocks.getImage, loading: ref(false) }
  },
}))
vi.mock('@/libs/ColorfulMapImage', () => ({
  ColorfulMapImage: class {
    constructor(options: unknown) {
      mocks.construct(options)
    }
    addTo = mocks.addTo
    setOption = mocks.setOption
    destroy = mocks.destroy
  },
}))

const options = {
  latmin: 17,
  latmax: 55,
  lonmin: 72,
  lonmax: 136,
  scale: { r: 1, g: 1, b: 1, a: 1 },
  colors: { r: [0, 255], g: [0, 255], b: [0, 255], v: [0, 750], o: [0.8, 0.8] },
}
const unmounts: (() => void)[] = []
function mount<T>(setup: () => T): T {
  let result!: T
  const app = createApp(
    defineComponent({
      setup() {
        result = setup()
        return () => h('div')
      },
    })
  )
  app.mount(document.createElement('div'))
  unmounts.push(() => app.unmount())
  return result
}
async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}
function mountStain(mapIns = shallowRef<Map | null>({} as Map), time = 'A') {
  const stain = mount(() => useStainImg({ mapIns }))
  stain.selectedTime.value = time
  stain.tlChange(
    time,
    ['A', 'B', 'C'].map((date) => ({ date }))
  )
  return stain
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => {
  unmounts.splice(0).forEach((unmount) => unmount())
  vi.useRealTimers()
})

describe('stain scheduling', () => {
  it('ignores a previous result as soon as selection changes, even during debounce', async () => {
    let resolveA!: (url: string) => void
    mocks.getImage
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveA = resolve
          })
      )
      .mockResolvedValueOnce('blob:B')
    const { selectedTime } = mountStain()
    vi.advanceTimersByTime(60)
    selectedTime.value = 'B'
    resolveA('blob:A')
    await settle()
    expect(mocks.construct).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60)
    await settle()
    expect(mocks.construct).toHaveBeenCalledWith(
      expect.objectContaining({
        ...defaultOption,
        img: 'blob:B',
        colors: imgColor,
        scale: imgScale,
        getGrid: true,
      })
    )
  })

  it('wraps the three-time cache window and invalidates pending work on unmount', async () => {
    let resolve!: (url: string) => void
    mocks.getImage.mockImplementation(
      () =>
        new Promise<string>((done) => {
          resolve = done
        })
    )
    mountStain(shallowRef({} as Map), 'C')
    expect(mocks.cache.mock.calls[0][0].value).toEqual(['C', 'A', 'B'])
    vi.advanceTimersByTime(60)
    unmounts.pop()!()
    resolve('blob:C')
    await settle()
    expect(mocks.construct).not.toHaveBeenCalled()
  })

  it('waits for the map and removes the layer on a current request failure', async () => {
    const mapIns = shallowRef<Map | null>(null)
    mocks.getImage.mockResolvedValueOnce('blob:A').mockRejectedValueOnce(new Error('404'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { selectedTime } = mountStain(mapIns)
    vi.advanceTimersByTime(60)
    expect(mocks.getImage).not.toHaveBeenCalled()
    mapIns.value = {} as Map
    vi.advanceTimersByTime(60)
    await settle()
    selectedTime.value = 'B'
    vi.advanceTimersByTime(60)
    await settle()
    expect(mocks.destroy).toHaveBeenCalledOnce()
    error.mockRestore()
  })
})

it('updates only the changed image and destroys the managed layer on unmount', () => {
  const layer = mount(() => useGlStainImg({ mapIns: shallowRef({} as Map) }))
  layer.drawGlStainImg({ ...options, img: 'blob:A' })
  layer.drawGlStainImg({ ...options, img: 'blob:B' })
  layer.drawGlStainImg({ ...options, img: 'blob:B' })
  expect(mocks.setOption).toHaveBeenCalledOnce()
  expect(mocks.setOption).toHaveBeenCalledWith({ img: 'blob:B' })
  unmounts.pop()!()
  expect(mocks.destroy).toHaveBeenCalledOnce()
})
