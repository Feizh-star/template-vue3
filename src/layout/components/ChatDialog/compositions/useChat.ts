import { computed } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import { ElMessage, type PopoverInstance } from 'element-plus'
import type { IMessageItem } from '../components/MessageItem/type'
import type MessageList from './components/MessageList/MessageList.vue'
import sendDisabledIcon from '../assets/send-disabled.svg'
import sendIcon from '../assets/send.svg'
import sendPauseIcon from '../assets/send-pause.svg'
import { parseSSE } from '@/utils/sse/parseSSE'
import { LatestRequestManager } from '@/utils/request'
import { getSessionById, type ISessionItem } from '@/api/chat/data'

export interface IUseChatProps {
  robotSence: Ref<string>
}

interface IUseChatReturn {
  isStart: Ref<boolean>
  isChating: Ref<boolean>
  inputText: Ref<string>
  sendIconUrl: Ref<string>
  messageItems: Ref<IMessageItem[]>
  messageListRef: ShallowRef<InstanceType<typeof MessageList>>
  popoverRef: ShallowRef<PopoverInstance>
  insertQuestion: (text: string) => void
  sendMessage: () => Promise<void>
  sendMessageWithEnter: () => void
  selectSession: (item: ISessionItem) => Promise<void>
  sessionClicked: (item: ISessionItem) => void
  cancelCurrentRequest: () => void
}

export function useChat({ robotSence }: IUseChatProps): IUseChatReturn {
  const latestFetch = new LatestRequestManager()
  const isStart = ref(true) // 是否为初始页布局
  const isChating = ref(false) // 是否为会话页布局，负责会话页和问题页切换
  const intoChat = () => {
    isStart.value = false
    isChating.value = true
  }
  watch(robotSence, () => {
    cancelCurrentRequest()
    isChating.value = false
  })
  const inputText = ref('')
  const messageItems = ref<IMessageItem[]>([])
  const assistantMessageOutputing = computed(() => {
    if (messageItems.value.length === 0) return false
    const lastItem = messageItems.value[messageItems.value.length - 1]
    return lastItem.role === 'assistant' && lastItem.status === 'pending'
  })
  const sendIconUrl = computed(() =>
    assistantMessageOutputing.value ? sendPauseIcon : inputText.value ? sendIcon : sendDisabledIcon
  )

  const sessionId = ref('')
  const sessionInfo = ref<ISessionItem>()

  // 选择会话，进入会话界面，查询会话详情，更新消息列表
  const selectSession = async (item: ISessionItem) => {
    intoChat()
    try {
      const session = await getSessionById(item.id)
      sessionId.value = item.id
      sessionInfo.value = session
      messageItems.value = session.messages.map((item) => {
        return {
          id: sessionId.value ?? undefined,
          loading: false,
          createdAt: session.createdAt,
          status: 'success',
          role: item.role,
          thinking: false,
          content: item.content,
        }
      })
      recoverAutoScroll()
    } catch (error) {
      console.error(error)
    }
  }

  // 移除最后一个空消息或错误消息
  const popEmptyOrErrorMessage = (msgList: IMessageItem[]) => {
    if (msgList.length === 0) return
    const lastItem = msgList[msgList.length - 1]
    if (lastItem.role === 'assistant' && (lastItem.content === '' || lastItem.status === 'error')) {
      msgList.pop()
    }
  }
  // 发送消息，接收可读流数据
  const sendMessage = async () => {
    if (assistantMessageOutputing.value) {
      latestFetch.abort()
      return
    }
    if (inputText.value.replace(/\s+/g, '').length === 0) {
      ElMessage({ message: '请勿发送空消息', offset: 70, type: 'warning', duration: 5 * 1000 })
      inputText.value = ''
      return
    }
    cancelCurrentRequest()
    intoChat()

    const inputMessage = inputText.value
    inputText.value = ''

    popEmptyOrErrorMessage(messageItems.value)
    messageItems.value.push({
      id: sessionId.value ?? undefined,
      loading: false,
      createdAt: Date.now(),
      status: 'success',
      role: 'user',
      thinking: false,
      content: inputMessage,
    })
    messageItems.value.push({
      id: sessionId.value ?? undefined,
      loading: false,
      createdAt: Date.now(),
      status: 'pending',
      role: 'assistant',
      thinking: true,
      content: '',
    })
    const assistantMessage: IMessageItem = messageItems.value[messageItems.value.length - 1]
    recoverAutoScroll()

    try {
      assistantMessage.status = 'pending'
      await latestFetch.run(async (signal) => {
        const response = await fetch('/assistant/chat', {
          signal: signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionId.value ?? undefined,
            messages: [{ role: 'user', content: inputMessage }],
          }),
        })
        if (!response) throw new Error('get response failed')
        const stream = parseSSE(response)

        for await (const event of stream) {
          let isThinking = false
          switch (event.event) {
            case 'text':
              assistantMessage.content += event.data.delta
              break

            case 'reasoning':
              console.log('thinking:', event.data)
              isThinking = true
              break

            case 'tool_call':
              console.log('tool:', event.data)
              break

            case 'done':
              assistantMessage.status = 'success'
              break

            case 'error':
              throw new Error(event.data || 'agent response error')
          }
          assistantMessage.thinking = isThinking
        }
      })
    } catch (error) {
      console.error(error)
      assistantMessage.status = 'error'
    }
  }
  const sendMessageWithEnter = () => {
    if (assistantMessageOutputing.value) return
    sendMessage()
  }

  // 组件操作
  const messageListRef = shallowRef<InstanceType<typeof MessageList>>()
  const popoverRef = shallowRef<PopoverInstance>()
  const closePopover = () => {
    popoverRef.value?.hide()
  }
  // 点击会话列表项，选择会话
  const sessionClicked = (item: ISessionItem) => {
    selectSession(item)
    closePopover()
    cancelCurrentRequest()
  }
  // 切换自动滚动
  const recoverAutoScroll = () => {
    messageListRef.value?.forceScrollToBottom()
  }
  // 取消当前请求
  const cancelCurrentRequest = () => {
    if (latestFetch.loading) latestFetch.abort()
  }
  // 插入问题
  const insertQuestion = (text: string) => {
    inputText.value = text
  }

  return {
    isStart,
    isChating,
    inputText,
    sendIconUrl,
    messageItems,
    messageListRef,
    popoverRef: popoverRef as ShallowRef<PopoverInstance>,
    insertQuestion,
    sendMessage,
    sendMessageWithEnter,
    selectSession,
    sessionClicked,
    cancelCurrentRequest,
  }
}
