import type { Ref } from 'vue'
import { getSessionList, type ISessionInfo } from '@/api/chat/data'

export interface IUseChatListProps {}

export function useChatList() {
  const chatList = ref<ISessionInfo[]>([])

  const getChatList = async () => {
    try {
      const list = await getSessionList()
      chatList.value = list
    } catch (error) {
      console.error(error)
    }
  }

  return {
    chatList,
    getChatList,
  }
}
