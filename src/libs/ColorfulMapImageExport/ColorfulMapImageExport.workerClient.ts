import type {
  ColorfulMapWorkerResponse,
  IColorfulMapWorkerExportOptions,
} from './ColorfulMapImageExport.types'

export function exportColorfulMapImageInWorker(
  options: IColorfulMapWorkerExportOptions
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./ColorfulMapImageExport.worker.ts', import.meta.url), {
      type: 'module',
    })
    const finish = (response: ColorfulMapWorkerResponse) => {
      worker.terminate()
      if (response.ok) {
        resolve(response.blob)
      } else {
        const error = new Error(response.error.message)
        error.name = response.error.name
        reject(error)
      }
    }
    worker.onmessage = (event: MessageEvent<ColorfulMapWorkerResponse>) => finish(event.data)
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || 'Colorful map worker failed.'))
    }
    worker.onmessageerror = () => {
      worker.terminate()
      reject(new Error('Failed to read colorful map worker response.'))
    }
    const transfers = new Set<Transferable>()
    if (typeof ImageBitmap !== 'undefined' && options.image instanceof ImageBitmap) {
      transfers.add(options.image)
    }
    if (typeof ImageBitmap !== 'undefined' && options.cut?.image instanceof ImageBitmap) {
      transfers.add(options.cut.image)
    }
    try {
      worker.postMessage(options, [...transfers])
    } catch (error) {
      worker.terminate()
      reject(error)
    }
  })
}
