<script setup lang="ts"></script>

<template>
  <div class="custom-page2">
    <el-empty description="CustomMenu 页面二" />
    <customel-keep-proportion ratio="100%" class="keep-proportion">
      <div class="content">
        <span>我是内容</span>
      </div>
    </customel-keep-proportion>
  </div>
</template>

<style scoped lang="less">
.custom-page2 {
  width: 100%;
  height: 100%;

  .keep-proportion {
    width: 20%;
    margin: 0 auto;
    .content {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      border: 5px solid red;
      color: #fff;
      background-color: #00b3ff;
    }
  }
}
</style>
