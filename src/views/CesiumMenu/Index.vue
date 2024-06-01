<script setup lang="ts">
import { Female, Male, Sugar } from '@element-plus/icons'
import { useRouter } from 'vue-router'
import { useMenu } from '@/store/menu'
import { computed } from 'vue'

const componentIcon: any = { Female, Male, Sugar }

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

const router = useRouter()
function gotoPage(pageName: string) {
  router.push({ name: pageName })
}

const menuStore = useMenu()
const menuList = computed(() => {
  const currentMenuPath = menuStore.getRouteNodePath || []
  return currentMenuPath.find((item) => item.name === props.containerName)?.children || []
})
</script>

<template>
  <div class="custom-menu">
    <div class="suspend-menu">
      <el-menu default-active="1" class="el-menu-vertical-demo" :collapse="true">
        <el-menu-item
          v-for="item in menuList"
          :key="item.name"
          :index="item.name"
          @click="gotoPage(item.name as string)"
        >
          <el-icon
            ><component :is="componentIcon[item.meta?.icon?.value || '']"></component
          ></el-icon>
          <template #title>{{ item.meta?.title || '' }}</template>
        </el-menu-item>
      </el-menu>
    </div>
    <div class="page-container">
      <RouterView v-slot="{ Component, route }">
        <KeepAlive>
          <component :is="renderComponent(Component, route)" />
        </KeepAlive>
      </RouterView>
    </div>
  </div>
</template>

<style scoped lang="less">
.custom-menu {
  width: 100%;
  height: 100%;
  position: relative;
  .suspend-menu {
    position: absolute;
    top: 50px;
    left: 30px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0px 12px 32px 4px rgba(0, 0, 0, 0.04), 0px 8px 20px rgba(0, 0, 0, 0.08);
    z-index: 1;
  }
  .page-container {
    width: 100%;
    height: 100%;
  }
  :deep(.el-menu) {
    border-right: none;
  }
}
</style>
