<script setup lang="ts">
import type { ElScrollbar } from 'element-plus'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const scrollbarRef = ref<InstanceType<typeof ElScrollbar>>()
const messageListRef = ref<HTMLDivElement>()
const messageBodyRef = ref<HTMLDivElement>()
const bottomAnchorRef = ref<HTMLDivElement>()

/**
 * 是否允许自动滚动
 */
const userLocked = ref(false)
const isAtBottom = ref(true)
let programmaticScrolling = false

/**
 * observer
 */
let intersectionObserver: IntersectionObserver | null = null
let resizeObserver: ResizeObserver | null = null
let containerResizeObserver: ResizeObserver | null = null

/**
 * 获取真正的滚动容器
 */
function getWrapEl() {
  return scrollbarRef.value?.wrapRef
}

/**
 * 滚动到底部
 */
function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  programmaticScrolling = true
  bottomAnchorRef.value?.scrollIntoView({
    block: 'end',
    behavior,
  })
}

/**
 * RAF 节流滚动
 */
let pendingScroll = false
function requestAutoScroll() {
  if (userLocked.value) return

  if (pendingScroll) return

  pendingScroll = true

  requestAnimationFrame(() => {
    pendingScroll = false
    scrollToBottom('auto')
  })
}

/**
 * 用户是否主动离开底部
 */
function setupIntersectionObserver() {
  const wrapEl = getWrapEl()

  if (!wrapEl || !bottomAnchorRef.value) return

  intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      isAtBottom.value = entry.isIntersecting

      /**
       * 只有重新回到底部
       * 才解除用户锁定
       */
      if (entry.isIntersecting) {
        userLocked.value = false
      }
    },
    {
      root: wrapEl,
      threshold: 0.1,
    }
  )

  intersectionObserver.observe(bottomAnchorRef.value)
}

/**
 * 监听内容高度变化
 * markdown、图片、代码高亮都会触发
 */
function setupResizeObserver() {
  const messageEl = messageBodyRef.value

  if (!messageEl) return
  resizeObserver = new ResizeObserver(() => {
    requestAutoScroll()
  })

  resizeObserver.observe(messageEl)
}

/**
 * 监听容器高度变化：更新滚动条状态
 */
function setupContainerResizeObserver() {
  const containerEl = messageListRef.value

  if (!containerEl) return
  containerResizeObserver = new ResizeObserver(() => {
    scrollbarRef.value?.update()
  })

  containerResizeObserver.observe(containerEl)
}

/**
 * 用户主动向上滚动
 * 锁定自动滚动
 */
function setupUserScrollListener() {
  const wrapEl = getWrapEl()

  if (!wrapEl) return
  let lastScrollTop = 0

  wrapEl.addEventListener('scroll', () => {
    if (programmaticScrolling) {
      programmaticScrolling = false
      lastScrollTop = wrapEl.scrollTop
      return
    }
    const current = wrapEl.scrollTop

    /**
     * 用户向上滚
     */
    if (current < lastScrollTop) {
      userLocked.value = true
    }

    lastScrollTop = current
  })
}

/**
 * 外部调用
 */
function forceScrollToBottom(behavior: ScrollBehavior = 'auto') {
  userLocked.value = false

  nextTick(() => {
    scrollToBottom(behavior)
  })
}

defineExpose({
  /**
   * 新消息、加载历史会话时调用
   */
  forceScrollToBottom,
})

onMounted(() => {
  setupIntersectionObserver()

  setupResizeObserver()
  setupContainerResizeObserver()

  setupUserScrollListener()

  /**
   * 初始进入滚到底部
   */
  nextTick(() => {
    scrollToBottom()
  })
})

onBeforeUnmount(() => {
  intersectionObserver?.disconnect()

  resizeObserver?.disconnect()
  containerResizeObserver?.disconnect()
})
</script>

<template>
  <div class="message-list" ref="messageListRef">
    <el-scrollbar ref="scrollbarRef">
      <div class="message-items" ref="messageBodyRef">
        <slot></slot>
        <!-- 底部锚点 -->
        <div ref="bottomAnchorRef" style="height: 1px"></div>
      </div>
    </el-scrollbar>
  </div>
</template>

<style lang="less" scoped>
.message-list {
  height: 100%;
  padding-top: 8px;
}
.message-items {
  padding: 16px 24px;
}
</style>
