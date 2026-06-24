<script setup lang="ts">
export interface Props {
  direction?: 'left' | 'right'
  speed?: number
  gap?: number
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'left',
  speed: 60,
  gap: 0,
})

const containerRef = ref<HTMLElement>()
const trackRef = ref<HTMLElement>()
const originalRef = ref<HTMLElement>()

const needScroll = ref(false)
let originalWidth = 0

const currentTranslate = ref(0)
let rafId: number | null = null
let lastTimestamp = 0
let isPaused = false

// ---- overflow detection ----
let resizeObserver: ResizeObserver | null = null

function checkOverflow() {
  if (!containerRef.value || !originalRef.value) return
  originalWidth = originalRef.value.scrollWidth
  const containerWidth = containerRef.value.clientWidth
  const shouldScroll = originalWidth > containerWidth
  if (shouldScroll !== needScroll.value) {
    needScroll.value = shouldScroll
    if (shouldScroll) {
      resetPosition()
      startAutoScroll()
    } else {
      stopAutoScroll()
      currentTranslate.value = 0
    }
  }
}

function resetPosition() {
  currentTranslate.value = props.direction === 'left' ? 0 : -originalWidth
}

onMounted(() => {
  checkOverflow()
  resizeObserver = new ResizeObserver(() => checkOverflow())
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  stopAutoScroll()
  resizeObserver?.disconnect()
})

// ---- auto-scroll ----
function startAutoScroll() {
  if (rafId !== null) return
  isPaused = false
  lastTimestamp = 0
  rafId = requestAnimationFrame(tick)
}

function stopAutoScroll() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function tick(timestamp: number) {
  if (!isPaused && lastTimestamp > 0) {
    const dt = Math.min(timestamp - lastTimestamp, 100) // cap at 100ms to avoid jumps
    const delta = (props.speed * dt) / 1000

    if (props.direction === 'left') {
      currentTranslate.value -= delta
      if (currentTranslate.value <= -originalWidth) {
        currentTranslate.value += originalWidth
      }
    } else {
      currentTranslate.value += delta
      if (currentTranslate.value >= 0) {
        currentTranslate.value -= originalWidth
      }
    }
  }
  lastTimestamp = timestamp
  rafId = requestAnimationFrame(tick)
}

// ---- pause / resume ----
function pause() {
  isPaused = true
}

function resume() {
  isPaused = false
  lastTimestamp = 0
  if (rafId === null && needScroll.value) {
    startAutoScroll()
  }
}

// ---- wheel ----
let wheelTimer: ReturnType<typeof setTimeout> | null = null

function onWheel(e: WheelEvent) {
  if (!needScroll.value) return
  stopAutoScroll()
  const dx = (e.deltaX || e.deltaY) * -1
  currentTranslate.value += dx
  while (currentTranslate.value <= -originalWidth) currentTranslate.value += originalWidth
  while (currentTranslate.value > 0) currentTranslate.value -= originalWidth

  if (wheelTimer) clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => {
    wheelTimer = null
    if (!isPaused) {
      startAutoScroll()
    }
  }, 800)
}

// ---- touch ----
interface TouchState {
  startX: number
  startTranslate: number
}

const touchState = shallowRef<TouchState | null>(null)

function onTouchStart(e: TouchEvent) {
  if (!needScroll.value) return
  stopAutoScroll()
  touchState.value = {
    startX: e.touches[0].clientX,
    startTranslate: currentTranslate.value,
  }
}

function onTouchMove(e: TouchEvent) {
  if (!touchState.value) return
  const dx = e.touches[0].clientX - touchState.value.startX
  currentTranslate.value = touchState.value.startTranslate + dx
  while (currentTranslate.value <= -originalWidth) currentTranslate.value += originalWidth
  while (currentTranslate.value > 0) currentTranslate.value -= originalWidth
}

function onTouchEnd() {
  touchState.value = null
  if (!isPaused) {
    lastTimestamp = 0
    startAutoScroll()
  }
}
</script>

<template>
  <div
    ref="containerRef"
    class="autoscroll-hori-list"
    @mouseenter="pause"
    @mouseleave="resume"
    @wheel.prevent="onWheel"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div
      ref="trackRef"
      class="list-track"
      :style="{
        transform: `translateX(${currentTranslate}px)`,
        columnGap: gap + 'px',
      }"
    >
      <div ref="originalRef" class="list-original">
        <slot />
      </div>
      <div v-if="needScroll" class="list-clone">
        <slot />
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.autoscroll-hori-list {
  overflow: hidden;
  width: 100%;
}
.list-track {
  display: flex;
  flex-wrap: nowrap;
  will-change: transform;
}
.list-original,
.list-clone {
  display: flex;
  flex-wrap: nowrap;
}
</style>
