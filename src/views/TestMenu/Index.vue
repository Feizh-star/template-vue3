<script setup lang="ts">
// import stations from './data'
// const fullStations = stations.filter((item, index) => {
//   return !(index % 10)
// })
// console.log(JSON.stringify(fullStations, null, 2))

const divEl = ref()
onMounted(() => {
  // 创建一个 ResizeObserver 实例
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const { target, contentRect } = entry;
      const { width, height } = contentRect;

      // 在这里执行宽高变化后的操作
      console.log(target === divEl.value, `宽度: ${width}px, 高度: ${height}px`);
    }
  });

  // 监听指定的 <div> 元素
  resizeObserver.observe(divEl.value as Element);
})
</script>

<template>
  <div class="test-menu" ref="divEl">
    1
  </div>
</template>

<style scoped lang="less">
.test-menu {
  width: 100%;
  height: 100%;
  background-color: #fff;
}
</style>
