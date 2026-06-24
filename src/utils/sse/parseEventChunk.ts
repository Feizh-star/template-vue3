import type { SSEEvent } from './type'

export function parseEventChunk<T = any>(chunk: string): SSEEvent<T> | null {
  const lines = chunk.split('\n')

  let event = 'message'

  let id = ''

  const dataLines: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    // 忽略注释
    if (line.startsWith(':')) {
      continue
    }

    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
      continue
    }

    if (line.startsWith('id:')) {
      id = line.slice(3).trim()
      continue
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
      continue
    }
  }

  // 没有data
  if (!dataLines.length) {
    return null
  }

  const dataText = dataLines.join('\n')

  let data: T

  // 自动尝试JSON解析
  try {
    data = JSON.parse(dataText)
  } catch {
    data = dataText as T
  }

  return {
    event,
    data,
    id: id || undefined,
  }
}
