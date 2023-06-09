<script setup lang="ts">
import { useRouter } from 'vue-router'
const props = defineProps<{redirect?: string}>()

const router = useRouter()
if (props.redirect) router.push(props.redirect)
</script>

<template>
  <div class="">
    首页
  </div>
</template>

<style scoped lang="scss">

</style>
