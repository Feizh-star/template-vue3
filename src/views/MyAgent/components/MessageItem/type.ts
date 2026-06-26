export interface IMessageItem {
  sessionId?: string
  id?: string
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
  status?: 'pending' | 'success' | 'error'
  createdAt?: number
  hint?: string
  hintType?: 'thinking' | 'tool_call' | 'none'
}
