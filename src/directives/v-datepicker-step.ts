import { unref, type VNode, type Ref } from 'vue'
import moment from 'moment'

const upDownIconClass = 'mx-updown-icon'
const upDownIconClassUp = 'mx-updown-icon-up'
const upDownIconClassDown = 'mx-updown-icon-down'

type DatepickerVnode = VNode & { ctx: any }
interface INeedProps {
  type?: 'date' | 'datetime' | 'year' | 'month' | 'time' | 'week'
  range?: boolean
  format?: string
  valueType?: string
  showHour?: boolean
  showMinute?: boolean
  showSecond?: boolean
  hourOptions?: Array<number>
  minuteOptions?: Array<number>
  secondOptions?: Array<number>
  hourStep?: number
  minuteStep?: number
  secondStep?: number
  disabledDate?: (date: Date, currentValue: Date[]) => boolean
  disabledTime?: (date: Date) => boolean
  'disabled-date'?: INeedProps['disabledDate']
  'disabled-time'?: INeedProps['disabledTime']
  'value-type'?: INeedProps['valueType']
  'show-hour'?: INeedProps['showHour']
  'show-minute'?: INeedProps['showMinute']
  'show-second'?: INeedProps['showSecond']
  'hour-options'?: INeedProps['hourOptions']
  'minute-options'?: INeedProps['minuteOptions']
  'second-options'?: INeedProps['secondOptions']
  'hour-step'?: INeedProps['hourStep']
  'minute-step'?: INeedProps['minuteStep']
  'second-step'?: INeedProps['secondStep']
}
interface IStepOptions {
  type: 'date' | 'datetime' | 'year' | 'month' | 'time' | 'week'
  range: boolean
  format: string
  valueType: string
  hourOptions: Array<number> | null
  minuteOptions: Array<number> | null
  secondOptions: Array<number> | null
  disabledDate: (date: Date, currentValue: Date[]) => boolean
  disabledTime: (date: Date) => boolean
}
interface IBindValue {
  bind: Record<string, any>
  key: string
  enable: boolean | Ref<boolean>
  reverse?: boolean
}
interface IElOptions {
  datepickerProps: INeedProps
  options: IStepOptions
  bindValue: IBindValue
  btns: {
    up: HTMLElement | null
    down: HTMLElement | null
  }
  originElStyle: {
    [p: string]: any
  }
}

const stepIconWidth = 24
const elOptionMap = new WeakMap<HTMLElement, IElOptions>()
const iconEventMap = new WeakMap<HTMLElement, { event: string; handler: EventListener }[]>()
const arrowEventMap = new WeakMap<
  HTMLElement,
  { mouseenter: EventListener; mouseleave: EventListener }
>()
const vDatepickerStep = {
  mounted(el: HTMLElement, binding: { value: IBindValue }, vnode: DatepickerVnode) {
    if (!hasBindValue(binding)) {
      throw new Error('The value of v-datepicker-step need a bind object and a key in bind object!')
    }
    let props = vnode?.ctx?.vnode?.ctx?.props as INeedProps
    if (!props) {
      throw new Error('Cannot read props of vue-datepicker-next component!')
    }
    props = resolveNeedProps({ ...props, range: vnode?.ctx?.props?.range })
    init(el, binding, props)
  },
  updated(el: HTMLElement, binding: { value: IBindValue }, vnode: DatepickerVnode) {
    if (!hasBindValue(binding)) {
      throw new Error('The value of v-datepicker-step need a bind object and a key in bind object!')
    }
    let props = vnode?.ctx?.vnode?.ctx?.props as INeedProps
    if (!props) {
      throw new Error('Cannot read props of vue-datepicker-next component!')
    }
    props = resolveNeedProps({ ...props, range: vnode?.ctx?.props?.range })
    const oldElOption = elOptionMap.get(el)
    if (unref(binding.value.enable)) {
      if (propsDiff(props, oldElOption?.datepickerProps) || !unref(oldElOption?.bindValue.enable)) {
        init(el, binding, props)
      }
    } else {
      oldElOption && removeIconElAndEvent(el, oldElOption)
      primaryIconOffset(el, elOptionMap.get(el) || null, true) // 还原原来的图标位置
      toggleOriginIconMouseover(el, elOptionMap.get(el) || null, false) // 去掉mouseover时设置原来的图标位置的事件
    }
    if (oldElOption) oldElOption.bindValue.enable = unref(binding.value.enable)
  },
  unmounted(el: HTMLElement) {
    const elOption = elOptionMap.get(el)
    if (!elOption) return
    removeIconElAndEvent(el, elOption)
    toggleOriginIconMouseover(el, elOption, false)
  },
}

function init(el: HTMLElement, binding: { value: IBindValue }, props: INeedProps) {
  const stepOptions = handleProps(props)
  const bindValue = {
    bind: binding.value.bind,
    key: binding.value.key,
    enable: unref(binding.value.enable),
    reverse: binding.value.reverse || false,
  }
  let elOption: IElOptions = {
    options: stepOptions,
    datepickerProps: props,
    bindValue,
    btns: { up: null, down: null },
    originElStyle: elOptionMap.get(el)?.originElStyle || {},
  }
  if (unref(elOption.bindValue.enable) && !new Set(['week']).has(props.type || '')) {
    elOption = initStepBtn(el, elOption)
    primaryIconOffset(el, elOption)
    toggleOriginIconMouseover(el, elOption)
  }
  elOptionMap.set(el, elOption)
}
function initStepBtn(el: HTMLElement, elOption: IElOptions) {
  removeIconElAndEvent(el, elOption)
  const upIcon = document.createElement('i')
  const downIcon = document.createElement('i')
  upIcon.className = `${upDownIconClass} ${upDownIconClassUp}`
  downIcon.className = `${upDownIconClass} ${upDownIconClassDown}`
  setIconStyle(upIcon, 'up')
  setIconStyle(downIcon, 'down')

  const upEvent = (e: Event) => clickEventHanlder.call(upIcon, e, 'up', elOption)
  const downEvent = (e: Event) => clickEventHanlder.call(upIcon, e, 'down', elOption)
  const upEventList = iconEventMap.get(upIcon) || []
  upEventList.push({ event: 'click', handler: upEvent })
  iconEventMap.set(upIcon, upEventList)
  const downEventList = iconEventMap.get(downIcon) || []
  downEventList.push({ event: 'click', handler: downEvent })
  iconEventMap.set(downIcon, downEventList)
  upIcon.addEventListener('click', upEvent)
  downIcon.addEventListener('click', downEvent)
  elOption.btns.up = upIcon
  elOption.btns.down = downIcon
  el.appendChild(upIcon)
  el.appendChild(downIcon)
  return elOption
}
function removeIconElAndEvent(el: HTMLElement, elOption: IElOptions) {
  const { up, down } = elOption.btns
  const iconList = [up, down].filter((item) => item) as HTMLElement[]
  for (const iconEl of iconList) {
    const iconEvents = iconEventMap.get(iconEl) || []
    iconEvents.forEach((item) => {
      iconEl.removeEventListener(item.event, item.handler)
    })

    const arrowEl = iconEl.children[0] as HTMLElement
    const arrowEvent = arrowEventMap.get(arrowEl)
    if (arrowEl?.tagName === 'SPAN' && arrowEvent) {
      for (const key in arrowEvent) {
        arrowEl.removeEventListener(key, arrowEvent[key as keyof typeof arrowEvent])
      }
    }

    if (iconEl.parentNode === el) {
      el.removeChild(iconEl)
    }
  }
}
function toggleOriginIconMouseover(
  el: HTMLElement,
  elOption: IElOptions | null,
  add: boolean = true
) {
  if (!elOption) return
  const iconOverEl = el.getElementsByClassName('mx-input-wrapper')[0] as HTMLElement
  if (!iconOverEl) return
  if (add) {
    const iconOverEvent = (e: Event) => mouseoverEvent.call(iconOverEl, e, el, elOption)
    const eventList = iconEventMap.get(iconOverEl) || []
    eventList.push({ event: 'mouseover', handler: iconOverEvent })
    iconEventMap.set(iconOverEl, eventList)
    iconOverEl.addEventListener('mouseover', iconOverEvent)
  } else {
    const eventList = iconEventMap.get(iconOverEl) || []
    eventList.forEach((item) => {
      iconOverEl.removeEventListener(item.event, item.handler)
    })
  }
}
// 鼠标移入时才对原图标进行偏移
function mouseoverEvent(e: Event, el: HTMLElement, elOption: IElOptions) {
  primaryIconOffset(el, elOption)
}
function primaryIconOffset(el: HTMLElement, elOption: IElOptions | null, reset: boolean = false) {
  if (!elOption) return
  const primIconClass = ['mx-icon-clear', 'mx-icon-calendar']
  for (const cssClass of primIconClass) {
    const iconEl = el.getElementsByClassName(cssClass)[0] as HTMLElement
    if (!iconEl) continue
    let originRight = 0
    const recordOriginRight = elOption.originElStyle.right
    if (recordOriginRight || recordOriginRight === 0) {
      originRight = recordOriginRight
    } else {
      const computedStyle = getComputedStyle(iconEl)
      originRight = parseFloat(computedStyle.right) || 8
    }
    elOption.originElStyle.right = originRight
    iconEl.style.right = `${originRight + (reset ? 0 : stepIconWidth)}px`
  }
}
function setIconStyle(el: HTMLElement, type: 'up' | 'down') {
  el.style.position = 'absolute'
  el.style.display = 'inline-block'
  el.style.lineHeight = '14px'
  el.style.top = type === 'up' ? '30%' : '70%'
  el.style.transform = 'translateY(-50%)'
  el.style.right = '8px'
  el.style.cursor = 'pointer'
  el.style.userSelect = 'none'
  const arrow = createArrow(type)
  el.appendChild(arrow)
}
function createArrow(type: 'up' | 'down') {
  const direction = type === 'up' ? 'Bottom' : 'Top'
  const arrow = document.createElement('span')
  arrow.style.display = 'inline-block'
  arrow.style.cursor = 'pointer'
  arrow.style.width = '12px'
  arrow.style.height = '12px'
  arrow.style.border = '6px solid transparent'
  arrow.style[`border${direction}Color`] = '#666666'
  arrow.style[`margin${direction}`] = '4px'
  const enterEvent = function (this: HTMLElement) {
    this.style[`border${direction}Color`] = '#999999'
  }
  const leaveEvent = function (this: HTMLElement) {
    this.style[`border${direction}Color`] = '#666666'
  }
  arrow.addEventListener('mouseenter', enterEvent)
  arrow.addEventListener('mouseleave', leaveEvent)
  arrowEventMap.set(arrow, {
    mouseenter: enterEvent,
    mouseleave: leaveEvent,
  })
  return arrow
}
function clickEventHanlder(e: Event, type: 'up' | 'down', elOptions: IElOptions) {
  const {
    bindValue: { bind, key },
    options,
  } = elOptions
  const currentValue = [bind[key]].flat().map((time) => {
    const newMoment = handleTimeCore(time, type, options, elOptions)
    return options.valueType === 'date'
      ? newMoment.toDate()
      : options.valueType === 'timestamp'
      ? newMoment.toDate().getTime()
      : newMoment.format(options.valueType)
  })
  bind[key] = options.range ? currentValue : currentValue[0]
}
// 处理时间的核心算法
function handleTimeCore(
  time: Date | string | number,
  type: 'up' | 'down',
  options: IStepOptions,
  elOptions: IElOptions
) {
  const reverse = elOptions.bindValue.reverse
  const momentTime =
    options.valueType === 'date'
      ? moment(time)
      : options.valueType === 'timestamp'
      ? moment(new Date(time))
      : moment(time, options.valueType)
  const noHms = new Set(['year', 'month', 'date', 'week']).has(options.type) // 年 月 日 周 没有时分秒
  const secondIndex = noHms ? -1 : getHmsIndex(momentTime, options.secondOptions, 'second')
  const minuteIndex = noHms ? -1 : getHmsIndex(momentTime, options.minuteOptions, 'minute')
  const hourIndex = noHms ? -1 : getHmsIndex(momentTime, options.hourOptions, 'hour')
  const date = new Set(['year', 'month', 'time', 'week']).has(options.type) ? -1 : momentTime.date() // 年 月 时间 周 没有日期
  const month = new Set(['year', 'time', 'week']).has(options.type) ? -1 : momentTime.month() // 年 时间 周 没有月份
  const year = new Set(['time']).has(options.type) ? -1 : momentTime.year() // 时间 没有年份
  const reverseList = [
    {
      index: secondIndex,
      nextIndex: secondIndex,
      carry: false,
      key: 'second' as const,
      lastEndIndex: (options.secondOptions?.length || 0) - 1,
      currentStartIndex: 0,
      currentEndIndex: (options.secondOptions?.length || 0) - 1,
      getValue: (index: number) => options.secondOptions?.[index] || 0,
    },
    {
      index: minuteIndex,
      nextIndex: minuteIndex,
      carry: false,
      key: 'minute' as const,
      lastEndIndex: (options.minuteOptions?.length || 0) - 1,
      currentStartIndex: 0,
      currentEndIndex: (options.minuteOptions?.length || 0) - 1,
      getValue: (index: number) => options.minuteOptions?.[index] || 0,
    },
    {
      index: hourIndex,
      nextIndex: hourIndex,
      carry: false,
      key: 'hour' as const,
      lastEndIndex: (options.hourOptions?.length || 0) - 1,
      currentStartIndex: 0,
      currentEndIndex: (options.hourOptions?.length || 0) - 1,
      getValue: (index: number) => options.hourOptions?.[index] || 0,
    },
    {
      index: date,
      nextIndex: date,
      carry: false,
      key: 'date' as const,
      lastEndIndex: getDaysByMonth(year, month === 0 ? 12 : month),
      currentStartIndex: 1,
      currentEndIndex: getDaysByMonth(year, month + 1),
      getValue: (index: number) => index,
    },
    {
      index: month,
      nextIndex: month,
      carry: false,
      key: 'month' as const,
      lastEndIndex: 11,
      currentStartIndex: 0,
      currentEndIndex: 11,
      getValue: (index: number) => index,
    },
    {
      index: year,
      nextIndex: year,
      carry: false,
      key: 'year' as const,
      lastEndIndex: year + 100,
      currentStartIndex: year - 100,
      currentEndIndex: year + 100,
      getValue: (index: number) => index,
    },
  ]
  for (let index = 0; index < reverseList.length; index++) {
    const item = reverseList[index]
    if (item.index < 0) continue // handleProps返回的xxxxxxOptions 和 getHmsIndex保证了从低位开始，没有显示位的index是-1，可以跳过
    const lastBitItemCarry = index > 0 ? reverseList[index - 1].carry : false // 低一位是否有进位
    // 低一位的索引有效（代表至少是当前时间的最低位），且没有进位，后面都不用算了
    if (reverseList[index - 1]?.index >= 0 && !lastBitItemCarry) break
    if (type === (reverse ? 'down' : 'up')) {
      item.carry = item.index - 1 < item.currentStartIndex
      item.nextIndex = item.carry ? item.lastEndIndex : item.index - 1
    } else {
      item.carry = item.index + 1 > item.currentEndIndex
      item.nextIndex = item.carry ? item.currentStartIndex : item.index + 1
    }
  }
  const newMoment = moment(new Date(0))
  for (const item of [...reverseList].reverse()) {
    if (item.index < 0) continue
    newMoment[item.key](item.getValue(item.nextIndex))
  }
  const newMomentDateDisable = options.disabledDate.call(
    null,
    newMoment.toDate(),
    [elOptions.bindValue.bind[elOptions.bindValue.key]].flat()
  )
  const newMomentTimeDisable = options.disabledTime.call(null, newMoment.toDate())
  const isDisable = newMomentDateDisable || newMomentTimeDisable
  return isDisable ? momentTime : newMoment
}
function getHmsIndex(
  time: moment.Moment,
  options: number[] | null,
  type: 'second' | 'minute' | 'hour'
) {
  if (!options) return -1
  const value = time[type]()
  return binarySearch(options, value) - 1
}
function binarySearch(list: any[], value: number): number {
  let left: number = 0
  let right: number = list.length
  while (left < right) {
    const midIndex: number = (left + right) >> 1
    const midVlaue: number = list[midIndex]
    if (midVlaue <= value) {
      left = midIndex + 1
    } else {
      right = midIndex
    }
  }
  return left
}
function resolveNeedProps(props: INeedProps): INeedProps {
  return {
    type: props.type,
    range: props.range,
    format: props.format,
    valueType: props.valueType || props['value-type'],
    showHour: props.showHour || props['show-hour'],
    showMinute: props.showMinute || props['show-minute'],
    showSecond: props.showSecond || props['show-second'],
    hourOptions: props.hourOptions || props['hour-options'],
    minuteOptions: props.minuteOptions || props['minute-options'],
    secondOptions: props.secondOptions || props['second-options'],
    hourStep: props.hourStep || props['hour-step'],
    minuteStep: props.minuteStep || props['minute-step'],
    secondStep: props.secondStep || props['second-step'],
    disabledDate: props.disabledDate || props['disabled-date'],
    disabledTime: props.disabledTime || props['disabled-time'],
  }
}
function propsDiff(newProps: INeedProps, oldProps?: INeedProps) {
  if (!oldProps) return true
  const keys = Object.keys(oldProps) as (keyof INeedProps)[]
  return !keys.every((key) => oldProps[key] === newProps[key])
}
function handleProps(props: INeedProps): IStepOptions {
  const {
    type,
    range,
    format,
    valueType,
    showHour,
    showMinute,
    showSecond,
    hourOptions,
    minuteOptions,
    secondOptions,
    hourStep,
    minuteStep,
    secondStep,
    disabledDate,
    disabledTime,
  } = props
  const innerType = type || 'date'
  const innerRange = typeof range === 'boolean' ? range : false
  const innerFormat = format || 'YYYY-MM-DD'
  const innerShowHour =
    (showHour as any) === ''
      ? true
      : typeof showHour === 'boolean'
      ? showHour
      : /^.*H{1,2}.*$/.test(format || '')
  const innerShowMinute =
    (showMinute as any) === ''
      ? true
      : typeof showMinute === 'boolean'
      ? showMinute
      : /^.*m{1,2}.*$/.test(format || '')
  const innerShowSecond =
    (showSecond as any) === ''
      ? true
      : typeof showSecond === 'boolean'
      ? showSecond
      : /^.*s{1,2}.*$/.test(format || '')
  const showFlag =
    innerType === 'datetime' || innerType === 'time'
      ? Number(`0b${Number(innerShowHour)}${Number(innerShowMinute)}${Number(innerShowSecond)}`)
      : 0b000
  let innerHourStep = parseInt(`${hourStep || 0}`)
  innerHourStep = innerHourStep > 0 && innerHourStep < 60 ? innerHourStep : 1
  let innerMinuteStep = parseInt(`${minuteStep || 0}`)
  innerMinuteStep = innerMinuteStep > 0 && innerMinuteStep < 60 ? innerMinuteStep : 1
  let innerSecondStep = parseInt(`${secondStep || 0}`)
  innerSecondStep = innerSecondStep > 0 && innerSecondStep < 60 ? innerSecondStep : 1
  const innerHourOptions = Array.isArray(hourOptions)
    ? filterTimeOptions(hourOptions)
    : calculateTimeOptions(innerHourStep, 'hour')
  const innerMinuteOptions = Array.isArray(minuteOptions)
    ? filterTimeOptions(minuteOptions)
    : calculateTimeOptions(innerMinuteStep, 'minute')
  const innerSecondOptions = Array.isArray(secondOptions)
    ? filterTimeOptions(secondOptions)
    : calculateTimeOptions(innerSecondStep, 'second')
  return {
    type: innerType,
    range: innerRange,
    format: innerFormat,
    valueType: valueType === 'format' ? innerFormat : valueType || 'date',
    hourOptions: showFlag & 0b111 ? innerHourOptions : null,
    minuteOptions: showFlag & 0b011 ? innerMinuteOptions : null,
    secondOptions: showFlag & 0b001 ? innerSecondOptions : null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    disabledDate: disabledDate || ((date: Date, currentValue: Date[]) => false),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    disabledTime: disabledTime || ((date: Date) => false),
  }
}
function filterTimeOptions(options: any[]): number[] {
  const filtered = options.filter((item) => typeof item === 'number' && item >= 0 && item < 60)
  return filtered.length > 0 ? filtered : new Array(60).fill(0).map((item, index) => index)
}
function calculateTimeOptions(step: number, type: 'hour' | 'minute' | 'second') {
  const max = type === 'hour' ? 24 : 60
  step = parseInt(`${step || 0}`) || 0
  step = step > 0 && step < max ? step : 1
  const result = [0]
  while (result[result.length - 1] + step < max) {
    result.push(result[result.length - 1] + step)
  }
  return result
}
function hasBindValue(binding: { value: IBindValue }) {
  const bindValue = { ...binding.value }
  bindValue.enable = typeof unref(bindValue.enable) !== 'boolean' ? true : unref(bindValue.enable)
  return (
    bindValue &&
    Object.prototype.toString.call(bindValue.bind) === '[object Object]' &&
    bindValue.key &&
    bindValue.bind[bindValue.key] !== undefined
  )
}
function isLeap(year: number) {
  if ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0) {
    return true
  }
  return false
}
function getDaysByMonth(fullYear: number, month: number) {
  let days = 30
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      days = 31
      break
    case 2:
      days = isLeap(fullYear) ? 29 : 28
      break
    default:
      days = 30
  }
  return days
}

export default vDatepickerStep
