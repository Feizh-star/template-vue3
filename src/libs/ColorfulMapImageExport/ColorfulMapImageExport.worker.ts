import { exportColorfulMapImage } from './ColorfulMapImageExport'
import type {
  ColorfulMapWorkerResponse,
  IColorfulMapWorkerExportOptions,
} from './ColorfulMapImageExport.types'

self.addEventListener('message', async (event: MessageEvent<IColorfulMapWorkerExportOptions>) => {
  try {
    if (typeof (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas !== 'function') {
      throw new Error('OffscreenCanvas is unavailable in this worker.')
    }
    const blob = await exportColorfulMapImage({
      ...event.data,
      preferOffscreenCanvas: true,
    })
    const response: ColorfulMapWorkerResponse = { ok: true, blob }
    self.postMessage(response)
  } catch (error) {
    const response: ColorfulMapWorkerResponse = {
      ok: false,
      error: {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
      },
    }
    self.postMessage(response)
  }
})
