<script setup lang="ts"></script>

<template>
  <div class="page-404">
    <el-empty>
      <template #description>
        <div class="error-404">
          <span>糟糕404，页面跑丢了</span>
        </div>
      </template>
    </el-empty>
  </div>
</template>

<style scoped lang="less">
.page-404 {
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.error-404 {
  font-size: 40px;
  color: #bbbbbb;
}
</style>
