import { homeTyphoonManager } from '@/compositions/typhoon/index'
import type { IMapInstance2 } from 'hxmap'
import type { Ref } from 'vue'
// @ts-ignore
import TyphoonDatas from '../data/typhoon.json'

export function useTyphoon({ mapInstance }: { mapInstance: Ref<IMapInstance2> }) {
  const testTyphoon = (type: number) => {
    if (type === 1) {
      homeTyphoonManager.addHomeTyphoons(mapInstance.value as IMapInstance2, TyphoonDatas, true)
    }
    if (type === 2) {
      homeTyphoonManager.clearHomeTyphoons(mapInstance.value as IMapInstance2)
    }
  }
  return {
    testTyphoon,
  }
}
