import * as lodashLib from 'lodash'
import shouqiIcon from './assets/shouqi.png'
import zhankaiIcon from './assets/zhankai.png'

export interface IPackupValue {
  value: {
    designWidth?: number
    width: number
  }
}

const elementMap = new WeakMap<
  HTMLElement,
  {
    option: IPackupValue['value']
    status: boolean
    transEl: HTMLElement
    img?: HTMLImageElement
    imgClick?: (e: MouseEvent) => void
    normalWidth?: any
  }
>()

const defaultOption: IPackupValue['value'] = {
  designWidth: 1920,
  width: 100
}


export default {
  mounted(el: HTMLElement, binding: IPackupValue) {
    const option = lodashLib.mergeWith(lodashLib.cloneDeep(defaultOption), binding.value || {})
    elementMap.set(el, { option, status: false, transEl: el.children[0] as HTMLElement })
    // 设置子级元素尺寸
    setTargetSize(el, option)
    // 为元素添加初始状态
    setInitStatus(el, option)
    // 添加事件
    initIconEvent(el)
  },
  unmounted(el: HTMLElement) {
    removeIcon(el)
  }
}

function setTargetSize(el: HTMLElement, option: Required<IPackupValue['value']>) {
  const elBindInfo = elementMap.get(el)
  if (!elBindInfo) return
  if (!elBindInfo.transEl) return
  const contentWidth = `${option.width / (option.designWidth || 100) * 100}vw`
  elBindInfo.transEl.style.width = contentWidth
  elBindInfo.normalWidth = contentWidth
  if (elBindInfo.transEl.children.length > 0) {
    Array.prototype.forEach.call(elBindInfo.transEl.children, (fixChild) => {
      fixChild.style.width = contentWidth
    })
  }
}

function setInitStatus(el: HTMLElement, option: Required<IPackupValue['value']>) {
  const elBindInfo = elementMap.get(el)
  if (!elBindInfo) return
  const computedStyle = getComputedStyle(el)
  const paddingTop = parseFloat(computedStyle.paddingTop)
  const packupImg = document.createElement('img')
  el.style.position = 'relative'
  el.style.flex = 'unset'
  el.style.width = 'unset'
  el.style.minWidth = 'unset'
  packupImg.style.position = 'absolute'
  packupImg.style.top = `${paddingTop / (option.designWidth || 100) * 100}vw`
  packupImg.style.left = '0'
  packupImg.style.transform = 'translateX(-100%)'
  packupImg.style.cursor = 'pointer'
  packupImg.style.width = `${16 / (option.designWidth || 100) * 100}vw`
  packupImg.style.height = `${38 / (option.designWidth || 100) * 100}vw`
  packupImg.src = elBindInfo.status ? zhankaiIcon : shouqiIcon
  el.appendChild(packupImg)
  elBindInfo.img = packupImg
  if (elBindInfo.transEl) {
    elBindInfo.transEl.style.overflow = 'hidden'
    elBindInfo.transEl.style.transition = 'all 0.3s ease-in-out'
  }
}
function initIconEvent(el: HTMLElement) {
  const elBindInfo = elementMap.get(el)
  if (!elBindInfo) return
  const { transEl, normalWidth, img } = elBindInfo
  if (!transEl || !img || !normalWidth) return
  elBindInfo.imgClick = function (this: HTMLImageElement) {
    if (elBindInfo.status) {
      transEl.style.width = normalWidth
      this.src = shouqiIcon
    } else {
      transEl.style.width = '0'
      this.src = zhankaiIcon
    }
    elBindInfo.status = !elBindInfo.status
  }
  img.addEventListener('click', elBindInfo.imgClick)
}
function removeIcon(el: HTMLElement) {
  const elBindInfo = elementMap.get(el)
  if (!elBindInfo) return
  if (!elBindInfo.img) return
  if (!elBindInfo.imgClick) return
  elBindInfo.img.removeEventListener('click', elBindInfo.imgClick)
  el.removeChild(elBindInfo.img)
}
