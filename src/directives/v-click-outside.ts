interface IVClickOutsideValue {
  onClickOutside: (this: HTMLElement, e: MouseEvent) => void
  silence?: string[]
}

const elEventMap = new WeakMap<
  HTMLElement,
  { eventHandler: (e: MouseEvent) => void; elChild: HTMLElement[]; silence: string[] }
>()

const vClickOutside = {
  mounted(el: HTMLElement, binding: { value: IVClickOutsideValue }) {
    if (typeof binding.value?.onClickOutside !== 'function') {
      console.error("vClickOutside: 'onClickOutside' 必须是一个函数")
      return
    }

    const eventHandler = function (e: MouseEvent) {
      const elConfig = elEventMap.get(el)
      if (!elConfig) return

      const allChild = elConfig.elChild || []
      const silenceEls: HTMLElement[] = []

      for (const selector of elConfig.silence) {
        try {
          const selEls = document.querySelectorAll(selector) as unknown as HTMLElement[]
          for (const selEl of selEls) {
            silenceEls.push(...allChildOfEl(selEl))
          }
        } catch {
          console.error(`无效的选择器：${selector}`)
        }
      }

      const excludeSet = new Set([...allChild, ...silenceEls])
      const path = e.composedPath ? e.composedPath() : getElementPath(e.target)

      if (el && !path.some((node) => excludeSet.has(node as HTMLElement))) {
        binding.value.onClickOutside?.call(el, e)
      }
    }

    const allChild = allChildOfEl(el)
    elEventMap.set(el, { eventHandler, elChild: allChild, silence: binding.value.silence || [] })
    window.addEventListener('click', eventHandler, true)
  },
  unmounted(el: HTMLElement) {
    const elConfig = elEventMap.get(el)
    if (elConfig?.eventHandler) {
      window.removeEventListener('click', elConfig.eventHandler)
    }
    elEventMap.delete(el)
  },
}

function allChildOfEl(el: HTMLElement, result: HTMLElement[] = []): HTMLElement[] {
  const stack = [el]
  while (stack.length) {
    const current = stack.pop()!
    result.push(current)
    stack.push(...(Array.from(current.children) as HTMLElement[]))
  }
  return result
}
function getElementPath(target: EventTarget | null): HTMLElement[] {
  const path: HTMLElement[] = []
  let current = target as HTMLElement | null

  while (current) {
    path.push(current)
    current = current.parentElement
  }

  return path
}

export default vClickOutside
