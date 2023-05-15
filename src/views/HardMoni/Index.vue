<script setup lang="ts">
import { debounce } from '@/utils/tools'
import { genDoughnutData, genServerBlockData } from './test/test-data'
import ScreenShot from '@/components/ScreenShot/index.vue'
// import HardDoughnut from '@/components/hardmoni/HardDoughnut.vue'
// import ServerBlock from '@/components/hardmoni/ServerBlock.vue'

// 设置布局height
const height = ref('')
const scrollbarRef = ref()
function setLineHeight() {
  const scrollbar = scrollbarRef.value.$el
  const scrollbarWrap = scrollbar.getElementsByClassName('el-scrollbar__wrap')[0]
  const containerHeight = getComputedStyle(scrollbarWrap).height
  const lineHeight = (Math.max((parseFloat(containerHeight) || 700) / 2, 284.5)) + 'px'
  height.value = lineHeight
}
const _setLineHeight = debounce(setLineHeight, 300)
onMounted(() => {
  window.addEventListener('resize', _setLineHeight)
  setLineHeight()
})
onUnmounted(() => {
  window.removeEventListener('resize', _setLineHeight)
  interval && clearInterval(interval)
})

// 获取和更新数据
const doughnutData = ref<any[]>([])
const serverBlockData = ref<any[]>([])
const autoRefresh = ref(true)
let interval: any = null
onMounted(() => {
  doughnutData.value = genDoughnutData()
  serverBlockData.value = genServerBlockData(8)
})
watch(() => autoRefresh.value, (newVal) => {
  if (newVal) {
    autoUpdate()
  } else {
    interval && clearInterval(interval)
  }
}, {
  immediate: true
})
function autoUpdate() {
  interval = setInterval(() => {
    doughnutData.value = genDoughnutData()
    serverBlockData.value = genServerBlockData(8)
  }, 2000)
}
</script>

<template>
  <div class="hard-moni">
    <section class="hard-overview">
      <div class="overview-container">
        <div class="charts">
          <div class="chart" v-for="(item, index) in doughnutData" :key="index">
            <HardDoughnut
              :doughnutData="item.doughnutData"
              :theme="item.theme"
              :count="item.count"
              :total="item.total"
              :unit="item.unit"
            ></HardDoughnut>
          </div>
        </div>
        <div class="auto-refresh">
          <div class="refresh-title">自动刷新</div>
          <div class="refresh-btn">
            <el-switch
              :width="64"
              v-model="autoRefresh"
              active-color="#abd8ff"
              inactive-color="#EEF4FB">
            </el-switch>
          </div>
        </div>
      </div>
    </section>
    <section class="hard-detail">
      <el-scrollbar ref="scrollbarRef">
        <div 
          class="hard-detail-block" 
          :style="{ height: height }"
          v-for="(item, index) in serverBlockData"
          :key="index"
          >
          <ServerBlock
            :title="item.title"
            :status="item.status"
            :lineData="item.lineData"
          ></ServerBlock>
        </div>
      </el-scrollbar>
    </section>
    <ScreenShot />
  </div>
</template>

<style lang="scss" scoped>
$overview-height: 180px;
$overview-pb: 15px;
$refresh-width: 86px;
$content-fs: 18px;
$refresh-space: 10px;
$border-radius: 3px;
$section-padding: 16px 24px;
$section-server-padding: 16px 8px 0 24px;

.hard-moni {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  .hard-overview {
    padding-bottom: $overview-pb;
    height: $overview-height;
    .overview-container {
      width: 100%;
      height: 100%;
      display: flex;
      padding: $section-padding;
      padding-left: 14px;
      border-radius: $border-radius;
      background-color: #fff;
      .charts {
        width: 100%;
        height: 100%;
        display: flex;
        flex: 1;
        min-width: 0;
        .chart {
          width: 25%;
          padding: 0 10px;
          height: 100%;
          :deep(.hard-doughnut) {
            background-color: #f6f7f9;
          }
        }
      }
      .auto-refresh {
        width: $refresh-width;
        padding-left: 10px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-size: $content-fs;
        font-weight: bold;
        white-space: nowrap;
        .refresh-title,
        .refresh-number {
          padding: $refresh-space 0;
        }
      }
      @media screen and (max-width: 1360px) {
        padding: 8px 12px;
        .charts {
          .chart {
            padding: 0 5px;
          }
        }
      }
    }
    @media screen and (max-width: 1360px) {
      height: $overview-height - 20px;
    }
  }
  .hard-detail {
    flex: 1;
    min-height: 0;
    background-color: #ffffff;
    padding: $section-server-padding;
    :deep(.el-scrollbar__view) {
      display: flex;
      flex-wrap: wrap;
      .hard-detail-block {
        padding-bottom: 16px;
        padding-right: 16px;
        width: 25%;
        @media screen and (max-width: 1600px) {
          width: 33.33%;
        }
        @media screen and (max-width: 1200px) {
          width: 50%;
        }
        // &:nth-child(-n + 4) {
        //   padding-top: 0;
        // }
        // &:nth-child(4n) {
        //   padding-right: 0;
        // }
      }
    }
  }
}
:deep(.el-scrollbar) {
  width: 100%;
  height: 100%;
  .el-scrollbar__wrap {
    overflow-x: hidden;
  }
  @media screen and (min-width: 1000px) and (max-width: 1300px) {
    .el-scrollbar__wrap {
      margin-right: -14px !important;
    }
  }
}
:deep(.el-switch) {
  height: 24px;
  line-height: 24px;
  .el-switch__core {
    height: 24px;
    border-radius: 12px;
    &::after {
      width: 18px;
      height: 18px;
      background-color: $text-hcolor;
    }
  }
  &.is-checked .el-switch__core::after {
    margin-left: -19px;
    background-color: $text-hcolor;
}
}
</style>