// 这种方式已被取代但是兼容性更好
import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import qs from 'qs'
const pendingRequest = new Map()

function generateReqKey(config: InternalAxiosRequestConfig<any>) {
  const { method, url, params, data } = config
  return [method, url, qs.stringify(params), qs.stringify(data)].join('&')
}

export function addPendingRequest(config: InternalAxiosRequestConfig<any>) {
  const requestKey = generateReqKey(config)
  config.cancelToken =
    config.cancelToken ||
    new axios.CancelToken((cancel) => {
      if (!pendingRequest.has(requestKey)) {
        pendingRequest.set(requestKey, cancel)
      }
    })
}

export function removePendingRequest(config: InternalAxiosRequestConfig<any>) {
  const requestKey = generateReqKey(config)
  if (pendingRequest.has(requestKey)) {
    const cancel = pendingRequest.get(requestKey)
    cancel(requestKey)
    pendingRequest.delete(requestKey)
  }
}
