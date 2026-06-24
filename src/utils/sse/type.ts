export interface SSEEvent<T = any> {
  event: string
  data: T
  id?: string
}
