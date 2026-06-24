<script setup lang="ts">
defineProps<{
  questionList: { name: string; key: string }[]
}>()
const emits = defineEmits<{
  (e: 'click-item', type: string): void
}>()
</script>

<template>
  <div class="agent-content">
    <div class="ctt-top">
      <div class="left-hello">
        <div class="hello-title">有什么可以帮您？</div>
        <div class="hello-desc">灵仔智能助手为您服务～</div>
      </div>
      <div class="right-img">
        <img src="../assets/robot.png" alt="" />
      </div>
    </div>
    <div class="ctt-main">
      <div class="question-title">
        <span>大家都在问</span>
      </div>
      <div
        class="question-item"
        v-for="item in questionList"
        :class="item.key"
        :key="item.key"
        @click="emits('click-item', item.key)"
      >
        <span class="question-icon">
          <img src="../assets/q.svg" class="q-icon" alt="" />
        </span>
        <span class="question-name">{{ item.name }}</span>
        <span class="question-icon">
          <img src="../assets/arrow.svg" class="a-icon" alt="" />
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.agent-content {
  position: absolute;
  right: 88%;
  bottom: 68%;
  padding: 16px;
  background: linear-gradient(180deg, #e9f1ff 0%, #f8fcfd 100%);
  border-top: 2px solid #bdcffc;
  box-shadow: 0 0 10px #bdcffc;
  border-radius: 6px;
  padding: 10px;
  overflow: hidden;
  transform-origin: bottom right;
  .ctt-top {
    display: flex;
    height: 106px;
    width: 340px;
    .left-hello {
      flex: 1;
      min-width: 0;
      padding-top: 16px;
      .hello-title {
        color: #1d2129;
        font-family: 'AlibabaPuHuiTi_2_65';
        font-size: 20px;
        font-style: normal;
        font-weight: 500;
        line-height: 28px;
      }
      .hello-desc {
        color: #86909c;
        font-family: 'AlibabaPuHuiTi_2_55';
        font-size: 14px;
        font-style: normal;
        line-height: 22px;
      }
    }
    .right-img {
      width: 148px;
      height: 100%;
      display: flex;
      justify-content: center;
      overflow: hidden;
      > img {
        height: 135%;
      }
    }
  }
  .ctt-main {
    width: 340px;
    display: flex;
    padding: 16px 16px 4px 16px;
    flex-direction: column;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(4px);
    .question-title {
      color: #1d2129;
      font-family: 'AlibabaPuHuiTi_2_65';
      font-size: 16px;
      font-style: normal;
      font-weight: 500;
      line-height: 24px;
      padding-bottom: 12px;
    }
    .question-item {
      display: flex;
      align-items: center;
      padding: 12px 12px 12px 8px;
      gap: 8px;
      cursor: pointer;
      border-bottom: 1px solid #e5e6eb;
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: 22px;
      &:last-child {
        border-bottom: none;
      }
      &:hover {
        background-color: #eff5ff;
      }
      .question-icon {
        display: inline-flex;
        align-items: center;
        .q-icon {
          width: 16px;
        }
        .a-icon {
          width: 5px;
        }
      }
      .question-name {
        flex: 1;
        min-height: 0;
      }
    }
  }
}
</style>
