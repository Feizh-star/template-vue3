import type { Ref } from 'vue'
import { scrollTo } from '@/utils/scroll'

export function useElTableScrollTo({
  eltableRef,
  tableData,
  targetIndex,
}: {
  eltableRef: Ref<any>
  tableData: Ref<any[]>
  targetIndex: Ref<number>
}) {
  // 表格数据刷新后定位到最新时间的那一行
  const handleScroll = (tryTimes = 0) => {
    nextTick(() => {
      const eltable = eltableRef.value?.setScrollTop
        ? eltableRef.value
        : eltableRef.value?.$refs.eltable
      if (!eltable) return
      const theTableRows = eltable.$el.querySelectorAll('.el-table__body tbody .el-table__row')
      const scrollbarEls = eltable.$el.getElementsByClassName('el-scrollbar__wrap')
      const scrollbarEl = scrollbarEls?.length > 0 ? scrollbarEls[0] : null
      let scrollTop = 0
      for (let i = 0; i < theTableRows.length; i++) {
        if (i === targetIndex.value) break
        scrollTop += theTableRows[i].offsetHeight
      }
      if (scrollTop === 0 && tryTimes < 10) {
        setTimeout(() => {
          tryTimes++
          handleScroll(tryTimes)
        }, 30)
      } else {
        scrollTo({
          scrollbarCom: eltable,
          el: scrollbarEl as HTMLElement,
          to: scrollTop,
          duration: 400,
          scrollKey: 'scrollTop',
        })
      }
    })
  }
  watch(tableData, () => {
    handleScroll()
  })
  onActivated(() => {
    handleScroll()
  })
}
