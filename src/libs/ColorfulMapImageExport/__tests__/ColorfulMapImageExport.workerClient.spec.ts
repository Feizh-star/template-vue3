import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportColorfulMapImageInWorker } from '../ColorfulMapImageExport.workerClient'
import type {
  ColorfulMapWorkerResponse,
  IColorfulMapWorkerExportOptions,
} from '../ColorfulMapImageExport.types'

const options: IColorfulMapWorkerExportOptions = {
  image: '/data.png',
  lonmin: 0,
  lonmax: 10,
  latmin: 0,
  latmax: 10,
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
  terminated = false

  constructor(_url: URL, readonly workerOptions: WorkerOptions) {
    MockWorker.instance = this
  }

  postMessage(postedOptions: unknown): void {
    this.postedOptions = postedOptions
    queueMicrotask(() => this.onmessage?.({ data: MockWorker.response } as MessageEvent))
  }

  terminate(): void {
    this.terminated = true
  }
}

describe('ColorfulMapImage worker client', () => {
  beforeEach(() => vi.stubGlobal('Worker', MockWorker))
  afterEach(() => vi.unstubAllGlobals())

  it('posts export options and resolves the returned Blob', async () => {
    const blob = new Blob(['image'], { type: 'image/png' })
    MockWorker.response = { ok: true, blob }

    await expect(exportColorfulMapImageInWorker(options)).resolves.toBe(blob)
    expect(MockWorker.instance.postedOptions).toBe(options)
    expect(MockWorker.instance.workerOptions).toEqual({ type: 'module' })
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
