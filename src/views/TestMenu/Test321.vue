<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

// --- 数据模型 ---
type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const replies = [
  'I can break that into the smallest next step and keep the current viewport pinned while this answer grows.',
  'Older messages are loaded above the viewport. The visible row keeps the same screen position after the prepend.',
  'When the thread is not at the bottom, new output waits below without pulling the reader away from history.',
]

const makeMessage = (index: number): Message => ({
  id: `message-${index}`,
  role: index % 4 === 0 ? 'user' : 'assistant',
  content:
    index % 4 === 0
      ? `Can you check item ${index}?`
      : `Message ${index}: ${replies[Math.abs(index) % replies.length]}`,
})

// --- 状态 ---
const parentRef = ref<HTMLDivElement>()
const firstMessageIndex = ref(0)
const nextMessageIndex = ref(45)
const streamTimer = ref<ReturnType<typeof setInterval> | null>(null)
const loadingHistory = ref(false)
const loadingHistoryGuard = ref(false)
const didInitialScroll = ref(false)
const autoHistoryEnabled = ref(false)

const messages = ref<Message[]>(Array.from({ length: 45 }, (_, i) => makeMessage(i)))

// --- Virtualizer ---
const virtualizerRef = useVirtualizer(
  computed(() => ({
    count: messages.value.length,
    getScrollElement: () => parentRef.value ?? null,
    estimateSize: () => 74,
    getItemKey: (index: number) => messages.value[index]!.id,
    anchorTo: 'end' as const,
    followOnAppend: true as const,
    scrollEndThreshold: 80,
    overscan: 6,
  }))
)

const virtualItems = computed(() => virtualizerRef.value.getVirtualItems())
const totalSize = computed(() => virtualizerRef.value.getTotalSize())

// --- 核心操作 ---

/** 加载更早的历史消息（prepend） */
function prependHistory() {
  if (loadingHistoryGuard.value || firstMessageIndex.value <= -90) return

  loadingHistoryGuard.value = true
  loadingHistory.value = true

  setTimeout(() => {
    const start = firstMessageIndex.value - 12
    firstMessageIndex.value = start
    messages.value = [
      ...Array.from({ length: 12 }, (_, i) => makeMessage(start + i)),
      ...messages.value,
    ]
    loadingHistoryGuard.value = false
    loadingHistory.value = false
  }, 180)
}

/** 追加一条新消息（append） */
function appendMessage() {
  const next = nextMessageIndex.value
  nextMessageIndex.value += 1
  messages.value = [...messages.value, makeMessage(next)]
}

/** 模拟流式回复 */
function streamReply() {
  if (streamTimer.value !== null) return

  const id = `stream-${Date.now()}`
  const chunks = [
    'Thinking through the failure mode.',
    ' 1.The list should follow only when it was already pinned.',
    ' 2.Prepends should keep the reader anchored to the same message.',
    ' 3.Streaming output should grow without drifting off the bottom.',
  ]
  let chunkIndex = 0

  messages.value = [...messages.value, { id, role: 'assistant', content: '' }]

  streamTimer.value = setInterval(() => {
    messages.value = messages.value.map((m) =>
      m.id === id ? { ...m, content: chunks.slice(0, chunkIndex + 1).join('') } : m
    )
    chunkIndex += 1
    if (chunkIndex === chunks.length && streamTimer.value !== null) {
      clearInterval(streamTimer.value)
      streamTimer.value = null
    }
  }, 280)
}

/** 一键回到底部 */
function scrollToLatest() {
  virtualizerRef.value.scrollToEnd()
}

/** 虚拟器的当前状态文案 */
const statusText = computed(() => {
  if (loadingHistory.value) return 'Loading history'
  return virtualizerRef.value.isAtEnd(80) ? 'At latest' : 'Reading history'
})

// --- 生命周期 ---

onMounted(() => {
  // 首次挂载滚到底部
  nextTick(() => {
    virtualizerRef.value.scrollToEnd()
    didInitialScroll.value = true
  })

  // 延迟启用滚动到顶加载历史
  const id = setTimeout(() => {
    autoHistoryEnabled.value = true
  }, 250)

  onBeforeUnmount(() => {
    clearTimeout(id)
  })
})

onBeforeUnmount(() => {
  if (streamTimer.value !== null) {
    clearInterval(streamTimer.value)
  }
})

/** 滚动事件：到达顶部时自动加载历史 */
function onScroll(e: Event) {
  const el = e.currentTarget as HTMLElement
  if (!autoHistoryEnabled.value || virtualizerRef.value.isAtEnd(80)) return
  if (el.scrollTop < 120) {
    prependHistory()
  }
}

/** measureElement 回调：注册给虚拟器进行动态高度测量 */
function measureRef(el: unknown) {
  if (el instanceof Element) {
    virtualizerRef.value.measureElement(el)
  }
}
</script>

<template>
  <div class="app">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-group">
        <button @click="prependHistory">Load older</button>
        <button @click="appendMessage">Add message</button>
        <button @click="streamReply">Stream reply</button>
        <button @click="scrollToLatest">Latest</button>
      </div>
      <div class="status">{{ statusText }}</div>
    </div>

    <!-- 消息列表区域 -->
    <div class="shell">
      <div ref="parentRef" class="messages" @scroll="onScroll">
        <div
          class="container"
          :style="{ height: totalSize + 'px', position: 'relative', width: '100%' }"
        >
          <div
            v-for="vItem in virtualItems"
            :key="vItem.key"
            :ref="measureRef"
            :data-index="vItem.index"
            class="message-row"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vItem.start}px)`,
            }"
          >
            <div
              class="bubble"
              :class="messages[vItem.index]!.role === 'user' ? 'bubble-user' : 'bubble-assistant'"
            >
              <div class="meta">{{ messages[vItem.index]!.role }}</div>
              {{ messages[vItem.index]!.content || '...' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.app {
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
}

.toolbar {
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #d9e0e6;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  padding: 10px 12px;
  flex-shrink: 0;

  button {
    border: 1px solid #c6d0da;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
    padding: 7px 10px;

    &:hover {
      background: #eef3f7;
    }
  }
}

.toolbar-group {
  display: flex;
  gap: 8px;
}

.status {
  color: #5c6670;
  font-size: 13px;
}

.shell {
  display: grid;
  min-height: 0;
  overflow: hidden;
  place-items: stretch;
}

.messages {
  min-height: 0;
  overflow: auto;
  overflow-anchor: none;
  width: 100%;
}

.message-row {
  padding: 6px 12px;
}

.bubble {
  border: 1px solid #d7dee5;
  border-radius: 8px;
  line-height: 1.45;
  max-width: min(720px, 88vw);
  padding: 10px 12px;
  white-space: pre-wrap;
}

.bubble-user {
  background: #e6f3ff;
  margin-left: auto;
}

.bubble-assistant {
  background: #fff;
  margin-right: auto;
}

.meta {
  color: #637081;
  font-size: 12px;
  margin-bottom: 4px;
}
</style>
