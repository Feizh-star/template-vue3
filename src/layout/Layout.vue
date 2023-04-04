<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="layout">
    <div class="ly-header">
      <LayoutHeader></LayoutHeader>
    </div>
    <div class="ly-main">
      <div class="ly-main-menu">
        <LayoutMenu :menu-list="menuList"></LayoutMenu>
      </div>
      <div class="ly-main-body">
        <div class="ly-main-body-inner">
          <div class="ly-main-body-breadcrumb">
            <LayoutBread></LayoutBread>
          </div>
          <div class="ly-main-body-view">
            <RouterView></RouterView>
          </div>
        </div>
      </div>
    </div>
      
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
interface Components {
  [propName: string]: any;
}
const modules = import.meta.glob('@/layout/components/*.vue', { eager: true, import: 'default', })
const components: Components = {}
Object.keys(modules).forEach(key => {
  const nameMatch = key.match(/(?<=\/)\w+(?=\.vue)/)
  const fileFullname = nameMatch && nameMatch[0]
  if (fileFullname) {
    components[fileFullname] = modules[key]
  }
})
// console.log(components)
export default defineComponent({
  components: {
    ...components
  }
})
</script>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import { useMenu } from '@/stores/menu'
const menu = useMenu()
const menuList = menu.getMenuList
</script>

<style lang="scss" scoped>
$header-height: 60px; // 头部高度
$menu-width: 240px; // 菜单宽度
$main-pt: 0px; // 头部与主体之间的空隙高度
$body-pl: 16px; // 菜单与右侧主体之间的宽度
$body-inner-p: 15px; // 主体左右两侧的padding
$breamcrumb-height: 47px; // 面包屑的高度
$border-radius: 3px; // 默认的圆角

$main-border-color: #dadde1;
$main-bgc: #f7f7f7; // 浅灰背景色

.layout {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  .ly-header {
    height: $header-height;
  }
  .ly-main {
    flex: 1;
    min-height: 0;
    padding: $main-pt 0;
    display: flex;
    .ly-main-menu {
      width: $menu-width;
      border: 1px solid $main-border-color;
      border-radius: $border-radius;
      position: relative;
      box-shadow: 0px 3px 10px 1px rgba(51,51,51,0.2);
    }
    .ly-main-body {
      flex: 1;
      min-width: 0;
      padding-left: $body-pl;
      background-color: $main-bgc;
      .ly-main-body-inner {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        .ly-main-body-breadcrumb {
          height: $breamcrumb-height;
          // margin-left: -15px;
          background-color: #ffffff;
        }
        .ly-main-body-view {
          flex: 1;
          min-height: 0;
          padding: $body-inner-p;
          padding-left: 0;
        }
      }
    }
  }
}
.layout .ly-main .ly-main-menu :deep(.menu-icon) {
  .iconfont {
    &.icon-yitihuajiankong {
      font-size: 20px;
      margin-right: 10px;
    }
    &.icon-yuandianxiao-copy {
      font-size: 28px;
    }
  }
}
</style>