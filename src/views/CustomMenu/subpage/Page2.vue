<script setup lang="ts">
import { Gplot3D } from './compositions/gplot3D'

const renderEl = ref<HTMLElement | null>(null)

onMounted(() => {
  if (!renderEl.value) return
  const gplot = new Gplot3D({
    el: renderEl.value,
    scene: {
      backgroundColor: '#1a212e',
    },
  })
})
</script>

<template>
  <div class="custom-page2" ref="renderEl">
    <el-empty description="CustomMenu 页面二" />
  </div>
</template>

<style scoped lang="less">
.custom-page2 {
  width: 100%;
  height: 100%;
  padding: 16px;
  > canvas {
    width: 100%;
    height: 100%;
  }
}
</style>
