import { parseEventChunk } from './parseEventChunk'

export interface SSEEvent<T = any> {
  event: string
  data: T
  id?: string
}

/**
 * 解析 fetch Response 的 SSE 数据流
 */
export async function* parseSSE<T = any>(response: Response): AsyncGenerator<SSEEvent<T>> {
  if (!response.body) {
    throw new Error('Response body is empty')
  }

  const reader = response.body.getReader()

  const decoder = new TextDecoder()

  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    // 追加chunk
    buffer += decoder.decode(value, {
      stream: true,
    })

    // 按 event 分割
    const chunks = buffer.split('\n\n')

    // 最后一块可能不完整
    buffer = chunks.pop() || ''

    for (const chunk of chunks) {
      const event = parseEventChunk<T>(chunk)

      if (event) {
        yield event
      }
    }
  }

  // 处理最后残留buffer
  if (buffer.trim()) {
    const event = parseEventChunk<T>(buffer)

    if (event) {
      yield event
    }
  }
}
