import type { ComponentPublicInstance } from 'vue'

export interface IAnyObject {
  [p: string]: any
}
export type TCreateVnode = typeof h

export interface IFormConfig {
  type: ('query' | 'edit')[] // query————表单组件在搜索栏显示；edit————表单组件在新增/修改弹窗中显示
  hidden: boolean // type包含edit时，hidden可以控制弹窗中是否显示本字段的表单
  label: string // el-form-item 的label
  key: string // 表单v-model绑定的key
  originValue: any // 初始值
  elFormItem: IAnyObject // el-form-item 任意props
  modelEventType: string // 指定v-model绑定的事件
  component: string | ComponentPublicInstance // 表单的名称或组件
  validator: {
    edit: IAnyObject[]
    query: IAnyObject[]
  }
  // 用于element-ui之外的自定义表单组件的自定义校验
  customValidator: {
    edit: {
      validator: (event: any, formData: IAnyObject, cb: (msg: string) => void) => void
      trigger: string
    }[]
    query: {
      validator: (event: any, formData: IAnyObject, cb: (msg: string) => void) => void
      trigger: string
    }[]
  }
  // 在v-model事件中添加逻辑，例如需要再input事件中处理一些事情
  inputHandler: (event: any, formData: IAnyObject) => void
  optionComponent: string | ComponentPublicInstance // 指定el-select组件的子级组件
  optionComponentLabel: string // el-option的label取值的key
  optionComponentValue: string // el-option的value取值的key
  // 自定义表单子级元素的生成逻辑，已el-option为例
  genOptionsVnode: (
    h: TCreateVnode,
    formCfg: IFormConfig,
    optionsData: IAnyObject[]
  ) => ReturnType<typeof h>[]
  // 自定义表单的参数：props————内置默认props；formCfg————当前formCfg对象
  customPropsHook: (props: IAnyObject, formCfg: IFormConfig) => IAnyObject
  // 自定义表单的监听事件：listeners————内置默认listeners：formCfg————当前formCfg对象
  customListenerHook: (listeners: IAnyObject, formCfg: IFormConfig) => IAnyObject
  // 自定义表单的原生属性(例如el-input的placeholder)：attrs————内置默认attrs；formCfg————当前formCfg对象
  customAttrsHook: (attrs: IAnyObject, formCfg: IFormConfig) => IAnyObject
}
