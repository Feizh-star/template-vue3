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
  (e: "data-change", chart: echarts.ECharts, data: T, oldData: T, options: EChartsOption): void;
}>()
/* eslint-enable */

const chartEl = ref<HTMLElement>()
const chart = shallowReactive({
  echart: null as echarts.ECharts | null,
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

function init() {
  if (!chartEl.value || !chartEl.value?.clientHeight || !chartEl.value?.clientWidth) return
  chart.echart = echarts.init(chartEl.value)
  props.options && chart.echart.setOption(props.options)
  emits('data-change', chart.echart as echarts.ECharts, props.data, props.data, props.options)
}

// 监听图表容器尺寸变化
function resizeObserver() {
  if (!chartEl.value) return
  let oldWidth = ''
  let oldHeight = ''
  useResizeObserver(chartEl.value, (entries) => {
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

defineExpose({
  getChart: () => chart.echart,
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
