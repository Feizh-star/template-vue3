<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

withDefaults(
  defineProps<{
    isLoadingHistory: boolean
  }>(),
  {
    isLoadingHistory: false,
  }
)
const emit = defineEmits<{
  (e: 'reach-top'): void
}>()

const scrollWrapRef = ref<HTMLDivElement>()
const topAnchorRef = shallowRef<HTMLDivElement>()
const messageBodyRef = ref<HTMLDivElement>()
const bottomAnchorRef = ref<HTMLDivElement>()
const isAtBottom = ref(true)

/**
 * observer
 */
let intersectionObserver: IntersectionObserver | null = null
let topAnchorObserver: IntersectionObserver | null = null
let resizeObserver: ResizeObserver | null = null

/**
 * 列表是否在底部
 */
const setupIntersectionObserver = () => {
  const wrapEl = scrollWrapRef.value
  if (!wrapEl || !bottomAnchorRef.value) return

  intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      isAtBottom.value = entry.isIntersecting
    },
    {
      root: wrapEl,
      threshold: 0.1,
    }
  )

  intersectionObserver.observe(bottomAnchorRef.value)
}

/**
 * 监听顶部锚点，是否可以尝试加载历史
 */
const setupTopAnchorObserver = () => {
  const wrapEl = scrollWrapRef.value
  if (!wrapEl || !topAnchorRef.value) return

  topAnchorObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        emit('reach-top')
      }
    },
    {
      root: wrapEl,
      threshold: 0.5,
    }
  )
  topAnchorObserver.observe(topAnchorRef.value)
}

/**
 * 监听内容高度变化，补偿滚动位置，可以直接实现顶部插入消息不抖动、底部自动向上滚动
 * markdown、图片、代码高亮都会触发
 */
let contentScrollHeight = 0
const setupResizeObserver = () => {
  const messageEl = messageBodyRef.value
  if (!messageEl) return
  resizeObserver = new ResizeObserver(() => {
    const growthDirection = detectGrowthDirection(messageBodyRef.value!)
    // 如果内容向下增长，且不在底部，说明新消息正在加载中时用户滚动到了上方，不补偿滚动位置
    if (!isAtBottom.value && growthDirection === 'down') return
    compensateScrollHeight()
  })
  resizeObserver.observe(messageEl)
}
const recordWrapScrollHeight = () => {
  if (!scrollWrapRef.value) return
  const scrollHeight = scrollWrapRef.value.scrollHeight
  const clientHeight = scrollWrapRef.value.clientHeight
  contentScrollHeight = Math.max(scrollHeight, clientHeight)
  // 处理初次加载的消息高度小于视口高度的情况
  if (scrollHeight - clientHeight <= 0.1) {
    emit('reach-top')
  }
}
/**
 * 核心逻辑/难点：
 * 上方插入内容时，将高度差补偿给scrollTop，可以保持视觉位置不变；
 * 下方插入内容时，将高度差补偿给scrollTop，可实现底部自动向上滚动
 */
const compensateScrollHeight = () => {
  if (!scrollWrapRef.value) return
  const delta = scrollWrapRef.value.scrollHeight - contentScrollHeight
  scrollWrapRef.value.scrollTop += delta
  recordWrapScrollHeight()
}

defineExpose({
  scrollToBottom,
  resetAnchor: () => {
    initFirstVisibleAnchorInfo()
  },
})

onMounted(() => {
  setupIntersectionObserver()
  setupResizeObserver()
  setupTopAnchorObserver()
  recordWrapScrollHeight()
})

onBeforeUnmount(() => {
  intersectionObserver?.disconnect()
  topAnchorObserver?.disconnect()
  resizeObserver?.disconnect()
})
// ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑ 状态 ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑

// ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓ 工具 ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
/**
 * 滚动到底部
 */
function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  bottomAnchorRef.value?.scrollIntoView({
    block: 'end',
    behavior,
  })
}

/**
 * 检测内容高度变化方向
 */
type GrowthDirection = 'up' | 'down' | 'none'
type AnchorInfo = {
  id: string
  topOffset: number
  bottomOffset: number
  timeStamp: number
}
const firstVisibleAnchorInfo: AnchorInfo = {
  id: '',
  topOffset: 0,
  bottomOffset: 0,
  timeStamp: 0,
}
// 获取当前视口里的第一个可见元素
function getFirstVisibleAnchor(
  scrollWrap: HTMLElement,
  scrollContent: HTMLElement
): HTMLElement | null {
  const wrapRect = scrollWrap.getBoundingClientRect()

  const children = [...scrollContent.children].slice(1, -1) as HTMLElement[] // 排除顶部锚点和底部锚点

  for (const el of children) {
    const rect = el.getBoundingClientRect()

    // 元素底部进入视口
    if (rect.bottom >= wrapRect.top) {
      return el
    }
  }

  return null
}
// 根据锚点id获取元素
function getElementByAnchorId(scrollContent: HTMLElement, anchorId: string) {
  const children = [...scrollContent.children].slice(1, -1) as HTMLElement[] // 排除顶部锚点和底部锚点
  for (const el of children) {
    if (el.dataset.anchorId === anchorId) {
      return el
    }
  }
  return null
}
// 获取锚点信息
function initFirstVisibleAnchorInfo(timeStamp: number = performance.now()) {
  if (firstVisibleAnchorInfo.timeStamp === 0) firstVisibleAnchorInfo.timeStamp = timeStamp
  const escapeTime = timeStamp - firstVisibleAnchorInfo.timeStamp
  if (escapeTime > 300) return
  if (!scrollWrapRef.value || !messageBodyRef.value) {
    requestAnimationFrame(initFirstVisibleAnchorInfo)
    return
  }
  const anchorEl = getFirstVisibleAnchor(scrollWrapRef.value, messageBodyRef.value)
  if (!anchorEl) {
    requestAnimationFrame(initFirstVisibleAnchorInfo)
    return
  }
  firstVisibleAnchorInfo.id = anchorEl.dataset.anchorId || ''
  if (!firstVisibleAnchorInfo.id) {
    throw new Error('message item data-anchor-id is empty')
  }
  const scrollContent = anchorEl.parentElement as HTMLElement
  const contentRect = scrollContent.getBoundingClientRect()
  const anchorRect = anchorEl.getBoundingClientRect()
  firstVisibleAnchorInfo.topOffset = anchorRect.top - contentRect.top
  firstVisibleAnchorInfo.bottomOffset = contentRect.bottom - anchorRect.top
}
// 检测内容高度变化方向
function detectGrowthDirection(scrollContent: HTMLElement): GrowthDirection {
  if (!scrollContent) return 'none'
  if (firstVisibleAnchorInfo.id === '') return 'none'
  const anchorEl = getElementByAnchorId(scrollContent, firstVisibleAnchorInfo.id)
  if (!anchorEl) return 'none'
  const contentRect = scrollContent.getBoundingClientRect()
  const anchorRect = anchorEl.getBoundingClientRect()
  const newTopOffset = anchorRect.top - contentRect.top
  const newBottomOffset = contentRect.bottom - anchorRect.top
  const topDelta = newTopOffset - firstVisibleAnchorInfo.topOffset
  const bottomDelta = newBottomOffset - firstVisibleAnchorInfo.bottomOffset
  firstVisibleAnchorInfo.topOffset = newTopOffset
  firstVisibleAnchorInfo.bottomOffset = newBottomOffset
  if (topDelta > 0.5) return 'up'
  if (bottomDelta > 0.5) return 'down'
  return 'none'
}
</script>

<template>
  <div class="message-list">
    <slot name="top-loading" v-if="isLoadingHistory">
      <div class="top-loading-content"><span>加载中...</span></div>
    </slot>
    <div class="message-scroll-wrap" ref="scrollWrapRef">
      <div class="message-items" ref="messageBodyRef">
        <div class="top-anchor" ref="topAnchorRef"></div>
        <slot></slot>
        <!-- 底部锚点 -->
        <div ref="bottomAnchorRef" style="height: 1px"></div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.message-list {
  height: 100%;
  padding-top: 8px;
  position: relative;
}
.message-scroll-wrap {
  height: 100%;
  overflow-y: auto;
  overflow-anchor: none;
}

.message-items {
  padding: 16px 18px 16px 24px;
  position: relative;
}
@supports (-moz-appearance: none) {
  .message-items {
    padding: 16px 24px 16px 24px;
  }
}
.top-anchor {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
}

.top-loading-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 8px;
  font-size: 13px;
  font-family: 'AlibabaPuHuiTi_2_55';
}

* {
  @-moz-document url-prefix() {
    scrollbar-width: thin;
    scrollbar-color: rgba(192, 197, 201, 0.75) rgba(0, 0, 0, 0);
  }
  /* 滚动条样式 */
  &::-webkit-scrollbar {
    width: 6px; /*  设置纵轴（y轴）轴滚动条 */
    height: 6px; /*  设置横轴（x轴）轴滚动条 */
  }
  /* 滚动条滑块（里面小方块） */
  &::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background: rgba(192, 197, 201, 0.75);
    cursor: pointer;
  }
  /* 滚动条轨道 */
  &::-webkit-scrollbar-track {
    border-radius: 3px;
    background: transparent;
  }
  &::-webkit-scrollbar-corner {
    display: none;
  }
}
</style>
