import type { InternalAxiosRequestConfig } from 'axios'
import qs from 'qs'
const pendingRequest = new Map()

function generateReqKey(config: InternalAxiosRequestConfig<any>) {
  const { method, url, params, data } = config
  return [method, url, qs.stringify(params), qs.stringify(data)].join('&')
}

export function addPendingRequest(config: InternalAxiosRequestConfig<any>) {
  const customSignal = config.signal
  const requestKey = generateReqKey(config)
  const controller = new AbortController()
  config.signal = config.signal || controller.signal
  if (!pendingRequest.has(requestKey) && !customSignal) {
    pendingRequest.set(requestKey, controller)
  }
}

export function removePendingRequest(config: InternalAxiosRequestConfig<any>) {
  const requestKey = generateReqKey(config)
  if (!pendingRequest.has(requestKey)) return
  const controller = pendingRequest.get(requestKey)
  controller.abort()
  pendingRequest.delete(requestKey)
}
