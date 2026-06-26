import type MarkdownIt from 'markdown-it'

let markdownit: typeof MarkdownIt | null = null
let markdownPromise: Promise<{ default: typeof MarkdownIt }> | null = null

export const markdownLoader = async (): Promise<typeof MarkdownIt> => {
  if (markdownit) return markdownit
  try {
    if (!markdownPromise) {
      markdownPromise = import('markdown-it')
    }
    const module = await markdownPromise
    markdownit = module.default
  } catch (error) {
    console.error('Markdown 解析器 加载或渲染失败:', error)
  }
  return markdownit as typeof MarkdownIt
}
