import type { Directive } from 'vue'

interface AutoTextareaOptions {
  minRows?: number
  maxRows?: number
}

const handlerMap = new WeakMap<HTMLTextAreaElement, () => void>()

function getRowsHeight(el: HTMLTextAreaElement, rows: number) {
  const style = getComputedStyle(el)
  let lineHeight = parseFloat(style.lineHeight)

  if (Number.isNaN(lineHeight)) {
    lineHeight = parseFloat(style.fontSize) * 1.2
  }

  const paddingTop = parseFloat(style.paddingTop)
  const paddingBottom = parseFloat(style.paddingBottom)

  return lineHeight * rows + paddingTop + paddingBottom
}

function resize(el: HTMLTextAreaElement, options: AutoTextareaOptions) {
  const { minRows, maxRows } = options

  el.style.height = 'auto'
  el.style.overflowY = 'hidden'

  let height = el.scrollHeight

  if (minRows) {
    const minH = getRowsHeight(el, minRows)
    if (height < minH) height = minH
  }

  if (maxRows) {
    const maxH = getRowsHeight(el, maxRows)
    if (height > maxH) {
      height = maxH
      el.style.overflowY = 'auto'
    }
  }

  el.style.height = `${height}px`
}

export const vAutoTextarea: Directive<HTMLTextAreaElement, AutoTextareaOptions> = {
  mounted(el, binding) {
    el.style.resize = 'none'

    const handler = () => resize(el, binding.value)

    handlerMap.set(el, handler)
    el.addEventListener('input', handler)

    resize(el, binding.value)
  },

  updated(el, binding) {
    resize(el, binding.value)
  },

  unmounted(el) {
    const handler = handlerMap.get(el)
    if (handler) {
      el.removeEventListener('input', handler)
      handlerMap.delete(el)
    }
  },
}
