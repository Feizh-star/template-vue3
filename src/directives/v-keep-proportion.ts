/**
 * 保持元素宽高比例，可以已知宽度，使高度成比例，也可以反过来
 * v-keep-proportion="{ computingSizeKey: 'height', ratio: 1 }，默认值（保持元素为正方形）可省略
 */

const elScaleSizeKey = Symbol('elScaleSizeKey')
const setSize = Symbol('setSize')

type TSizeKey = 'width' | 'height'
interface IBinding {
  value: {
    computingSizeKey?: TSizeKey
    ratio?: number
  }
  [p: string]: any
}

const reverseKey = new Map([
  ['width', 'height'],
  ['height', 'width'],
])
const elInfoMap = new WeakMap<
  HTMLElement,
  {
    [elScaleSizeKey]: IBinding['value']
    [setSize]: () => void
  }
>()

const observerMap = new WeakMap<
  HTMLElement,
  {
    observer: ResizeObserver
  }
>()

export default {
  created(el: HTMLElement, binding: IBinding) {
    const bindingValue = binding.value
    const elInfo = {
      [elScaleSizeKey]: { ratio: 1, computingSizeKey: 'height' as const, ...(bindingValue || {}) },
      [setSize]: () => setWidth(el),
    }
    elInfoMap.set(el, elInfo)
  },
  mounted(el: HTMLElement) {
    const elInfo = elInfoMap.get(el)
    if (!elInfo) return
    const resizeObserver = setSizeObserver(el, elInfo[setSize])
    observerMap.set(el, { observer: resizeObserver })
    setWidth(el)
  },
  unmounted(el: HTMLElement) {
    const observer = observerMap.get(el)?.observer
    if (!observer) return
    observer.unobserve(el)
  },
}

function setSizeObserver(el: HTMLElement, handler: (...args: any[]) => void) {
  const computedStyle = el.getBoundingClientRect()
  let oldWidth: string = computedStyle.width + ''
  let oldHeight: string = computedStyle.height + ''
  // 创建一个 ResizeObserver 实例
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { target, contentRect } = entry
      if (target !== el) continue
      const { width, height } = contentRect
      // 在这里执行宽高变化后的操作
      const newWidthString = width.toString()
      const newHeightString = height.toString()
      const sizeChange = oldWidth !== newWidthString || oldHeight !== newHeightString
      if (sizeChange) {
        handler.call(null, width, height)
      }
      oldHeight = newHeightString
      oldWidth = newWidthString
    }
  })
  // 监听指定的 <div> 元素
  resizeObserver.observe(el)
  return resizeObserver
}

function setWidth(el: HTMLElement) {
  const elInfo = elInfoMap.get(el)
  if (!elInfo) return
  const elScaleSizeProps = elInfo[elScaleSizeKey] as IBinding['value']
  const computingSizeKey = elScaleSizeProps.computingSizeKey || 'height'
  const knownSizeKey = reverseKey.get(computingSizeKey) as TSizeKey
  const ratio = elScaleSizeProps.ratio || 1
  const knownSize = getComputedStyle(el)[knownSizeKey]
  const computedSize = (parseFloat(knownSize) || 0) * ratio + 'px'
  el.style[computingSizeKey] = computedSize
}
