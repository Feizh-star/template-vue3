<script setup lang="ts">
const props = defineProps<{
  containerName?: string
}>()
// Layout和RouterSocket组件添加props判断路由路径匹配，避免vue-router的bug：KeepAlive出现不同分支时，失活的分支的子组件会被重复渲染
function renderComponent(Component: any, route: any) {
  return !props.containerName ||
    new Set(route.matched.map((item: any) => item.name)).has(props.containerName)
    ? Component
    : undefined
}
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <KeepAlive>
      <component :is="renderComponent(Component, route)" />
    </KeepAlive>
  </RouterView>
</template>
