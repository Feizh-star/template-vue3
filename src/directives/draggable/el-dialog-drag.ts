import Draggable from './draggable'
import type { Ref } from 'vue'

interface IElDialogDraggableArgs {
  dialogVisible: Ref<boolean>
  elRef: Ref<HTMLElement | undefined> | HTMLElement
  draggable: Ref<boolean>
  target?: string
  drag?: string
  disabledBack?: boolean
  closeBack?: boolean
}

export function useElDialogDraggable({
  dialogVisible,
  elRef,
  draggable,
  target,
  drag,
  disabledBack,
  closeBack,
}: IElDialogDraggableArgs) {
  target = target || '.el-dialog'
  drag = drag || '.el-dialog__header'
  disabledBack = !!disabledBack
  closeBack = !!closeBack
  let flag = false
  watch(dialogVisible, (newVal) => {
    if (newVal) {
      nextTick(() => {
        if (flag) return
        const rootEl = isRef(elRef) ? elRef.value : elRef
        if (!rootEl) return
        Draggable.mounted(rootEl, {
          value: {
            target: target,
            drag: drag,
            draggable: draggable.value,
            visible: dialogVisible.value,
            disabledBack,
            closeBack,
          },
        })
        flag = true
      })
    }
  })
  const update = (newDraggable: boolean, newVisible: boolean) => {
    const rootEl = isRef(elRef) ? elRef.value : elRef
    if (!rootEl) return
    nextTick(() => {
      Draggable.updated(rootEl, {
        value: {
          target: target,
          drag: drag,
          draggable: newDraggable,
          visible: newVisible || false,
        },
      })
    })
  }
  watch([() => draggable.value, () => dialogVisible.value], ([newDraggable, newVisible]) => {
    update(newDraggable, newVisible)
  })
  onBeforeUnmount(() => {
    const rootEl = isRef(elRef) ? elRef.value : elRef
    if (!rootEl) return
    Draggable.beforeUnmount(rootEl)
  })
  return {
    forceUpdate: () => {
      update(draggable.value, dialogVisible.value)
    },
  }
}
