<script setup lang="ts">
import { getJobList, addJob, updateJob, deleteJob } from '@/api/crud/job.js'
import Crud from '@/components/Crud/Index.vue'
import { config } from './config/job-config.jsx'
</script>

<template>
  <div class="test-crud">
    <Crud
      :config="config"
      mainKey="postId"
      :addApi="addJob"
      :queryApi="getJobList"
      :deleteApi="deleteJob"
      :modifyApi="updateJob"
    />
  </div>
</template>

<style scoped lang="less">
.test-crud {
  width: 100%;
  height: 100%;
  background-color: #fff;
}
</style>
