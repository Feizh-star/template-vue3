export interface IMessageItem {
  id?: string
  role: 'user' | 'assistant'
  loading?: boolean
  status?: 'pending' | 'success' | 'error'
  content?: string
  thinking?: boolean
  createdAt?: number
}
