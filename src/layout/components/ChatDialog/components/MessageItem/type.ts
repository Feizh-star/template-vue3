export interface IMessageItem {
  sessionId?: string
  id: string
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
  status?: 'pending' | 'success' | 'error'
  thinking?: boolean
  createdAt?: number
}
