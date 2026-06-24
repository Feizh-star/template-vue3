import type { IMessageItem } from '@/layout/components/ChatDialog/components/MessageItem/type'

// 获取会话详情，消息列表
export function getSessionById(sessionId: string): Promise<ISessionItem> {
  return fetch(`/assistant/sessions/${sessionId}`).then((res) => res.json())
}

export interface ISessionItem {
  id: string
  title: string
  messages: IMessageItem[]
  createdAt: number
  updatedAt: number
}

// 获取某个场景的历史会话
export function getSessionListBySceneId(sceneId: string): Promise<ISessionItem[]> {
  console.log(sceneId)
  return fetch(`/assistant/sessions`).then((res) => res.json())
}
