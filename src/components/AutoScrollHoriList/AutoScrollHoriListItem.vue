<script setup lang="ts">
export interface Props {
  content?: string
}

withDefaults(defineProps<Props>(), {
  content: '',
})
</script>

<template>
  <div class="autoscroll-hori-list-item">
    <slot>
      <span>{{ content }}</span>
    </slot>
  </div>
</template>

<style lang="less" scoped>
.autoscroll-hori-list-item {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
}
</style>
