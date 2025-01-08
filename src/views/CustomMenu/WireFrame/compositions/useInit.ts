import type { Ref } from 'vue'
import { init } from '../wireframe/init'

interface IParams {
  canvasRef: Ref<HTMLCanvasElement | null>
}

export function useInit({ canvasRef }: IParams) {
  onMounted(() => {
    canvasRef.value && init(canvasRef.value)
  })
}
