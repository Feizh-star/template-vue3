<template>
  <div class="server-block">
    <div class="block-header">
      <div class="block-header-title">
        {{ title || '服务器' }}
      </div>
      <div class="text-btn">
        <el-button link>详情</el-button>
      </div>
    </div>
    <div class="block-info">
      <div class="block-info-image">
        <!-- <img src="@/assets/images/server2x.png" /> -->
        <img class="status-icon" :src="serverStatusSrc" />
      </div>
      <div class="block-info-status">
        <div class="status-line">
          <span class="iconfont icon-yuandianxiao-copy"></span>
          <span class="status-label">地址：</span>
          <span class="status-value">{{ status.address || '' }}</span>
        </div>
        <div class="status-line">
          <span class="iconfont icon-yuandianxiao-copy"></span>
          <span class="status-label">状态：</span>
          <span class="status-value" :style="{ color: online ? '#34cf4b' : '#ec4141' }">{{ status.status || '' }}</span>
        </div>
        <div class="status-line">
          <span class="iconfont icon-yuandianxiao-copy"></span>
          <span class="status-label">类别：</span>
          <span class="status-value">{{ status.type || '' }}</span>
        </div>
        <div class="status-line">
          <span class="iconfont icon-yuandianxiao-copy"></span>
          <span class="status-label">连接数：</span>
          <span class="status-value">{{ status.linksNum || '' }}</span>
        </div>
      </div>
    </div>
    <div class="block-line">
      <div class="block-line-chart" ref="chartRef"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defaultStyle } from '@/style/variables'
import normalImg from '@/assets/images/normal2x.png'
import errorImg from '@/assets/images/error2x.png'
import Highcharts from 'highcharts'

export type TStatus = {
  address: string
  status: string
  type: string
  linksNum: number
}
export type TLineData = Array<{
  name: string
  value: number
}>
export interface IProps {
  title: string
  status: TStatus
  lineData: TLineData
}
const props = withDefaults(defineProps<IProps>(), {
  status: () => ({
    address: '192.168.1.103',
    status: '在线',
    type: '虚谷',
    linksNum: 30,
  }),
  lineData: () => [
    { name: '内存', value: 0 },
    { name: 'cpu', value: 0 },
    { name: '容量', value: 0 },
  ]
})
const online = computed(() => props.status.status === '在线')
const serverStatusSrc = computed(() => online.value ? normalImg : errorImg)

let chart: any
let chartData: any
const chartRef = ref()
watch(() => props.lineData, (newVal, oldVal) => {
  if (chart && newVal !== oldVal) updateChart()
})
onMounted(() => setTimeout(() => initLineChart(), 300))
function initLineChart() {
  chartData = getFormatChartData()
  chart = Highcharts.chart(chartRef.value, {
    // @ts-ignore
    accessibility: {
      enabled: false,
    },
    chart: {
      type: 'bar'
    },
    title: {
      text: null
    },
    xAxis: {
      // categories: categories, // x轴类别
      categories: [], // x轴类别
      lineWidth: 0, // 隐藏x轴线
      labels: {
        formatter() {
          return this.value + ':'
        },
        style: {
          fontSize: '12px',
          color: defaultStyle.textColor
        },
      },
      title: {
        text: null
      }
    },
    yAxis: {
      min: 0,
      title: {
        text: null,
      },
      gridLineWidth: 0,
      labels: {
        enabled: false,
      }
    },
    plotOptions: {
      bar: {
        grouping: false, // 不对“非堆叠列”进行分组，这样它们就会完全重叠在一起
        pointWidth: 18,
        borderRadius: 9,
      },
      series: {
        states: {
          inactive: {
            opacity: 1 // 当其他系列鼠标悬浮高亮时，自身的透明度
          }
        }
      }
    },
    legend: {
      enabled: false,
    },
    tooltip: {
      formatter() {
        if (!(this.series.userOptions as any).showInTooltip) {
          return false;
        }
        return `占用情况<br/>${this.x}: ${(parseFloat((this.y || 0) + '') || 0).toFixed(1)}%`
      },
    },
    series: [{
      showInTooltip: false, // 自定义的option可以在formatter中通过this.series.userOptions获取
      color: '#E4E9EF',
      states: {
        hover: {
          color: '#E4E9EF'
        }
      },
      dataLabels: {
        enabled: true,
        allowOverlap: true, // 允许数据标签重叠
        style: {
          color: defaultStyle.textColor
        },
        formatter() {
          const name = (this as any).x
          const dataByName = chartData.find((item: any) => item.name === name)
          const value = dataByName?.y || 0
          return `${(value / 100 * 100).toFixed(1)}%`
        }
      },
      data: [
        { name: '内存', y: 100 }, 
        { name: 'cpu', y: 100 }, 
        { name: '容量', y: 100 }
      ]
    }, {
      showInTooltip: true,
      color: defaultStyle.textHcolor,
      data: []
    }]
  });
  updateChart()
}
/**
 * 获取到符合highcharts需要的格式的数据
 */
function getFormatChartData() {
  return props.lineData.map(item => {
    return {
      name: item.name,
      y: item.value
    }
  })
}
/**
 * 获取到x轴分类
 */
function getCategories() {
  return props.lineData.map(item => item.name)
}
/**
 * 更新图表数据
 */
function updateChart() {
  if (!chart) return
  const series1 = chart.series[1]
  const xAxis = chart.xAxis[0]
  const categories = getCategories()
  const data = getFormatChartData()
  chartData = data
  xAxis.setCategories(categories)
  series1.setData(data)
}
</script>

<style lang="scss" scoped>
$header-height: 46px; // 头部高度
$header-padding: 5px; // 头部内边距
$content-padding: 10px; // 内容边距
$status-text-width: 200px; // 状态文本宽度

$border-color: #f4f4f4;
$image-bgc: #F5F7F9;
$point-color: #4FA3FC;
$header-color: $text-hcolor;

.server-block {
  width: 100%;
  height: 100%;
  border: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  .block-header {
    height: $header-height;
    padding: 0 10px;
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid $border-color;
    background-color: #edf6fd;
    .block-header-title,
    .text-btn {
      display: inline-flex;
      align-items: center;
    }
    .block-header-title {
      color: $header-color;
      font-size: 20px;
      font-weight: bold;
    }
    .text-btn span {
      color: $header-color
    }
  }
  .block-info {
    flex: 1;
    min-height: 0;
    display: flex;
    padding: $content-padding;
    padding-bottom: 0;
    .block-info-image {
      flex: 1;
      min-width: 0;
      text-align: center;
      background-color: $image-bgc;
      background-image: url("@/assets/images/server2x.png");
      background-size: contain;
      background-position: center;
      background-repeat: no-repeat;
      overflow: hidden;
      position: relative;
      >img {
        height: 100%;
      }
      .status-icon {
        $size: 18px;
        $edge: 6px;
        width: $size;
        height: $size;
        position: absolute;
        bottom: $edge;
        right: $edge;
      }
    }
    .block-info-status {
      width: $status-text-width;
      padding: 0 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      .status-line {
        display: flex;
        align-items: center;
        line-height: 24px;
        font-size: 14px;
        color: $text-color;
        .icon-yuandianxiao-copy {
          font-size: 24px;
          position: relative;
          top: 1px;
          color: $point-color;
        }
      }
      
      @media screen and (max-width: 1360px) {
        width: 180px;
        .status-line {
          font-size: 12px;
        }
      }
    }

  }
  .block-line {
    flex: 1;
    min-height: 0;
    padding: $content-padding;
    .block-line-chart {
      width: 100%;
      height: 100%;
    }
  }
}
:deep() {
  .highcharts-credits {
    display: none;
  }
}
</style>
