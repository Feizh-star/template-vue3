import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw, RouteLocationNormalized } from 'vue-router'
import Home from '../views/HomeView.vue'
import { h } from 'vue'
import Layout from '@/layout/Layout.vue'
import { useMenu } from '@/stores/menu'
import { filterTreeNode } from '@/utils/tools'
import pathModule from 'path-browserify'

export const routes: Array<RouteRecordRaw> = [
  // {
  //   path: '/',
  //   component: Layout,
  //   redirect: '/home',
  //   meta: {
  //     hidden: true,
  //   },
  //   children: [
  //     {
  //       path: 'home',
  //       name: 'Home',
  //       component: Home,
  //       meta: {
  //         title: 'Home',
  //         hidden: true,
  //       }
  //     }
  //   ]
  // },
  // 没匹配到的路由都会匹配这个，进入错误页面
  {
    path: '/:pathMatch(.*)*',
    meta: {
      hidden: true,
    },
    component: () => import('@/views/Error/Index.vue')
  },
]

const router = createRouter({
  history: createWebHistory('/convert/'),
  routes,
  sensitive: true,
})

router.beforeEach((to, from, next) => {
  // 获取路由
  const menu = useMenu()
  if (menu.getMenuList.length === 0) {
    menu.fetchMenuList().then(() => {
      next({ ...to, replace: true })
    })
  } else {
    next()
  }
})
router.afterEach((to: RouteLocationNormalized) => {
  setCurrentMenu(to) // 设置当前菜单
})

function setCurrentMenu(to: RouteLocationNormalized) {
  const menu = useMenu()
  const fullpath = to.fullPath
  const currentRoute = filterTreeNode(menu.getMenuList, fullpath, { id: 'path' }, (path: any, fPath: any, node: any, parents: any) => {
    const paths = [...parents.map((p: any) => p.path), path]
    const currentFullPath = pathModule.join(...paths)
    return currentFullPath === fPath
  })
  menu.setRoutePath(currentRoute ? [...currentRoute._stack, currentRoute] : [])
  menu.setCurrentMenu(currentRoute || {})
}

export default router
