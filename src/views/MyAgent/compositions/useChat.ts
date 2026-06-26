import { computed } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import type { IMessageItem } from '../components/MessageItem/type'
import type MessageList from '../components/MessageList/MessageList.vue'
import sendDisabledIcon from '../assets/send-disabled.svg'
import sendIcon from '../assets/send.svg'
import sendPauseIcon from '../assets/send-pause.svg'
import { parseSSE } from '@/utils/sse/parseSSE'
import { LatestRequestManager } from '@/utils/request'
import { getSessionById, createSession, type ISessionInfo, getSessionList } from '@/api/chat/data'

export interface IUseChatProps {
  getChatList: () => Promise<void>
}

export function useChat({ getChatList }: IUseChatProps) {
  const latestFetch = new LatestRequestManager()
  const inputText = ref('')
  const messageItems = ref<IMessageItem[]>([])
  const assistantMessageOutputing = ref(false)
  const sendIconUrl = computed(() =>
    assistantMessageOutputing.value ? sendPauseIcon : inputText.value ? sendIcon : sendDisabledIcon
  )

  const sessionInfo = ref<ISessionInfo>()
  const sessionId = computed(() => sessionInfo.value?.id || '')
  const hasMoreHistory = ref(false)
  const historyBefore = ref<number | null>(null)
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
        limit: 15,
        before: isReachTop ? historyBefore.value ?? undefined : undefined,
      })
      if (currentToken !== loadHistoryToken) return
      if (session.messages.length === 0) {
        hasMoreHistory.value = false
        historyBefore.value = null
        return
      }
      hasMoreHistory.value = session.previousExist || false
      historyBefore.value = session.previous || null
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

    const inputMessage = inputText.value
    inputText.value = ''

    popEmptyOrErrorMessage(messageItems.value)
    messageItems.value.push(
      ...ensureMessageIds([
        {
          sessionId: sessionId.value ?? undefined,
          loading: false,
          createdAt: Date.now(),
          status: 'success',
          role: 'user',
          hintType: undefined,
          hint: undefined,
          content: inputMessage,
        },
      ])
    )
    messageItems.value.push(
      ...ensureMessageIds([
        {
          sessionId: sessionId.value ?? undefined,
          loading: false,
          createdAt: Date.now(),
          status: 'pending',
          role: 'assistant',
          hintType: 'thinking',
          hint: '正在思考...',
          content: '',
        },
      ])
    )
    const assistantMessage: IMessageItem = messageItems.value[messageItems.value.length - 1]
    gotoBottom()

    try {
      assistantMessage.status = 'pending'
      assistantMessageOutputing.value = true
      // 如果是首次创建会话，需要先创建会话
      if (messageItems.value.length === 2) {
        sessionInfo.value = await createSession({ prompt: inputMessage })
        getChatList()
      }
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
          switch (event.event) {
            case 'text':
              assistantMessage.hintType = 'none'
              assistantMessage.hint = ''
              assistantMessage.content += event.data.delta
              break

            case 'reasoning':
              // 一般是思考/分析中状态
              console.log('reasoning:', event.data) // {"message":"正在理解问题..."}
              assistantMessage.hintType = 'thinking'
              assistantMessage.hint = event.data.delta
              break

            case 'tool_call':
              console.log('tool:', event.data)
              break

            case 'done':
              assistantMessage.status = 'success'
              assistantMessage.hintType = undefined
              assistantMessage.hint = undefined
              break

            case 'error':
              throw new Error(event.data || 'agent response error')
          }
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
  // 点击会话列表项，选择会话
  const sessionClicked = (item: ISessionInfo) => {
    cancelCurrentRequest()
    sessionInfo.value = item
    messageItems.value = []
    loadHistoryMessages() // 不用考虑是否加载中，也不用考虑是否还有历史消息，内部已经执行nextHistoryToken()
  }
  // 清理对话状态
  const clearChatStatus = () => {
    cancelCurrentRequest()
    sessionInfo.value = undefined
    messageItems.value = []
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
  // 创建新对话
  const createNewChat = async () => {
    clearChatStatus()
  }

  return {
    inputText,
    sendIconUrl,
    messageItems,
    messageListRef,
    loadingHistory,
    sendMessage,
    sendMessageWithEnter,
    // selectSession,
    loadHistoryMessages,
    sessionClicked,
    cancelCurrentRequest,
    clearChatStatus,
    createNewChat,
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
