export interface IVEllipsisValue {
  content: string
  lineHeight?: number
  line?: number
  fontWidth?: number
  remain?: string
  remainClick?: (event: Event, info: IVEllipsisValue) => void
  isEllipsis?: { status: boolean }
}

interface IBinding {
  value: IVEllipsisValue
}

const remainClass = 'vue-ellipsis-unfold'
const elMap = new WeakMap<
  HTMLElement,
  {
    contentInfo: Required<IVEllipsisValue>
    observer: ResizeObserver
  }
>()

/**
 * 指令v-ellipsis：文本显示省略号，没有css兼容问题
 * 注意事项：
 *   1.使用v-ellipsis的元素内部不能有其他的html元素，就算有也会被文字覆盖
 *   2.元素的min-height会被设置到行内样式，最好不要覆盖，如需覆盖，不可小于line * lineHeight + paddingTop + paddingBottom + borderTop + borderBottom（请自行计算）
 *   3.remain内容所在的span，自定义样式不可设置padding和margin，字体不能大于content文本大小，否则可能会换行；另外最好使用与content相同宽度的字符（语言）
 * 指令value参数：
 *   content: string  内容字符串，必填
 *   lineHeight?: number  行高，可选，默认读取css行高
 *   line?: number  行数，可选，默认3
 *   fontWidth?: number 估计的平均字体宽度，不设置的话就按字体大小+字间距
 *   remain?: string  出现省略号时的预留字符，可选，默认''，用于右下角的操作按钮，例如“展开”，可使用'reamin-btn'自定义css样式
 *   remainClick?: (event: Event, info: IVEllipsisValue) => void 预留字符的点击事件，可选
 *   isEllipsis?: { status: boolean }  省略状态，必须是一个{ status: boolean }结构的对象，如果需要响应式，需是一个reactive对象
 */
export default {
  mounted(el: HTMLElement, binding: IBinding) {
    const contentInfo = handleProps(el, binding)
    setEllipsisStyle(el, contentInfo)
    const status = setEllipsis(contentInfo, el, contentInfo.remain)
    contentInfo.isEllipsis.status = status
    setRemainClick(el, contentInfo)

    elMap.set(el, { contentInfo: contentInfo, observer: setElObserver(el, contentInfo) })
  },
  updated(el: HTMLElement, binding: IBinding) {
    const elEllipsisInfo = elMap.get(el)
    const contentInfo = handleProps(el, binding)
    const change =
      contentInfo.content !== elEllipsisInfo?.contentInfo.content ||
      contentInfo.line !== elEllipsisInfo?.contentInfo.line ||
      `${contentInfo.fontWidth}` !== `${elEllipsisInfo?.contentInfo.fontWidth}` ||
      contentInfo.lineHeight?.toFixed(2) !== elEllipsisInfo?.contentInfo.lineHeight?.toFixed(2)
    if (!elEllipsisInfo || !change) return
    elEllipsisInfo.observer?.unobserve(el)
    elEllipsisInfo.contentInfo = contentInfo
    setEllipsisStyle(el, contentInfo)
    const status = setEllipsis(contentInfo, el, contentInfo.remain)
    contentInfo.isEllipsis.status = status
    setRemainClick(el, contentInfo)

    elEllipsisInfo.observer = setElObserver(el, contentInfo)
  },
  beforeUnmount(el: HTMLElement) {
    const observer = elMap.get(el)?.observer
    if (!observer) return
    observer.unobserve(el)
  },
}

function setEllipsis(
  contentInfo: Required<IVEllipsisValue>,
  e: HTMLElement,
  remain = '',
  depth = 0
): boolean {
  const { lineHeight, line, fontWidth } = contentInfo
  const {
    height,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    borderTop,
    borderBottom,
    borderLeft,
    borderRight,
  } = getElSizeInfo(e)
  const contentHeight = Math.floor(height - paddingTop - paddingBottom - borderTop - borderBottom)
  const contentWidth = e.offsetWidth - paddingLeft - paddingRight - borderLeft - borderRight
  const fontCount = (contentWidth * line) / fontWidth
  const text =
    e.innerHTML.length > fontCount + 20 ? e.innerHTML.substring(0, fontCount + 10) : e.innerHTML
  const t = lineHeight * line
  if (depth > 100) {
    throw new Error(
      'Too much length beyond the limit. This may be caused by hot module replacement'
    )
  }
  if (contentHeight > t) {
    e.innerHTML = text.substring(0, text.length - (text.endsWith('...') ? 4 : 1)) + '...'
    depth++
    return setEllipsis(contentInfo, e, remain, depth)
  } else {
    const showEllipsis = e.innerHTML.endsWith('...')
    if (showEllipsis && remain.length > 0) {
      e.innerHTML =
        e.innerHTML.substring(0, e.innerHTML.length - remain.length - 3) +
        `...<span class="${remainClass}">${remain}</span>`
    }
    return showEllipsis
  }
}

function setEllipsisStyle(el: HTMLElement, contentInfo: Required<IVEllipsisValue>) {
  const { paddingTop, paddingBottom, borderTop, borderBottom } = getElSizeInfo(el)
  el.innerText = contentInfo.content
  el.style.overflow = 'hidden'
  el.style.minHeight = `${
    contentInfo.line * contentInfo.lineHeight +
    paddingTop +
    paddingBottom +
    borderTop +
    borderBottom
  }px`
}

function setElObserver(el: HTMLElement, contentInfo: Required<IVEllipsisValue>) {
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { target } = entry
      if (target !== el) continue
      el.innerText = contentInfo.content
      const status = setEllipsis(contentInfo, el, contentInfo.remain)
      contentInfo.isEllipsis.status = status
      setRemainClick(el, contentInfo)
    }
  })
  resizeObserver.observe(el)
  return resizeObserver
}

function setRemainClick(el: HTMLElement, contentInfo: Required<IVEllipsisValue>) {
  const spanEl = el.getElementsByClassName(remainClass)?.[0]
  if (!spanEl) return
  spanEl.addEventListener('click', (e) => {
    contentInfo.remainClick.call(spanEl, e, contentInfo)
  })
}

function handleProps(el: HTMLElement, binding: IBinding) {
  const lineHeight = getComputedStyle(el).lineHeight
  const fontSize = getComputedStyle(el).fontSize
  const letterSpacing = getComputedStyle(el).letterSpacing
  const defaultLineHeight = lineHeight.endsWith('px')
    ? parseFloat(lineHeight)
    : Math.round(parseFloat(fontSize) * parseFloat(lineHeight) * 100) / 100
  const contentInfo: Required<IVEllipsisValue> = {
    content: binding.value?.content || '',
    lineHeight: binding.value?.lineHeight || defaultLineHeight,
    line: binding.value?.line || 3,
    fontWidth: binding.value?.fontWidth || parseFloat(fontSize) + (parseFloat(letterSpacing) || 0),
    remain: binding.value?.remain || '',
    remainClick: binding.value?.remainClick || (() => {}),
    isEllipsis: binding.value.isEllipsis || { status: false },
  }
  return contentInfo
}

function getElSizeInfo(el: HTMLElement) {
  const computedStyle = getComputedStyle(el)
  const height = parseFloat(computedStyle.height)
  const fontSize = parseFloat(computedStyle.fontSize)
  const letterSpacing = parseFloat(computedStyle.letterSpacing)
  const paddingTop = parseFloat(computedStyle.paddingTop)
  const paddingBottom = parseFloat(computedStyle.paddingBottom)
  const paddingLeft = parseFloat(computedStyle.paddingLeft)
  const paddingRight = parseFloat(computedStyle.paddingRight)
  const borderTop = parseFloat(computedStyle.borderTopWidth)
  const borderBottom = parseFloat(computedStyle.borderBottomWidth)
  const borderLeft = parseFloat(computedStyle.borderLeftWidth)
  const borderRight = parseFloat(computedStyle.borderRightWidth)
  return {
    fontSize,
    height,
    letterSpacing,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    borderTop,
    borderBottom,
    borderLeft,
    borderRight,
  }
}
