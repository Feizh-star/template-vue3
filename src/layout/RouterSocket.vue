<script setup lang="ts">
const props = defineProps<{
  containerName?: string
}>()
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
