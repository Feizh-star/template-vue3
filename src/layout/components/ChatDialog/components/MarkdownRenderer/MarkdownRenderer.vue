<script setup lang="ts">
import type MarkdownIt from 'markdown-it'
import { markdownLoader } from './loader/markdown-loader'

const props = defineProps<{
  content?: string
}>()

const markdownEl = ref<HTMLDivElement>()
const md = shallowRef<MarkdownIt | null>(null)
const loadMarkdown = async () => {
  const markdownit = await markdownLoader()
  md.value = markdownit({
    html: true,
    breaks: true,
    linkify: true,
    typographer: true,
  })
}
onBeforeMount(() => loadMarkdown())

const renderMarkdown = () => {
  if (!md.value || !markdownEl.value) return
  const html = md.value.render(props.content || '')
  markdownEl.value.innerHTML = html
}

watch(
  () => props.content,
  () => {
    renderMarkdown()
  },
  { immediate: true }
)
const markdownReadyWatch = watch(
  () => md.value,
  (newVal, oldVal) => {
    if (newVal && !oldVal && props.content) {
      markdownReadyWatch && markdownReadyWatch()
      renderMarkdown()
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="markdown-renderer">
    <div class="markdown-body" ref="markdownEl"></div>
  </div>
</template>

<style lang="less" scoped>
.markdown-renderer {
  :deep(.markdown-body) {
    background: transparent;
    menu,
    ol,
    ul {
      list-style: revert;
    }
    hr {
      height: 0.1em;
    }
    table {
      max-height: 460px;
    }
    th {
      white-space: nowrap;
    }
  }
}
</style>
