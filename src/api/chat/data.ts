import request from '@/utils/request'
import type { IMessageItem } from '@/layout/components/ChatDialog/components/MessageItem/type'
const ASSISTANT_API_URL = '/assistant'

export interface ISessionDetail {
  id: string
  title: string
  messages: IMessageItem[]
  previous: number | null
  previousExist: boolean
  createdAt: number
  updatedAt: number
}
// 获取会话详情，消息列表和分页信息
export function getSessionById(params: {
  sessionId: string
  limit: number
  before?: number
}): Promise<ISessionDetail> {
  return request({
    baseURL: ASSISTANT_API_URL,
    url: `/sessions/${params.sessionId}`,
    headers: {
      needToken: false,
    },
    method: 'get',
    params: {
      limit: params.limit,
      before: params.before,
    },
  })
}

export interface ISessionInfo {
  id: string
  title: string | null
  messageCount: number
  createdAt: number
  updatedAt: number
}
// 获取历史会话列表
export function getSessionList(): Promise<ISessionInfo[]> {
  return request({
    baseURL: ASSISTANT_API_URL,
    url: `/sessions`,
    headers: {
      needToken: false,
    },
    method: 'get',
  })
}

// 首次创建会话
export function createSession(data: { prompt: string }): Promise<ISessionInfo> {
  return request({
    baseURL: ASSISTANT_API_URL,
    url: `/sessions`,
    headers: {
      needToken: false,
    },
    method: 'post',
    data,
  })
}
