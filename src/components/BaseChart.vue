<script setup lang="ts" generic="T">
import { ref, shallowReactive, watch, onMounted } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { useResizeObserver } from '@vueuse/core'

const props = defineProps<{
  data: T
  options: EChartsOption
}>()

/* eslint-disable */
const emits = defineEmits<{
  (e: 'data-change', chart: echarts.ECharts, data: T, oldData: T, options: EChartsOption): void
}>()
/* eslint-enable */

const chartEl = ref<HTMLElement>()

const chart = shallowReactive({
  echart: null as echarts.ECharts | null,
  observerHandler: null as ReturnType<typeof useResizeObserver> | null,
})

watch(
  () => props.data,
  (newData, oldData) => {
    if (chart.echart) {
      emits('data-change', chart.echart as echarts.ECharts, newData, oldData, props.options)
    }
  }
)

onMounted(() => {
  init()
  resizeObserver()
})
onBeforeUnmount(() => {
  destoryChart()
  chart.observerHandler?.stop()
})

function init() {
  if (!chartEl.value || !chartEl.value?.clientHeight || !chartEl.value?.clientWidth) return
  chart.echart = echarts.init(chartEl.value)
  props.options && chart.echart.setOption(props.options)
  emits('data-change', chart.echart as echarts.ECharts, props.data, props.data, props.options)
}
function destoryChart() {
  chart.echart?.dispose()
}

watch(
  () => props.options,
  () => {
    destoryChart()
    init()
  }
)

// 监听图表容器尺寸变化
function resizeObserver() {
  if (!chartEl.value) return
  let oldWidth = ''
  let oldHeight = ''
  chart.observerHandler = useResizeObserver(chartEl.value, (entries) => {
    const entry = entries[0]
    const { width, height } = entry.contentRect
    const widthStr = width.toFixed(0)
    const heightStr = height.toFixed(0)
    if (widthStr !== oldWidth || heightStr !== oldHeight) {
      if (chart.echart) {
        chart.echart.resize()
      } else {
        init()
      }
    }
    oldWidth = widthStr
    oldHeight = heightStr
  })
}

function exportAsImage(
  fname: string,
  options: {
    // 导出的格式，可选 png, jpg, svg
    // 注意：png, jpg 只有在 canvas 渲染器的时候可使用，svg 只有在使用 svg 渲染器的时候可用
    type?: 'svg' | 'png' | 'jpeg'
    // 导出的图片分辨率比例，默认为 1。
    pixelRatio?: number
    // 导出的图片背景色，默认使用 option 里的 backgroundColor
    backgroundColor?: string
    // 忽略组件的列表，例如要忽略 toolbox 就是 ['toolbox']
    excludeComponents?: Array<string>
  }
) {
  if (!chart.echart) return
  const dataUrl = chart.echart.getDataURL({
    pixelRatio: window.devicePixelRatio,
    ...options,
  })
  download(fname, dataUrl)
}
/**
 * 下载url或blob
 * @param filename
 * @param file
 */
function download(filename: string, file: string | Blob) {
  const a = document.createElement('a')
  // blob.type = "application/octet-stream";
  filename = filename || '1'
  // @ts-ignore
  if (window.navigator.msSaveBlob) {
    try {
      // @ts-ignore
      window.navigator.msSaveBlob(file, filename)
    } catch (e) {
      console.log(e)
    }
  } else {
    const url = typeof file === 'string' ? file : window.URL.createObjectURL(file)
    a.href = url
    a.download = filename
    document.body.appendChild(a) // 火狐浏览器 必须把元素插入body中
    a.click()
    document.body.removeChild(a)
    // 释放之前创建的URL对象
    typeof file !== 'string' && window.URL.revokeObjectURL(url)
  }
}

defineExpose({
  getChart: () => chart.echart,
  exportAsImage,
})
</script>

<template>
  <div class="chart-container">
    <div class="chart-el" ref="chartEl" />
  </div>
</template>

<style scoped lang="scss">
.chart-container {
  width: 100%;
  height: 100%;

  .chart-el {
    width: 100%;
    height: 100%;
  }
}
</style>
