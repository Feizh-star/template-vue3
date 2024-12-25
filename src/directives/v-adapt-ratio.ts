import * as lodashLib from 'lodash'

export interface IAdaptRatio {
  value: {
    designWidth?: number
    selector?: string
  }
}

const elementMap = new WeakMap<
  HTMLElement,
  {
    observer: ResizeObserver
    option: IAdaptRatio['value']
  }
>()

const defaultOption: IAdaptRatio['value'] = {
  designWidth: 1920,
  selector: undefined,
}

export default {
  mounted(el: HTMLElement, binding: IAdaptRatio) {
    const option = lodashLib.mergeWith(lodashLib.cloneDeep(defaultOption), binding.value || {})
    const targetElement = option.selector ? el.querySelector(option.selector) || el : el
    // 创建一个 ResizeObserver 实例
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { target } = entry
        if (target !== targetElement) continue
        // 在这里执行宽高变化后的操作
        const parentContentRect = getElContentSize(target.parentNode as HTMLElement)
        handleResize(target as HTMLElement, parentContentRect)
      }
    })
    // 监听指定的 <div> 元素
    resizeObserver.observe(targetElement)
    elementMap.set(targetElement, { observer: resizeObserver, option })
    const parentContentRect = getElContentSize(targetElement.parentNode as HTMLElement)
    handleResize(targetElement, parentContentRect)
  },
  updated(el: HTMLElement, binding: IAdaptRatio) {
    const targetElement = (
      binding.value?.selector ? el.querySelector(binding.value?.selector) || el : el
    ) as HTMLElement
    const elInfo = elementMap.get(targetElement)
    if (!elInfo) {
      console.error(
        'The instruction options associated with the current element could not be found at update time'
      )
      return
    }
    elInfo.option = lodashLib.mergeWith(lodashLib.cloneDeep(elInfo.option), binding.value || {})
    elementMap.set(targetElement, elInfo)
    const parentContentRect = getElContentSize(targetElement.parentNode as HTMLElement)
    handleResize(targetElement, parentContentRect)
  },
  unmounted(el: HTMLElement) {
    const observer = elementMap.get(el)?.observer
    if (!observer) return
    observer.unobserve(el)
  },
}

function handleResize(el: HTMLElement, contentRect: ReturnType<typeof getElContentSize>) {
  const option = elementMap.get(el)?.option
  if (!option) {
    console.warn('HTMLElement has not option.')
    return
  }
  const designWidth = option.designWidth as number
  const { width: docWidth, height: docHeight } = document.documentElement.getBoundingClientRect()
  const { contentWidth: originWidth, contentHeight: originHeight } = contentRect

  const targetWidth = originWidth * (designWidth / docWidth)
  const targetHeight = targetWidth * (originHeight / originWidth)

  const designHeight = designWidth * (docHeight / docWidth)
  const widthRatio = docWidth / designWidth
  const heightRatio = docHeight / designHeight
  const parentStyle = (el.parentNode as HTMLElement).style
  parentStyle.overflow = 'hidden' // 解决火狐scale缩小之前，el的尺寸超大撑开文档导致滚动条的问题
  const elStyle = el.style
  elStyle.width = `${(targetWidth / originWidth) * 100}%`
  elStyle.height = `${(targetHeight / originHeight) * 100}%`
  elStyle.transform = `scale(${widthRatio},${heightRatio})`
  elStyle.transformOrigin = 'left top'
}

function getElContentSize(el: HTMLElement) {
  const computedStyle = getComputedStyle(el)
  const width = parseFloat(computedStyle.width)
  const height = parseFloat(computedStyle.height)
  const paddingTop = parseFloat(computedStyle.paddingTop)
  const paddingBottom = parseFloat(computedStyle.paddingBottom)
  const paddingLeft = parseFloat(computedStyle.paddingLeft)
  const paddingRight = parseFloat(computedStyle.paddingRight)
  const borderTop = parseFloat(computedStyle.borderTopWidth)
  const borderBottom = parseFloat(computedStyle.borderBottomWidth)
  const borderLeft = parseFloat(computedStyle.borderLeftWidth)
  const borderRight = parseFloat(computedStyle.borderRightWidth)
  return {
    contentWidth: Math.floor(width - paddingLeft - paddingRight - borderLeft - borderRight),
    contentHeight: Math.floor(height - paddingTop - paddingBottom - borderTop - borderBottom),
  }
}
