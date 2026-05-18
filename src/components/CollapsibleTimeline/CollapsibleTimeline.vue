<script setup lang="ts">
import moment from 'moment'
import { ElSlider } from 'element-plus'
import { useResizeObserver } from '@vueuse/core'
import pauseIcon from './assets/pause.png'
import runIcon from './assets/run.png'

interface IDayListItem {
  date: string
  dayMillisecond: number
  day: string
  week: string
}

interface ITimeListItem {
  dayMillisecond: number
  date: string
  time: string
}

const defaultTimeFormatter = 'YYYYMMDDHHmm'
const props = withDefaults(
  defineProps<{
    timeFormatter?: string
    origin?: string
    start?: string
    selected: string
    days?: number
    endEqual?: boolean // 结束时时刻是否包含开始那天的起始HH:mm
    interval?: number
    labelSpaceScale?: number
    blur?: string // 背景模糊程度，不应根据vw变化
    useVw?: boolean // 不使用vw时，要设置为false，开启尺寸变化监听，自动处理标签间距
  }>(),
  {
    timeFormatter: defaultTimeFormatter,
    origin: moment().minute(0).hour(0).format(defaultTimeFormatter),
    start: moment().minute(0).hour(0).format(defaultTimeFormatter),
    days: 6,
    endEqual: true,
    interval: 60,
    labelSpaceScale: 0.4,
    blur: '6px',
    useVw: true,
  }
)
const cssBlur = computed(() => `blur(${props.blur})`)
const emits = defineEmits<{
  (e: 'update:selected', value: string): void
  (e: 'update:start', value: string): void
  (e: 'timeline-change', selectTime: string, timeList: ITimeListItem[], formatStr: string): void
}>()

// 这是这个组件唯一的标准内部状态，el-slider的值、当前展开哪天都基于它
const innerSelected = computed({
  get() {
    return props.selected
  },
  set(value: string) {
    emits('update:selected', value)
  },
})

// 起报 时刻，这样写只是为了使外界能够通过v-model的方式拿到 起报 时刻的值
const innerDefaultTime = computed({
  get() {
    return props.start
  },
  set(value: string) {
    emits('update:start', value)
  },
})

// 时间轴选择的时刻，真正的 起报 时刻
const innerOriginTime = ref('')
watch(
  () => props.origin,
  (newOrigin) => {
    innerOriginTime.value = newOrigin
  },
  { immediate: true }
)
watch(
  innerOriginTime,
  (newDate) => {
    innerDefaultTime.value = newDate
  },
  { immediate: true }
)
// // 预留：还原 innerOriginTime 为 props.origin
// function refreshInnerOriginTime() {
//   innerOriginTime.value = props.origin
// }
// // 预留，时间选择器禁用时间
// function disableDate(date: Date) {
//   if (!props.origin) return false
//   const originDate = moment(props.origin, props.timeFormatter).toDate()
//   return date > originDate
// }

const weekMap = ['日', '一', '二', '三', '四', '五', '六']
const getWeek = (todayMoment: moment.Moment, date: moment.Moment) => {
  const difference = date.diff(todayMoment.hour(0).minute(0).second(0).millisecond(0), 'day')
  return difference === 0 ? '今日' : difference === 1 ? '明日' : `周${weekMap[date.day()]}`
}
// 完整的时间序列
const fullTimeList = computed(() => {
  const result: ITimeListItem[] = []
  const currentMoment = moment(innerOriginTime.value, props.timeFormatter).second(0).millisecond(0)
  const endMoment = currentMoment.clone().add(props.days, 'day').second(0).millisecond(0)
  do {
    result.push({
      date: currentMoment.format(props.timeFormatter),
      dayMillisecond: currentMoment.clone().hour(0).minute(0).second(0).millisecond(0).valueOf(),
      time: currentMoment.format('HH:mm'),
    })
    currentMoment.add(props.interval, 'minute')
  } while (props.endEqual ? !currentMoment.isAfter(endMoment) : currentMoment.isBefore(endMoment))
  return result
})
// 天列表
const dayList = computed(() => {
  const result: IDayListItem[] = []
  const dayTimeListMap = new Map<number, ITimeListItem[]>()
  for (const item of fullTimeList.value) {
    const list = dayTimeListMap.get(item.dayMillisecond) || []
    list.push(item)
    dayTimeListMap.set(item.dayMillisecond, list)
  }
  const dayMillisecondList = [...dayTimeListMap.keys()]
  dayMillisecondList.forEach((millisecond, index) => {
    const date = moment(millisecond)
    result.push({
      date: date.format(props.timeFormatter),
      dayMillisecond: date.valueOf(),
      day: date.format('MM/DD'),
      week: getWeek(moment(), date.clone()),
    })
  })
  return result
})
// 当前展开的一天的时间序列
const currentDayTimelist = computed(() => {
  const selectedTimeItem = fullTimeList.value.find((item) => item.date === innerSelected.value)
  if (!selectedTimeItem) return []
  return fullTimeList.value.filter(
    (item) => selectedTimeItem.dayMillisecond === item.dayMillisecond
  )
})
// 辅助判断是否需要展开
const needUnfold = (dayItem: IDayListItem) => {
  const selectedTimeItem = fullTimeList.value.find((item) => item.date === innerSelected.value)
  if (!selectedTimeItem) return false
  return selectedTimeItem.dayMillisecond === dayItem.dayMillisecond
}
// 初始化时，设置默认值
watch(
  fullTimeList,
  (newList) => {
    if (!innerSelected.value && newList.length) {
      innerSelected.value = newList[0].date
    }
    nextTick(() => {
      emits('timeline-change', innerSelected.value, newList, props.timeFormatter)
    })
  },
  { immediate: true }
)

// 当前展开的一天的时间序列对应的下标
const elSliderMarks = ref<Record<number, string>>({})
let dayWidth = 0 // 正常情况下，它只会被设置一次
// 动态获取label间隔
const getLabelInterval = (newList: ITimeListItem[]) => {
  const measureEl = document.querySelector('.collapsible-timeline .measure-test')
  const totalEl = document.querySelector('.collapsible-timeline .timeline-main')
  if (!dayWidth) {
    const dayEl = document.querySelector('.collapsible-timeline .day-placeholder:not(.unfold)')
    if (dayEl) dayWidth = parseFloat(getComputedStyle(dayEl).width)
  }
  let intervalCount = 0
  if (measureEl && totalEl) {
    const textWidth = getTextWidth({
      size: parseFloat(getComputedStyle(measureEl).fontSize),
      text: newList[0]?.time || '',
    })
    const totalElStyle = getComputedStyle(totalEl)
    const sliderWidth =
      parseFloat(totalElStyle.width) -
      parseFloat(totalElStyle.paddingLeft) -
      parseFloat(totalElStyle.paddingRight) -
      dayWidth * props.days
    const firstLabelAndSpaceMinWidth = textWidth * (1 + Math.max(props.labelSpaceScale, 0))
    let space = 0
    do {
      intervalCount++
      if (intervalCount >= newList.length) break
      // 按当前intervalCount值，第一个时刻文本起始位置和第二个时刻起始位置的距离，用这个距离跟想要它占据的最小宽度对比决定intervalCount
      space = (sliderWidth / newList.length) * intervalCount - textWidth / 2
    } while (space < firstLabelAndSpaceMinWidth)
  }
  return intervalCount ? intervalCount : 1
}
const setElSliderMarks = (newList: ITimeListItem[]) => {
  const cfg: Record<number, string> = {}
  const labelInterval = getLabelInterval(newList)
  for (const [index, item] of newList.entries()) {
    if (index % labelInterval === 0) {
      cfg[index] = item.time
    }
  }
  elSliderMarks.value = cfg
}
watch(
  currentDayTimelist,
  (newList) => {
    setElSliderMarks(newList)
  },
  { immediate: true }
)
// 监听容器尺寸变化
const timelineMainRef = ref<HTMLElement | null>(null)
const observerHandler = shallowRef<ReturnType<typeof useResizeObserver> | null>(null)
function resizeObserver(isInit = true) {
  if (!timelineMainRef.value) return
  let oldWidth = ''
  let oldHeight = ''
  removeObserver()
  observerHandler.value = useResizeObserver(timelineMainRef.value, (entries) => {
    const entry = entries[0]
    const { width, height } = entry.contentRect
    const widthStr = width.toFixed(2)
    const heightStr = height.toFixed(2)
    if (widthStr !== oldWidth || heightStr !== oldHeight) {
      if (!isInit) {
        setElSliderMarks(currentDayTimelist.value)
      }
      isInit = false
    }
    oldWidth = widthStr
    oldHeight = heightStr
  })
}
function removeObserver() {
  observerHandler.value && observerHandler.value.stop()
}
onMounted(() => !props.useVw && resizeObserver())
onBeforeUnmount(() => removeObserver())

// el-slider的绑定值，不可手动赋值，必须由innerSelected计算得到 或 由el-slider内部赋值（sliderFullClick除外，利用sliderValue避免再写一次寻找下一天的逻辑）
const sliderValue = computed({
  get() {
    const index = currentDayTimelist.value.findIndex((item) => item.date === innerSelected.value)
    return index === -1 ? 0 : index
  },
  set(value: number) {
    const crtList = currentDayTimelist.value
    if (value === crtList.length) {
      // 找到下一天的第一个时刻，最后一个回到第一天第一个时次
      const todayLast = crtList[crtList.length - 1]
      const todayLastIndex = fullTimeList.value.findIndex((item) => item.date === todayLast.date)
      const nextDayFirst = fullTimeList.value[todayLastIndex + 1]
      innerSelected.value = nextDayFirst ? nextDayFirst.date : fullTimeList.value[0].date
    } else {
      const date = crtList[value]?.date
      innerSelected.value = date ? date : crtList[0].date
    }
  },
})

// 切换一天
const switchDay = (dayItem: IDayListItem, previousEnd = true) => {
  const selectedDay = moment(dayItem.date, props.timeFormatter)
  const crtSelMoment = moment(innerSelected.value, props.timeFormatter)
  const fullList = [...fullTimeList.value]
  if (previousEnd && selectedDay.isBefore(crtSelMoment)) fullList.reverse()
  innerSelected.value =
    fullList.find((item) => item.dayMillisecond === dayItem.dayMillisecond)?.date ||
    fullTimeList.value[0].date
}

// 实现圆圈上面的当前时间提示
const tipToolElMap = new WeakMap<HTMLElement, HTMLElement>()
const createTipTool = (parent: HTMLElement) => {
  const el = document.createElement('div')
  el.className = 'timeline-tip-tool'
  parent.appendChild(el)
  return el as HTMLElement
}
const setTipTool = (content: string) => {
  const headBtn = document.querySelector('.unfold .el-slider__button-wrapper')
  if (!headBtn) return
  let tipToolEl = tipToolElMap.get(headBtn as HTMLElement)
  if (!tipToolEl) {
    tipToolEl = createTipTool(headBtn as HTMLElement)
    tipToolElMap.set(headBtn as HTMLElement, tipToolEl)
  }
  tipToolEl.innerText = content
}
watch(
  innerSelected,
  (newVal) => {
    setTipTool(moment(newVal, props.timeFormatter).format('YYYY-MM-DD HH:mm'))
  },
  {
    flush: 'post',
  }
)

const runing = ref(false)
let runingTimer: ReturnType<typeof setInterval> | null = null
const runingIcon = computed(() => (runing.value ? pauseIcon : runIcon))
// 上一个，下一个
function nextAndPrevTick(type: 'prev' | 'next') {
  if (!fullTimeList.value.length) return
  let nextIndex = 0
  const currentIndex = fullTimeList.value.findIndex((item) => item.date === innerSelected.value)
  if (type === 'next' || currentIndex === -1) {
    nextIndex = (currentIndex + 1) % fullTimeList.value.length
  } else {
    nextIndex = currentIndex - 1
    nextIndex = nextIndex < 0 ? fullTimeList.value.length - 1 : nextIndex
  }
  innerSelected.value = fullTimeList.value[nextIndex]?.date || fullTimeList.value[0].date
}
// 上一天，下一天
function nextAndPrevDay(type: 'prev' | 'next') {
  const currentTimeItem = fullTimeList.value.find((item) => item.date === innerSelected.value)
  if (!currentTimeItem) return
  let nextIndex = 0
  const currentIndex = dayList.value.findIndex(
    (item) => item.dayMillisecond === currentTimeItem.dayMillisecond
  )
  if (type === 'next' || currentIndex === -1) {
    nextIndex = (currentIndex + 1) % dayList.value.length
  } else {
    nextIndex = currentIndex - 1
    nextIndex = nextIndex < 0 ? dayList.value.length - 1 : nextIndex
  }
  const nextDayItem = dayList.value[nextIndex]
  const fullList = [...fullTimeList.value]
  if (type === 'prev') fullList.reverse()
  innerSelected.value =
    fullList.find((item) => nextDayItem.dayMillisecond === item.dayMillisecond)?.date ||
    fullTimeList.value[0].date
}
// 播放暂停
function clickRuning() {
  runing.value = !runing.value
  if (runing.value) {
    nextAndPrevTick('next')
    runingTimer = setInterval(() => {
      nextAndPrevTick('next')
    }, 500)
  } else {
    runingTimer && clearInterval(runingTimer)
  }
}

function getTextWidth({ size, text }: { size: number; text: string }) {
  const canvas = document.createElement('canvas') as HTMLCanvasElement
  canvas.width = size * (text.length + 2)
  canvas.height = size * 2
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = `${size}px 'Microsoft YaHei', Avenir, Helvetica, Arial, sans-serif`

  const textStr = `${text}`
  // 测量文本真实占用的像素宽度
  const metrics = ctx.measureText(textStr)
  return metrics.width
}

const mouseTitle = ref('')
function getClickNearItem(e: MouseEvent) {
  const target = e.target as HTMLElement
  let el = target
  while (el && !el.classList.contains('desc-day')) {
    el = el.parentElement as HTMLElement
  }
  const rect = el.getBoundingClientRect()
  const width = rect.width
  const halfTickWidth = width / (currentDayTimelist.value.length * 2)
  const left = e.clientX - rect.left + halfTickWidth
  const index = Math.floor(left / (halfTickWidth * 2))
  const item = currentDayTimelist.value[index]
  return item
}
function sliderFullMousemove(e: MouseEvent) {
  const item = getClickNearItem(e)
  if (item?.date) {
    mouseTitle.value = moment(item.date, props.timeFormatter).format('YYYY-MM-DD HH:mm')
  } else {
    mouseTitle.value = ''
  }
}
function sliderFullClick(e: MouseEvent) {
  const item = getClickNearItem(e)
  if (item?.date) {
    innerSelected.value = item.date
  } else {
    // 最后一个半段没有对应的时间了，直接去下一天
    sliderValue.value = currentDayTimelist.value.length
  }
}
</script>

<template>
  <div class="collapsible-timeline">
    <div class="timeline-ctrl">
      <div class="btns-container">
        <div class="ctrl-icon" @click="() => nextAndPrevDay('prev')">
          <img src="./assets/prev-day.png" />
        </div>
        <div class="ctrl-icon" @click="() => nextAndPrevTick('prev')">
          <img src="./assets/previous.png" />
        </div>
        <div class="ctrl-icon" @click="() => clickRuning()">
          <img height="18" :src="runingIcon" />
        </div>
        <div class="ctrl-icon" @click="() => nextAndPrevTick('next')">
          <img src="./assets/next.png" />
        </div>
        <div class="ctrl-icon" @click="() => nextAndPrevDay('next')">
          <img src="./assets/next-day.png" />
        </div>
      </div>
    </div>
    <div class="timeline-main" ref="timelineMainRef">
      <div
        class="day-placeholder"
        :class="{ unfold: needUnfold(item) }"
        v-for="item in dayList"
        :key="item.date"
      >
        <div
          class="desc-day"
          @click="sliderFullClick"
          @mousemove="sliderFullMousemove"
          :title="mouseTitle"
          v-show="needUnfold(item)"
        >
          <el-slider
            v-model="sliderValue"
            :marks="elSliderMarks"
            :min="0"
            :max="currentDayTimelist.length"
            :show-tooltip="false"
            @click.stop
          />
          <div class="desc-week">{{ item.week }}&ensp;{{ item.day }}</div>
        </div>
        <div class="simple-day" @click="switchDay(item)" v-show="!needUnfold(item)">
          <div class="day-slider"></div>
          <div class="day-date">
            <span>{{ item.day }}</span>
          </div>
          <div class="day-week">
            <span>{{ item.week }}</span>
          </div>
        </div>
      </div>
    </div>
    <!-- 隐藏元素，用来测量字体样式 -->
    <div class="measure-test" style="visibility: hidden"></div>
  </div>
</template>

<style lang="less" scoped>
.collapsible-timeline {
  --timeline-height: 74px;
  --timeline-bg: #ffffff99;
  --timeline-border: 1px solid #ffffff8f;
  --timeline-border-radius: 8px;
  --timeline-track-height: 6px;
  --line-border-radius: 3px;
  --timeline-ctrl-width: 200px;
  // 确保.measure-test和.el-slider__marks-text字体大小一致
  --timeline-marker-font-size: 11px;
  --timeline-unfold-text-color: #36394f;
  --timeline-simple-text-color: #71747a;
  --timeline-unfold-bg: #00000052;
  --timeline-unfold-bar: #3c8efa;
}
.collapsible-timeline {
  height: var(--timeline-height);
  background-color: var(--timeline-bg);
  border: var(--timeline-border);
  border-radius: var(--timeline-border-radius);
  backdrop-filter: v-bind(cssBlur);
  -webkit-backdrop-filter: v-bind(cssBlur);
  display: flex;
  .measure-test {
    font-size: var(--timeline-marker-font-size);
    position: absolute;
    pointer-events: none;
    visibility: hidden;
  }
}
.timeline-ctrl {
  width: var(--timeline-ctrl-width);
  height: 100%;
  position: relative;
  &::after {
    content: '';
    display: block;
    width: 0.5px;
    height: 90%;
    background-color: #ffffff;
    position: absolute;
    top: 50%;
    right: 0;
    transform: translateY(-50%);
  }
  .btns-container {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    .ctrl-icon {
      width: 30px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      > img {
        vertical-align: middle;
        height: 12px;
      }
      &:nth-child(3) {
        > img {
          height: 18px;
        }
      }
    }
  }
}
.timeline-main {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding-left: 24px;
  padding-right: 24px;
  display: flex;
  .day-placeholder {
    width: 48px;
    padding-left: 2px;
    transition: all 0.4s ease-in-out;
    &:first-child {
      padding-left: 0;
      .desc-day {
        :deep(.el-slider) {
          .el-slider__runway {
            border-bottom-left-radius: var(--line-border-radius);
            border-top-left-radius: var(--line-border-radius);
            .el-slider__bar {
              border-bottom-left-radius: var(--line-border-radius);
              border-top-left-radius: var(--line-border-radius);
            }
          }
        }
      }
      .simple-day {
        .day-slider {
          border-bottom-left-radius: var(--line-border-radius);
          border-top-left-radius: var(--line-border-radius);
        }
      }
    }
    &:last-child {
      .simple-day {
        .day-slider {
          border-bottom-right-radius: var(--line-border-radius);
          border-top-right-radius: var(--line-border-radius);
        }
      }
      .desc-day {
        :deep(.el-slider) {
          .el-slider__runway {
            border-bottom-right-radius: var(--line-border-radius);
            border-top-right-radius: var(--line-border-radius);
            .el-slider__bar {
              border-bottom-right-radius: var(--line-border-radius);
              border-top-right-radius: var(--line-border-radius);
            }
          }
        }
      }
    }
    &.unfold {
      flex: 1;
      min-width: 0;
    }
    .desc-day {
      padding-top: 30px;
      width: 100%;
      height: 100%;
      cursor: pointer;
      :deep(.el-slider) {
        --el-slider-runway-bg-color: var(--timeline-unfold-bg);
        --el-slider-main-bg-color: var(--timeline-unfold-bar);
        --el-slider-button-size: calc(var(--timeline-track-height) + 4px);
        height: var(--timeline-track-height);
        .el-slider__runway {
          border-radius: 0;
          .el-slider__bar {
            border-radius: 0;
          }
        }
        .el-slider__stop {
          display: none;
        }
        .el-slider__marks {
          .el-slider__marks-text {
            margin-top: 10px;
            font-size: var(--timeline-marker-font-size);
            font-family: 'AlibabaPuHuiTi_2_55';
            font-weight: 400;
            color: var(--timeline-unfold-text-color);
            &:first-child {
              transform: none;
            }
          }
        }
        .el-slider__button-wrapper {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          .el-slider__button {
            border: 1px solid #ffffff;
            --el-color-white: var(--timeline-unfold-bar);
          }
          .timeline-tip-tool {
            position: absolute;
            bottom: 73%;
            left: 50%;
            transform: translateX(-50%);
            white-space: nowrap;
            background-color: #1a1d2399;
            font-size: 11px;
            font-family: 'AlibabaPuHuiTi_2_65';
            font-weight: 500;
            color: #ffffff;
            display: flex;
            align-items: center;
            height: 20px;
            padding: 0 8px;
            border-radius: 10px;
          }
        }
      }
      .desc-week {
        padding-top: 19px;
        font-size: 10px;
        font-family: 'AlibabaPuHuiTi_2_65';
        font-weight: 500;
        color: var(--timeline-simple-text-color);
      }
    }
    .simple-day {
      padding-top: 30px;
      height: 100%;
      cursor: pointer;
      .day-slider {
        width: 100%;
        height: var(--timeline-track-height);
        background-color: #00000014;
      }
      .day-date {
        padding-top: 4px;
        font-size: var(--timeline-marker-font-size);
        font-family: 'AlibabaPuHuiTi_2_55';
        font-weight: 400;
        color: var(--timeline-simple-text-color);
      }
      .day-week {
        padding-top: 4px;
        font-size: 10px;
        font-family: 'AlibabaPuHuiTi_2_65';
        font-weight: 500;
        color: var(--timeline-simple-text-color);
      }
    }
  }
}
</style>
