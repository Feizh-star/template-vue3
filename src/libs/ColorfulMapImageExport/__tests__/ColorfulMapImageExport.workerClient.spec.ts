import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportColorfulMapImageInWorker } from '../ColorfulMapImageExport.workerClient'
import type {
  ColorfulMapWorkerResponse,
  IColorfulMapWorkerExportOptions,
} from '../ColorfulMapImageExport.types'

const options: IColorfulMapWorkerExportOptions = {
  imageData: { image: '/data.png', lonmin: 0, lonmax: 10, latmin: 0, latmax: 10 },
  scale: { r: 1, g: 1, b: 1, a: 1 },
  colors: { r: [0], g: [0], b: [0], v: [0], o: [1] },
}

class MockWorker {
  static instance: MockWorker
  static response: ColorfulMapWorkerResponse
  onmessage: ((event: MessageEvent<ColorfulMapWorkerResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: (() => void) | null = null
  postedOptions: unknown
  transfers: Transferable[] = []
  terminated = false

  constructor(_url: URL, readonly workerOptions: WorkerOptions) {
    MockWorker.instance = this
  }

  postMessage(postedOptions: unknown, transfers: Transferable[]): void {
    this.postedOptions = postedOptions
    this.transfers = transfers
    queueMicrotask(() => this.onmessage?.({ data: MockWorker.response } as MessageEvent))
  }

  terminate(): void {
    this.terminated = true
  }
}

describe('ColorfulMapImage worker client', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts export options and resolves the returned Blob', async () => {
    const blob = new Blob(['image'], { type: 'image/png' })
    MockWorker.response = { ok: true, blob }

    await expect(exportColorfulMapImageInWorker(options)).resolves.toBe(blob)
    expect(MockWorker.instance.postedOptions).toBe(options)
    expect(MockWorker.instance.workerOptions).toEqual({ type: 'module' })
    expect(MockWorker.instance.terminated).toBe(true)
  })

  it('posts title styles, spacing and padding with the export options', async () => {
    const titleOptions: IColorfulMapWorkerExportOptions = {
      ...options,
      title: {
        main: { text: 'Main title', font: 'bold 24px Arial', color: '#123456' },
        sub: { text: 'Subtitle', font: '16px Arial', color: '#654321' },
        gap: 6,
        padding: [8, 16, 12, 16],
      },
    }
    MockWorker.response = { ok: true, blob: new Blob() }
    await exportColorfulMapImageInWorker(titleOptions)
    expect(MockWorker.instance.postedOptions).toBe(titleOptions)
    expect(structuredClone(titleOptions)).toEqual(titleOptions)
    expect(MockWorker.instance.transfers).toEqual([])
  })

  it('posts multiple texture extents without transferring URL sources', async () => {
    const multiOptions: IColorfulMapWorkerExportOptions = {
      ...options,
      imageData: [
        { image: '/west.png', lonmin: 0, lonmax: 5, latmin: 0, latmax: 10 },
        { image: '/east.png', lonmin: 5, lonmax: 10, latmin: 0, latmax: 10 },
      ],
      outputBounds: { lonmin: 0, lonmax: 10, latmin: 0, latmax: 10 },
    }
    MockWorker.response = { ok: true, blob: new Blob() }

    await exportColorfulMapImageInWorker(multiOptions)
    expect(MockWorker.instance.postedOptions).toBe(multiOptions)
    expect(MockWorker.instance.transfers).toEqual([])
  })

  it.each([false, true])('transfers each bitmap once for array input: %s', async (multiple) => {
    class TestImageBitmap {}
    vi.stubGlobal('ImageBitmap', TestImageBitmap)
    const image = new TestImageBitmap() as ImageBitmap
    const cutImage = new TestImageBitmap() as ImageBitmap
    const texture = { image, lonmin: 0, lonmax: 10, latmin: 0, latmax: 10 }
    const bitmapOptions: IColorfulMapWorkerExportOptions = {
      ...options,
      imageData: multiple ? [texture, texture, { ...texture, image: cutImage }] : texture,
      outputBounds: texture,
      cut: { ...texture, image: multiple ? cutImage : image },
    }
    MockWorker.response = { ok: true, blob: new Blob() }

    await exportColorfulMapImageInWorker(bitmapOptions)
    expect(MockWorker.instance.transfers).toEqual(multiple ? [image, cutImage] : [image])
    expect(MockWorker.instance.terminated).toBe(true)
  })

  it('propagates Worker errors and terminates the Worker', async () => {
    MockWorker.response = { ok: false, error: { name: 'TypeError', message: 'Invalid texture' } }

    await expect(exportColorfulMapImageInWorker(options)).rejects.toMatchObject({
      name: 'TypeError',
      message: 'Invalid texture',
    })
    expect(MockWorker.instance.terminated).toBe(true)
  })
})
