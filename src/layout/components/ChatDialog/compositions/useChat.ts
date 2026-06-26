import { computed } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import { ElMessage, type PopoverInstance } from 'element-plus'
import type { IMessageItem } from '../components/MessageItem/type'
import type MessageList from '../components/MessageList/MessageList.vue'
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
  loadingHistory: Ref<boolean>
  insertQuestion: (text: string) => void
  sendMessage: () => Promise<void>
  sendMessageWithEnter: () => void
  // selectSession: (item: ISessionItem) => Promise<void>
  loadHistoryMessages: (isReachTop: boolean) => Promise<void>
  sessionClicked: (item: ISessionItem) => void
  cancelCurrentRequest: () => void
  clearChatStatus: () => void
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
  const assistantMessageOutputing = ref(false)
  const sendIconUrl = computed(() =>
    assistantMessageOutputing.value ? sendPauseIcon : inputText.value ? sendIcon : sendDisabledIcon
  )

  const sessionInfo = ref<ISessionItem>()
  const sessionId = computed(() => sessionInfo.value?.id || '')
  const hasMoreHistory = computed(() => sessionInfo.value?.previousExist || false)
  const historyBefore = computed(() => sessionInfo.value?.previous || null)
  const loadingHistory = ref(false)

  // 加载历史消息，选择历史会话，首次进入会话界面时也会触发加载历史消息
  let loadHistoryToken = 0 // 加载历史消息token，用于判断是否是当前请求
  const nextHistoryToken = () => ++loadHistoryToken
  /**
   * 加载历史消息
   * @param isReachTop 是否触顶加载，不是触顶加载时，会清空消息列表，重新加载历史消息
   * @returns
   */
  const loadHistoryMessages = async (isReachTop: boolean = false) => {
    // 如果是触顶加载，loadingHistory.value保证了不可能出现重复请求
    if (
      (isReachTop &&
        (loadingHistory.value || !hasMoreHistory.value || historyBefore.value === null)) ||
      !sessionId.value
    ) {
      return
    }
    if (!isReachTop) messageItems.value = [] // 非触顶加载，清空消息列表

    loadingHistory.value = true
    const currentToken = nextHistoryToken()
    try {
      const session = await getSessionById({
        sessionId: sessionId.value,
        limit: 5,
        before: isReachTop ? historyBefore.value || undefined : undefined,
      })
      if (currentToken !== loadHistoryToken) return
      sessionInfo.value = session
      if (session.messages.length === 0) {
        sessionInfo.value.previousExist = false
        sessionInfo.value.previous = null
        return
      }
      const newMessages = ensureMessageIds(
        session.messages.map((item) => ({
          id: item.id,
          sessionId: session.id ?? undefined,
          role: item.role,
          content: item.content,
          createdAt: item.createdAt,
          loading: false,
          status: 'success',
          hintType: undefined,
          hint: undefined,
        }))
      )
      const oldMessageCount = messageItems.value.length
      popEmptyOrErrorMessage(newMessages)
      messageItems.value = [...newMessages, ...messageItems.value]
      // 如果是第一次加载，需要滚动到最底部
      if (!isReachTop && oldMessageCount === 0) {
        resetListAnchor()
        gotoBottom()
      }
    } catch (error) {
      console.error('加载历史消息失败:', error)
    } finally {
      if (currentToken === loadHistoryToken) loadingHistory.value = false
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
      assistantMessageOutputing.value = false
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
    gotoBottom()

    try {
      assistantMessage.status = 'pending'
      assistantMessageOutputing.value = true
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
    } finally {
      assistantMessageOutputing.value = false
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
    closePopover()
    cancelCurrentRequest()
    sessionInfo.value = item
    messageItems.value = []
    intoChat()
    loadHistoryMessages() // 不用考虑是否加载中，也不用考虑是否还有历史消息，内部已经执行nextHistoryToken()
  }
  // 清理对话状态
  const clearChatStatus = () => {
    cancelCurrentRequest()
    sessionInfo.value = undefined
    messageItems.value = []
    isChating.value = false
    nextHistoryToken() // 已经切换场景了，有延迟到达的历史消息也不要了
  }
  // 去底部
  const gotoBottom = () => {
    messageListRef.value?.scrollToBottom()
  }
  // 重新确定锚点
  const resetListAnchor = () => {
    messageListRef.value?.resetAnchor()
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
    loadingHistory,
    insertQuestion,
    sendMessage,
    sendMessageWithEnter,
    // selectSession,
    loadHistoryMessages,
    sessionClicked,
    cancelCurrentRequest,
    clearChatStatus,
  }
}

let messageIdCounter = 0
function generateMessageId(): string {
  return `${Date.now().toString(36)}-${++messageIdCounter}`
}
function ensureMessageIds(messages: IMessageItem[]): IMessageItem[] {
  for (const msg of messages) {
    if (!msg.id) {
      msg.id = generateMessageId()
    }
  }
  return messages
}
