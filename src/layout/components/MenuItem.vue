<script setup lang="ts">
import type { RouteRecordRaw } from 'vue-router'
import type { ComputedRef } from 'vue'
import { watchEffect } from 'vue'
import { ref, computed } from 'vue'
import AppLink from './AppLink.vue'
import path from 'path-browserify'
import { useMenu } from '@/store/menu'

const resolvePath = (m: RouteRecordRaw): string => {
  const itemPath = m?.path || ''
  return itemPath.startsWith('http') ? itemPath : path.resolve('/', props.parentPath, m?.path || '')
}
const getMenuTitle = (m: RouteRecordRaw): string => (m?.meta?.title || '') as string
const getShowingChildren = (ms: RouteRecordRaw[] | undefined): RouteRecordRaw[] =>
  ms?.filter((c) => !c.meta?.hidden) || []

const props = defineProps<{
  menuItem: RouteRecordRaw
  parentPath: string
}>()

const showingItem = ref<RouteRecordRaw | null>()
const renderMenuItem: ComputedRef<boolean> = computed(() => !!showingItem.value)
const isHidden: ComputedRef<boolean> = computed(
  () => !!(props.menuItem.meta && props.menuItem.meta.hidden)
)
const currentPath: ComputedRef<string> = computed(() =>
  resolvePath(showingItem.value as RouteRecordRaw)
)
const currentSubMenuPath: ComputedRef<string> = computed(() =>
  resolvePath(props.menuItem as RouteRecordRaw)
)
watchEffect(() => hasNextLevelMenu(props.menuItem))

function hasNextLevelMenu(m: RouteRecordRaw): void {
  const children = m.children || []
  const showingChildren = children.filter((c) => !c.meta?.hidden)
  if (showingChildren.length === 0 || (m.meta?.isLeaf && m.component)) {
    showingItem.value = m
  } else if (
    showingChildren.length === 1 &&
    !m.meta?.alwaysShow &&
    (getShowingChildren(showingChildren[0].children).length === 0 ||
      (showingChildren[0].meta?.isLeaf && showingChildren[0].component))
  ) {
    const onlyChildPath = showingChildren[0]?.path || '/'
    const path = onlyChildPath.startsWith('/') ? onlyChildPath : `${m.path}/${onlyChildPath}`
    showingItem.value = { ...showingChildren[0], path } as RouteRecordRaw
  } else {
    showingItem.value = null
  }
}

const menu = useMenu()
const currentRoutePath = computed(() => menu.getRoutePath)
function setIcon(mItem: RouteRecordRaw, fullpath: string) {
  const iconInfo = mItem.meta?.icon
  if (!iconInfo) return ''
  const type = iconInfo.type
  const value = iconInfo.value || ''
  const valueSel = iconInfo.valueSel || ''
  const isSel = currentRoutePath.value.startsWith(fullpath)
  let result = ''
  switch (type) {
    case 'class':
      result = `<span class="${value || ''}"></span>`
      break
    case 'img':
      result = `<img src="${isSel ? valueSel : value}"/>`
      break
  }
  return result
}
</script>

<script lang="ts">
export default {
  name: 'MenuItem',
}
</script>

<template>
  <AppLink v-if="!isHidden && renderMenuItem" :to="currentPath">
    <div v-if="currentPath.startsWith('http')" class="external-link el-menu-item">
      <span class="menu-icon" v-html="setIcon(showingItem as RouteRecordRaw, currentPath)"></span>
      {{ getMenuTitle(showingItem as RouteRecordRaw) }}
    </div>
    <el-menu-item :index="currentPath" v-else>
      <span class="menu-icon" v-html="setIcon(showingItem as RouteRecordRaw, currentPath)"></span>
      {{ getMenuTitle(showingItem as RouteRecordRaw) }}
    </el-menu-item>
  </AppLink>
  <el-sub-menu
    v-if="!isHidden && !renderMenuItem"
    :index="currentSubMenuPath"
    popper-class="header-menu-popper"
  >
    <template #title>
      <span class="menu-icon" v-html="setIcon(menuItem, currentSubMenuPath)"></span>
      <span :class="{ 'sub-menu-text-active': currentRoutePath.startsWith(currentSubMenuPath) }">{{
        getMenuTitle(menuItem)
      }}</span>
    </template>
    <MenuItem
      v-for="(item, index) in menuItem.children"
      :key="index"
      :menu-item="item"
      :parent-path="resolvePath(menuItem)"
      submenu-popper-class="header-menu-popper"
    />
  </el-sub-menu>
</template>

<style lang="less" scoped>
.menu-icon {
  display: inline-flex;
  align-items: center;
  > :deep(img) {
    width: 20px;
    margin-right: 10px;
  }
}
.sub-menu-text-active {
  color: var(--el-menu-active-color);
}
:deep(.external-link) {
  color: var(--el-menu-text-color);
  font-size: var(--el-menu-item-font-size);
  height: var(--el-menu-item-height);
  display: flex;
  align-items: center;
  padding: 0 var(--el-menu-base-level-padding);
  &:hover {
    color: #ffffff;
    background-color: #00000033;
  }
}
</style>

<style lang="less">
.header-menu-popper {
  background-color: #3b7abd;
  .menu-icon {
    display: inline-flex;
    align-items: center;
    > img {
      width: 20px;
      margin-right: 10px;
    }
  }
  .external-link {
    align-items: center;
    background-color: var(--el-menu-bg-color);
    color: var(--el-menu-text-color);
    font-size: var(--el-menu-item-font-size);
    display: flex;
    height: var(--el-menu-horizontal-sub-item-height);
    line-height: var(--el-menu-horizontal-sub-item-height);
    padding: 0 10px;
    &:hover {
      color: #ffffff;
      background-color: #00000033;
    }
  }
}
</style>
