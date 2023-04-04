<script setup lang="ts">
import { defaultStyle } from '@/style/variables'
import { debounce } from '@/utils/tools'
import Highcharts from 'highcharts'
import vScaleSize from '@/directives/scaleSize'

export interface IProps {
  doughnutData: Array<{
    name: string,
    color: string,
    type: string,
    value: number
  }>
  computeTitle?: (data: any[]) => string
  theme: string
  count: number
  total: number
  unit: string
}

const props = withDefaults(defineProps<IProps>(), {
  doughnutData: () => [
    { name: '在线', color: defaultStyle.textHcolor, value: 10, type: 'used' },
    { name: '离线', color: '#c7d4e3',value: 10, type: 'remain' },
  ],
  computeTitle: (data: any[]) => {
    const online = data.find(item => item.type === 'used')
    const all = data.reduce((sum, item) => {
      return sum + item.y
    }, 0)
    return all > 0 ? 
      (online.y / all * 100).toFixed(0) + '%' : 
      '0%'
  },
  count: 0,
  total: 0
})

const _setChartTitle = debounce(setChartTitle, 300)
onMounted(() => {
  setChartTitle()
  window.addEventListener('resize', _setChartTitle)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', _setChartTitle)
})

// 图表
let chart: any
const doughnutRef = ref()
watch(() => props.doughnutData, (newVal, oldVal) => {
  if (chart && newVal !== oldVal) updateChart()
})
onMounted(() => doughnut())
/**
 * 初始化图表
 */
function doughnut() {
  chart = Highcharts.chart(doughnutRef.value, {
      accessibility: {
        enabled: false,
      },
      chart: {
          spacing : [8, 0 , 8, 0],
          backgroundColor: 'rgba(0, 0, 0, 0)'
      },
      title: {
          floating:true,
          text: ''
      },
      tooltip: {
          pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
      },
      plotOptions: {
        pie: {
            allowPointSelect: true,
            cursor: 'pointer',
            dataLabels: {
                enabled: false,
                format: '<b>{point.name}</b>: {point.percentage:.1f} %',
                style: {
                    color: (Highcharts.theme && (Highcharts.theme as any).contrastTextColor) || 'black'
                }
            },
        },
        series: {
          states: {
            inactive: {
              opacity: 1 // 当其他系列鼠标悬浮高亮时，自身的透明度
            }
          }
        }
      },
      series: [{
          type: 'pie',
          innerSize: '80%',
          name: '比例',
          data: []
      }]
  }, function(c) { // 图表初始化完毕后的回调函数
      // 环形图圆心
      var centerY = (c.series[0] as any).center[1],
          titleHeight = parseInt((c.title as any).styles.fontSize);
      // 动态设置标题位置
      c.setTitle({
          y: centerY + titleHeight/2
      });
  });
  updateChart()
}
/**
 * 更新图表数据
 */
function updateChart() {
  if (!chart) return
  const series = chart.series[0]
  const data = getFormatChartData()
  series.setData(data)
  setChartTitle()
}
/**
 * 转换数据结构
 */
function getFormatChartData() {
  return props.doughnutData.map(item => {
    return {
      name: item.name,
      color: item.color,
      type: item.type,
      y: item.value
    }
  })
}
/**
 * 设置圆心标题
 */
function setChartTitle() {
  if (!chart) return
  const series = chart.series[0]
  const data = series.data
  const title = props.computeTitle(data)
  // 环形图圆心
  var centerY = series.center[1],
      titleHeight = parseInt(chart.title.styles.fontSize);
  // 动态设置标题位置
  chart.setTitle({
      y: centerY + titleHeight/2,
      text: title
  });
}
</script>

<template>
  <div class="hard-doughnut">
    <div class="doughnut-chart" v-scale-size="{ computingSizeKey: 'width', scale: 1 }" ref="doughnutRef"></div>
    <div class="content">
      <div class="chart-title">
        <span class="iconfont icon-yuandianxiao-copy"></span>
        <span>{{ theme || '' }}</span>
      </div>
      <div class="chart-number">
        <span>{{ count + unit || 0 }}</span>
        <span class="split-line">/</span>
        <span>{{ total + unit || 0 }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$content-width: 120px;
$content-fs: 14px;
$text-space: 5px;
.hard-doughnut {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  .doughnut-chart {
    height: 100%;
    min-width: 0;
  }
  .content {
    width: $content-width;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-size: $content-fs;
    @media screen and (max-width: 1360px) {
      font-size: 12px;
    }
    font-weight: bold;
    .chart-title,
    .chart-number {
      padding: $text-space 0;
    }
    .split-line {
      padding: 0 $text-space;
    }
    .chart-title {
      display: flex;
      align-items: center;
    }
    .icon-yuandianxiao-copy {
      font-size: 24px;
      position: relative;
      top: 1px;
      color: $text-hcolor;
      @media screen and (max-width: 1360px) {
        font-size: 18px;
      }
    }
  }
}
:deep() {
  .highcharts-credits {
    display: none;
  }
}
</style>