<script setup lang="ts">
import type { IMessageItem } from './type'
const props = defineProps<IMessageItem>()

const isUserMessage = computed(() => props.role === 'user')
</script>

<template>
  <div class="message-item" :class="{ 'user-message': isUserMessage }">
    <div class="message-content">
      <span v-if="isUserMessage">{{ props.content || '' }}</span>
      <slot v-else>
        <span>{{ props.content || '' }}</span>
      </slot>
      <div class="default-think" v-if="!isUserMessage && props.hint">
        <slot name="thinking">
          <span>{{ props.hint || '正在分析问题...' }}</span>
        </slot>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
@keyframes shimmer-sweep {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
.message-item {
  padding-bottom: 42px;
  display: flex;
  position: relative;
  &:last-child {
    padding-bottom: 0;
  }

  .message-content {
    font-family: 'AlibabaPuHuiTi_2_55';
    font-size: 16px;
    line-height: 20px;
    width: 100%;
    .default-think {
      font-size: 14px;
      color: #999999;
      > span,
      > div {
        display: inline-flex;
        background: linear-gradient(
          135deg,
          #999999 14%,
          #dfdfdfcc 20%,
          #999999 26%,
          #999999 64%,
          #dfdfdfcc 70%,
          #999999 76%
        );
        background-size: 200% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: shimmer-sweep 5s linear infinite;
      }
    }
  }

  &.user-message {
    padding-bottom: 24px;
    justify-content: flex-end;
    .message-content {
      display: inline-flex;
      padding: 13px 16px;
      border-radius: 10px;
      background-color: #ffffff;
      width: fit-content;
      max-width: 72%;
      box-shadow: 0px 12px 18px 4px rgba(0, 0, 0, 0.02);
    }
  }
}
</style>
