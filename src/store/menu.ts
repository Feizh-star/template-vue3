import type { RouteRecordRaw, RouteComponent } from 'vue-router'
import { defineStore } from 'pinia'
import router from '@/router'
import { routes as constants } from '@/router'
import { getRoutes } from '@/api/menu'
import Layout from '@/layout/Layout.vue'
import pathModule from 'path-browserify'
import { searchTreeNode } from '@/utils/tools'

const pages = importPage()

interface IState {
  resolved: boolean
  menuList: RouteRecordRaw[]
  currentMenu: RouteRecordRaw
  routePath: RouteRecordRaw[]
}

export const useMenu = defineStore({
  id: 'menuTree',
  state: () => ({
    resolved: false,
    menuList: [] as RouteRecordRaw[],
    currentMenu: {} as RouteRecordRaw,
    routePath: [] as RouteRecordRaw[],
  }),
  getters: {
    resolve: (state: IState) => state.resolved,
    getMenuList: (state: IState) => state.menuList,
    getCurrentMenu: (state: IState) => state.currentMenu,
    getRouteNodePath: (state: IState) => state.routePath,
    getRoutePath() {
      // @ts-ignore
      return pathModule.join(...this.getRouteNodePath.map((node) => node.path))
    },
  },
  actions: {
    async fetchMenuList() {
      try {
        let routes = await getRoutes()
        addRouteName(routes)
        routes = addLayoutForSingleRoute(routes)
        const parsedRoute = parseRoutes(routes, '', routes)
        this.menuList = [...constants, ...parsedRoute]
        this.setResolve(true)
      } catch (error) {
        console.error(error)
      }
    },
    setCurrentMenu(crtMenu: RouteRecordRaw) {
      this.currentMenu = crtMenu
    },
    setRoutePath(rPath: any[]) {
      this.routePath = rPath
    },
    setResolve(status: boolean) {
      this.resolved = status
    },
  },
})

/**
 * 将原始路由表转换为符合vue-router要求的路由表，并加入到router中
 * @param 原始器由表
 * @param parent 父路由名称，用于添加路由
 * @returns 符合vue-router要求的路由表
 */
function parseRoutes(
  routes: IOriginRoute[],
  parent: string = '',
  fullTree: IOriginRoute[]
): RouteRecordRaw[] {
  const parsedRoutes: RouteRecordRaw[] = []
  for (const raw of routes) {
    let redirectPath: string | undefined = undefined
    const showChildren = raw.children?.filter((item) => !item.meta?.hidden)
    if (showChildren && showChildren.length > 0) {
      const stack =
        searchTreeNode(fullTree, raw.name, { id: 'name' })?._stack?.map((item) => item.path) || []
      redirectPath = pathModule.resolve(...[...stack, raw.path, showChildren[0].path])
    }
    let component: RouteComponent | (() => Promise<RouteComponent>) | undefined
    if (!raw.component) {
      component = undefined
    } else if (raw.component === 'Layout') {
      component = Layout
    } else {
      // component = () => import(`../views/${raw.component.replace('.vue', '')}.vue`)
      // webpack不能编译动态的import(),需要借助babel-plugin-dynamic-import-webpack
      // component = () => require(`@/views/${raw.component}`)
      component = pages[raw.component]
    }
    const parsedRoute: RouteRecordRaw = {
      path: raw.path,
      component: component,
      name: raw.name,
      meta: raw.meta,
      redirect: raw.redirect == '-1' ? '' : raw.redirect || redirectPath,
      props: raw.props ? raw.props : {},
      children: [],
    }
    parsedRoute.children = [{ ...parsedRoute }] // 先addRoute，后设置children会导致vue-router报警告，这一步无用，只是去除警告
    router.addRoute(parent, parsedRoute)
    parsedRoutes.push(parsedRoute)
    parsedRoute.children = parseRoutes(raw.children || [], raw.name, fullTree)
  }
  return parsedRoutes
}
/**
 * 为单层路由加上layout容器
 * @param routes 接口获取的路由表
 * @returns 处理后的路由表
 */
function addLayoutForSingleRoute(routes: IOriginRoute[]): IOriginRoute[] {
  return routes.map((r) => {
    let routeParse: IOriginRoute = r
    if (!routeParse.component) {
      // 第一层没给组件，那就放在Layout中
      routeParse.component = 'Layout'
    } else if (!r.meta?.noLayout) {
      if (r.path.startsWith('/')) r.path = r.path.replace('/', '')
      const newName = `Layout-${r.name || Math.random().toString(36).substring(2, 12)}`
      routeParse = {
        path: '/',
        name: newName,
        component: 'Layout',
        meta: {
          title: '',
          hidden: false,
        },
        props: {
          containerName: newName,
        },
        children: [r],
      }
    }
    return routeParse
  })
}

function addRouteName(routes: IOriginRoute[], parentName: string = '') {
  for (const routeItem of routes) {
    const routeChildrenCount = routeItem.children?.length || 0
    const itemName = [parentName, routeItem.path.replace('/', '')].filter((p) => p).join('-')
    routeItem.name = itemName
    const props = routeItem.props || {}
    if (routeItem.component) {
      props.key = itemName
    }
    if (routeChildrenCount > 0) {
      props.containerName = itemName
    }
    routeItem.props = props
    if (routeChildrenCount > 0) addRouteName(routeItem.children as IOriginRoute[], itemName)
  }
}

/**
 * 导入页面文件
 */
function importPage() {
  const viewModules = import.meta.glob('@/views/**/*.vue')
  const modulesRemovedBase: { [propName: string]: any } = {}
  for (const path in viewModules) {
    modulesRemovedBase[path.replace('/src/views/', '')] = viewModules[path]
  }
  return modulesRemovedBase
}
