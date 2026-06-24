import { watch } from 'vue'
import type { Ref } from 'vue'

let styleEl: HTMLLinkElement | null = null
let setThemeToken = 0

async function setTheme(dark: boolean) {
  if (!styleEl) return
  const token = ++setThemeToken
  const href = dark
    ? (await import('github-markdown-css/github-markdown-dark.css?url')).default
    : (await import('github-markdown-css/github-markdown-light.css?url')).default
  if (token === setThemeToken) {
    styleEl.href = href
  }
}

export function loadGithubMarkdownTheme(isDark: boolean) {
  if (styleEl) return
  styleEl = document.createElement('link')
  styleEl.rel = 'stylesheet'
  document.head.appendChild(styleEl)
  setTheme(isDark)
}

export function useGithubMarkdownTheme({ isDark }: { isDark: Ref<boolean> }) {
  watch(isDark, (dark) => {
    setTheme(dark)
  })
}
