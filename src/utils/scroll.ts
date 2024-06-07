import type { ElScrollbar } from 'element-plus'
// 滚动动画
const EaseInOutQuad = function (t: number, b: number, c: number, d: number) {
  t /= d / 2
  if (t < 1) {
    return (c / 2) * t * t + b
  }
  t--
  return (-c / 2) * (t * (t - 2) - 1) + b
}
const requestAnimFrame = (function () {
  return (
    window.requestAnimationFrame ||
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.webkitRequestAnimationFrame ||
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.mozRequestAnimationFrame ||
    function (callback) {
      window.setTimeout(callback, 1000 / 60)
    }
  )
})()
function move(vueCom: typeof ElScrollbar, key: 'scrollTop' | 'scrollLeft', amount: number) {
  if (key === 'scrollTop') {
    vueCom.setScrollTop(amount)
  }
  if (key === 'scrollLeft') {
    vueCom.setScrollLeft(amount)
  }
}
function position(el: HTMLElement, key: 'scrollTop' | 'scrollLeft') {
  const scrollDistance = el[key]
  return scrollDistance
}
export function scrollTo({
  scrollbarCom,
  el,
  to,
  duration,
  scrollKey,
  callback
}: {
  scrollbarCom: typeof ElScrollbar
  el: HTMLElement
  to: number
  duration: number
  scrollKey?: 'scrollTop' | 'scrollLeft'
  // eslint-disable-next-line
  callback?: (to: number) => void;
}) {
  if (!el) return null
  to = to || 0
  scrollKey = scrollKey || 'scrollTop'
  duration = typeof duration === 'undefined' ? 500 : duration
  const start = position(el, scrollKey)
  const change = to - start
  const increment = 20
  let currentTime = 0
  const animateScroll = function () {
    currentTime += increment
    if (currentTime < duration) {
      const val: number = EaseInOutQuad(currentTime, start, change, duration)
      move(scrollbarCom, scrollKey!, val)
      requestAnimFrame(animateScroll)
    } else {
      move(scrollbarCom, scrollKey!, to)
      if (callback && typeof callback === 'function') {
        callback(to)
      }
    }
  }
  animateScroll()
}
