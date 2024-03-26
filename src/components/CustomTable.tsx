/**
 * 一个把el-table的模板写法变成配置对象写法的组件，提高复杂多层级表头切换的便利性
 * el-table的参数和事件：直接给本组件即可，和普通el-table用法一样，支持所有参数和事件
 * el-table的方法：const table = ref(); table.value.$refs.eltable：可以通过这种方式获取el-table的引用
 * el-table的插槽append和empty：作为参数传递(createVnode: typeof h) => ReturnType<typeof h>类型的函数即可
 * el-table-column的参数：通过columns数组配置所有列，每个对象中有一个props对象，会被作为el-table-column的参数，支持所有参数
 * commonProps：有一些el-table-column的参数所有列都需要，可以一次性统一用commonProps给定
 */

import { ElTable, ElTableColumn, ElLoadingDirective } from 'element-plus'
import { h, computed, defineComponent, useAttrs, withDirectives, resolveDirective } from 'vue'
import type { PropType } from 'vue'

type AnyObject = { [p: string]: any }
type TableSlot = (createVnode: typeof h) => ReturnType<typeof h>

export interface IColumn {
  props: AnyObject
  formatter?: (createVnode: typeof h, cfg: AnyObject, scope: any) => ReturnType<typeof h>
  headerFormatter?: (createVnode: typeof h, cfg: AnyObject, scope: any) => ReturnType<typeof h>
  children?: Array<IColumn>
}

export default defineComponent({
  props: {
    columns: {
      type: Array as PropType<Array<IColumn>>,
      default: () => [],
    },
    // 显示loading
    loading: Boolean,
    // 通用的列参数，可被columns中的覆盖
    commonProps: {
      type: Object,
      default: () => ({
        align: 'center',
        headerAlign: 'center',
        showOverflowTooltip: true,
      }),
    },
    // 一个会被传入formatter和headerFormatter中的对象，自定自用
    deps: {
      type: Object,
      default() {
        return {}
      },
    },
    // 表格的append插槽
    append: {
      type: Function as PropType<TableSlot>,
    },
    // 表格的empty插槽
    empty: {
      type: Function as PropType<TableSlot>,
    },
  },
  directives: {
    loading: ElLoadingDirective,
  },
  emits: ['update:loading'],
  setup(props, ctx) {
    const attrs = useAttrs()
    const tableKey = computed(() => (props.columns, Math.random().toString(36).slice(2, 10)))
    const showLoading = computed({
      get() {
        return props.loading
      },
      set(value) {
        ctx.emit('update:loading', value)
      },
    })
    const getElColumn = (cols: any[]) =>
      cols.map((column) => {
        const type = column.props.type
        const formatter = column.formatter
        const headerFormatter = column.headerFormatter
        // ElTableColumn的default插槽：包含嵌套的ElTableColumn 或 具体内容
        const tableColumnDefaultSlot = (scope: { row: { [x: string]: any } }) => {
          if (column.children?.length > 0) {
            return getElColumn(column.children || [])
          } else if (Object.prototype.toString.call(formatter) === '[object Function]') {
            return formatter(h, { ...column, deps: props.deps }, scope)
          } else {
            return <span>{scope.row[column.props?.prop || ''] ?? ''}</span>
          }
        }
        // ElTableColumn的header插槽
        const tableColumnHeaderSlot = (scope: any) => {
          if (Object.prototype.toString.call(headerFormatter) === '[object Function]') {
            return headerFormatter(h, { ...column, deps: props.deps }, scope)
          } else {
            return <div>{column.props?.label || ''}</div>
          }
        }
        const scopedSlots = {
          header: tableColumnHeaderSlot,
          default:
            (type !== 'index' && type !== 'selection') || formatter
              ? tableColumnDefaultSlot
              : undefined,
        }
        return h(
          ElTableColumn,
          {
            ...props.commonProps,
            ...column.props,
          },
          scopedSlots
        )
      })
    const tableScopedSlots = {
      default: () => getElColumn(props.columns),
      empty: () => {
        if (props.empty) {
          return props.empty(h)
        }
      },
      append: () => {
        if (props.append) {
          return props.append(h)
        }
      },
    }
    return () =>
      withDirectives(h(ElTable, { ...attrs, key: tableKey.value }, tableScopedSlots), [
        [resolveDirective('loading'), showLoading.value], // loading指令
      ])
  },
})
