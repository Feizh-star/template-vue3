import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import type maplibregl from 'maplibre-gl'
import { debounce } from '@/utils/tools'
import { useStainImageCache } from '@/compositions/maplibre-gl/core/useStainImageCache/useStainImageCache'
import { useGlStainImg } from '@/compositions/maplibre-gl/core/useGlStainImg'
import type { IColorRange, IScaleProps } from '@/libs/ColorfulMapImage/types'
import cutUrl from '../../SelfMap/assets/100000.png'

interface IUseStainImgProps {
  mapIns: Ref<maplibregl.Map | null>
}

export const pngUrl = 'http://localhost:8085/tiansetu'

const opacity = 0.8
export const imgColor: IColorRange = {
  r: [235, 111, 124, 129, 155, 209, 250, 252, 252, 249, 247, 245, 235, 194, 158, 110],
  g: [235, 117, 150, 169, 226, 245, 247, 238, 214, 188, 158, 136, 100, 58, 40, 20],
  b: [235, 209, 217, 218, 144, 93, 70, 61, 36, 28, 20, 20, 38, 97, 115, 95],
  v: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500].map(
    (item) => item / 2
  ),
  o: new Array(16).fill(opacity) as number[],
}
export const imgScale: IScaleProps = {
  r: 1,
  g: 1,
  b: 1,
  a: 1,
}
export const defaultOption = {
  linear: 1,
  latmin: 17,
  latmax: 55,
  lonmin: 72,
  lonmax: 136,
  interval: 0.1,
  flipy: 0 as const,
  grid: false,
  minOpacity: false,
  cut: true,
  cutlatmin: 18.15,
  cutlatmax: 53.57,
  cutlonmin: 73.49,
  cutlonmax: 135.1,
  useCros: true,
  cutUrl: cutUrl,
}

export function useStainImg({ mapIns }: IUseStainImgProps) {
  const selectedTime = ref('')
  const timelineList = ref<string[]>([])
  const cacheTimeList = computed(() => {
    const dates = timelineList.value
    const index = dates.indexOf(selectedTime.value)
    if (index < 0) return [selectedTime.value, ...dates.slice(0, 2)].filter(Boolean)
    return [...dates, ...dates.slice(0, 3)].slice(index, index + 3)
  })
  const { getCurrentUrlWithCache, loading } = useStainImageCache(cacheTimeList, getStainImageUrl, {
    cacheDelay: 800,
  })
  const { drawGlStainImg, removeGlStainImg } = useGlStainImg({ mapIns })

  let requestVersion = 0
  const debounceAction = debounce(async (version: number) => {
    if (version !== requestVersion || !mapIns.value || !selectedTime.value) return
    const time = selectedTime.value
    try {
      const img = await getCurrentUrlWithCache(time)
      if (version !== requestVersion) return
      drawGlStainImg({
        ...defaultOption,
        scale: imgScale,
        colors: imgColor,
        getGrid: true,
        img,
      })
    } catch (error) {
      if (version !== requestVersion) return
      removeGlStainImg()
      console.error(error)
    }
  }, 60)

  watch(
    [mapIns, selectedTime],
    () => {
      const version = ++requestVersion
      if (!mapIns.value || !selectedTime.value) return
      debounceAction(version)
    },
    { immediate: true, flush: 'sync' }
  )
  onBeforeUnmount(() => {
    requestVersion++
    removeGlStainImg()
  })
  onMounted(() => {
    selectedTime.value = '202605171000'
  })

  function tlChange(_selected: string, timeList: { date: string }[]) {
    timelineList.value = timeList.map((item) => item.date)
  }

  return {
    selectedTime,
    tlChange,
    loading,
  }
}

export function getStainImageUrl(time: string) {
  return `${pngUrl}/${time}_ghi.png`
}
