<script setup lang="ts">
import type { RouteRecordRaw } from 'vue-router'
import { ref, useAttrs, watch } from 'vue'
import { useMenu } from '@/store/menu'
import MenuItem from '@/layout/components/MenuItem.vue'
const props = defineProps<{
  menuList: RouteRecordRaw[]
  popperClass?: string
}>()
const emits = defineEmits<{
  (e: 'open', key: string, keyPath: string[]): void
  (e: 'close', key: string, keyPath: string[]): void
  (e: 'select', key: string, keyPath: string[]): void
}>()
const attrs = useAttrs()
const menu = useMenu()
const defaultActive = ref('')

watch(
  () => menu.getRouteNodePath,
  (newNodePath) => {
    const pathArr: string[] = []
    for (const routeNode of newNodePath) {
      pathArr.push(routeNode.path.replace('/', ''))
      if (routeNode.meta?.isLeaf) break
    }
    defaultActive.value = '/' + pathArr.filter((p) => p && typeof p === 'string').join('/')
  },
  { immediate: true }
)

const handleOpen = (key: string, keyPath: string[]) => {
  // console.log(key, keyPath)
  emits('open', key, keyPath)
}
const handleClose = (key: string, keyPath: string[]) => {
  // console.log(key, keyPath)
  emits('close', key, keyPath)
}
const handleSelect = (key: string, keyPath: string[]) => {
  // console.log(key, keyPath)
  emits('select', key, keyPath)
}
</script>
<template>
  <div class="sidebar-menu">
    <el-scrollbar>
      <el-menu
        ref="menuRef"
        :default-active="defaultActive"
        v-bind="attrs"
        :ellipsis="false"
        @open="handleOpen"
        @close="handleClose"
        @select="handleSelect"
      >
        <MenuItem
          v-for="(item, index) in menuList"
          :key="index"
          :menu-item="item"
          parent-path=""
          :submenu-popper-class="popperClass || ''"
        />
      </el-menu>
    </el-scrollbar>
  </div>
</template>
<style lang="less" scoped>
.sidebar-menu {
  width: 100%;
  height: 100%;
}
</style>
