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
    const eventHandler = function (e: MouseEvent) {
      const elConfig = elEventMap.get(el)
      if (!elConfig) return
      const allChild = elConfig.elChild || []
      const silenceEls: HTMLElement[] = []
      for (const selector of elConfig.silence) {
        const selEls = document.querySelectorAll(selector) as unknown as HTMLElement[]
        for (const selEl of selEls) {
          silenceEls.push(...allChildOfEl(selEl))
        }
      }
      const excludeSet = new Set([...allChild, ...silenceEls])
      if (el && !excludeSet.has(e.target as HTMLElement)) {
        binding.value.onClickOutside?.call(el, e)
      }
    }
    const allChild = allChildOfEl(el)
    elEventMap.set(el, { eventHandler, elChild: allChild, silence: binding.value.silence || [] })
    window.addEventListener('click', eventHandler, true)
  },
  unmounted(el: HTMLElement) {
    const eventHandler = elEventMap.get(el)?.eventHandler
    const elChild = elEventMap.get(el)?.elChild
    if (eventHandler) {
      window.removeEventListener('click', eventHandler)
    }
    if (elChild) {
      elChild.splice(0, elChild.length)
    }
  },
}

function allChildOfEl(el: HTMLElement, result: HTMLElement[] = []) {
  result.push(el)
  for (const item of el.children) {
    allChildOfEl(item as HTMLElement, result)
  }
  return result
}

export default vClickOutside
