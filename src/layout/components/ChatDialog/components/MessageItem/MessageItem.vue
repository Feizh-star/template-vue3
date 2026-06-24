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
      <span v-if="!isUserMessage && props.thinking">思考中...</span>
    </div>
  </div>
</template>

<style lang="less" scoped>
.message-item {
  padding-bottom: 42px;
  display: flex;
  &:last-child {
    padding-bottom: 0;
  }

  .message-content {
    font-family: 'AlibabaPuHuiTi_2_55';
    font-size: 16px;
    line-height: 20px;
    width: 100%;
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
