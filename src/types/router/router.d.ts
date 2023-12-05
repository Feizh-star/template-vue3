import { RouteMeta } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    icon?: {
      type: 'img' | 'class'
      value: string
    }
  }
}
declare global {
  interface MyRawRoute {
    path: string
    name: string
    component: string
    redirect?: string
    hidden?: boolean
    meta?: RouteMeta
    props?: { [p: string]: any }
    children?: Array<MyRawRoute> | null
  }
}
