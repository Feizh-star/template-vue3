<script setup lang="ts"></script>

<template>
  <div class="cesium-page1">
    <div class="cesium-field" ref="renderEl">
      <el-empty description="CesiumMenu 页面一" />
    </div>
  </div>
</template>

<style scoped lang="less">
.cesium-page1 {
  width: 100%;
  height: 100%;
  padding: 16px;
  position: relative;
  overflow: hidden;
  .cesium-field {
    width: 100%;
    height: 100%;

    > canvas {
      width: 100%;
      height: 100%;
    }
  }
}
</style>
