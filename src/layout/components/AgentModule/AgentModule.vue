<script setup lang="ts">
import { CircleCloseFilled } from '@element-plus/icons-vue'
import { loadAssetsFromPublicDataSet } from '@/utils/tools'
import RobotContent from './components/RobotContent.vue'
import { robotTypeDict } from './config/dict'

const props = defineProps<{
  modelValue: boolean
}>()
const emits = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'open-chat-dialog', type: string): void
}>()

setTimeout(() => {
  robotUrl.value = loadAssetsFromPublicDataSet('images/robot.gif')
}, 500)
const robotUrl = ref('')
const hiddenRobot = () => {
  emits('update:modelValue', false)
}

const contentShow = ref(false)
let robotMouseLeaveTimeoutId: ReturnType<typeof setTimeout> | null = null
const robotMouseEnter = () => {
  if (robotMouseLeaveTimeoutId) {
    clearTimeout(robotMouseLeaveTimeoutId)
    robotMouseLeaveTimeoutId = null
  }
  contentShow.value = true
}
const robotMouseLeave = () => {
  robotMouseLeaveTimeoutId = setTimeout(() => {
    contentShow.value = false
  }, 200)
}
</script>

<template>
  <div class="agent-module" v-show="modelValue">
    <div class="robot-container" @mouseenter="robotMouseEnter" @mouseleave="robotMouseLeave">
      <img :src="robotUrl" alt="" />
      <Transition name="robot-content">
        <RobotContent
          :robotUrl="robotUrl"
          @click-item="(type) => emits('open-chat-dialog', type)"
          :questionList="robotTypeDict"
          v-if="contentShow"
        />
      </Transition>
    </div>
    <div class="close-icon" @click="hiddenRobot">
      <el-icon><CircleCloseFilled /></el-icon>
    </div>
  </div>
</template>

<style lang="less" scoped>
.agent-module {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2; /* 比.ly-main高1级 */
  width: 106px;
  height: 134px;
  .robot-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    > img {
      height: 100%;
    }
  }
  .close-icon {
    position: absolute;
    top: -16px;
    right: -16px;
    color: #a8a8a8;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    // :deep(.el-icon) {
    //   display: none;
    // }
    // &:hover {
    //   :deep(.el-icon) {
    //     display: block;
    //   }
    // }
  }
  .robot-content-enter-from,
  .robot-content-leave-to {
    transform: scale(0);
  }
  .robot-content-enter-active,
  .robot-content-leave-active {
    transition: transform 0.3s ease-in-out;
  }
}
</style>
