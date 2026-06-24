import type { Ref } from 'vue'
import { getSessionListBySceneId, type ISessionItem } from '@/api/chat/data'

export interface IUseChatListProps {
  robotSence: Ref<string>
}

export function useChatList({ robotSence }: IUseChatListProps) {
  const chatList = ref<ISessionItem[]>([])
  const imgRef = ref<HTMLDivElement>()

  const getChatList = async () => {
    try {
      const list = await getSessionListBySceneId(robotSence.value)
      chatList.value = list
    } catch (error) {
      console.error(error)
    }
  }

  watch(
    robotSence,
    () => {
      getChatList()
    },
    { immediate: true }
  )
  return {
    chatList,
    imgRef,
  }
}
