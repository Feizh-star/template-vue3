import { RouteMeta } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    // 菜单中显示的标题
    title?: string
    // 控制在主菜单中显示隐藏
    hidden?: boolean
    // 控制只有一个显示的子路由时，是否 不要跳过本级展示唯一的子菜单
    alwaysShow?: boolean
    // 控制目录是否是叶子节点，即把在菜单中它作为最后一级，往往需要搭配component处理下级菜单，用于想要自定义后代菜单的情况
    isLeaf?: boolean
    // 第一层是否使用Layout布局，默认false，即默认第一层都会被包裹一层Layout。从第二层开始无用
    noLayout?: boolean
    // img图标暂不支持高亮
    icon?: {
      type: 'img' | 'class'
      value: string
    }
  }
}
declare global {
  interface IOriginRoute {
    // 建议单个单词，尽量唯一
    path: string
    // 必须唯一，会被自动设置为使用短横线分隔的路径表示，例如 menu1-menu11-page，menu1-menu12-page
    name: string
    // 叶子节点必须有component，单层叶子节点也可以通过设置noLayout为true，让component不使用Layout结构
    // 目录没有component时，作为纯目录，它的后代组件放在Layout中；
    // 目录有component时，在保证component组件有RouterView的前提下，分为两种情况：
    //    1.是第一层目录 且 不想把component放入Layout中，需要设置noLayout为true，此时component将没有Layout结构
    //    2.非第一层目录 或 第一层目录想把component放入Layout中（默认情况），不设置noLayout（保持默认）即可
    component?: string
    // 对于不是isLeaf的目录，会自动设置重定向到首个显示的子菜单，如果不想这样，可设置redirect为 '-1'
    redirect?: string
    meta?: RouteMeta
    // 对于目录，自动设置props.containerName等于它的name属性，用于解决不同目录下的组件缓存重复渲染问题
    // props.key会被自动设置为它的name属性
    props?: { [p: string]: any }
    children?: Array<IOriginRoute> | null
  }
}
