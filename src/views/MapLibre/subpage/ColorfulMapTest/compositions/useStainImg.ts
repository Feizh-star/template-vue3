import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import type maplibregl from 'maplibre-gl'
import { ColorfulMapImage } from '@/libs/ColorfulMapImage'
import type { IColorRange, IScaleProps } from '@/libs/ColorfulMapImage/types'
import cutUrl from '../../SelfMap/assets/100000.png'
import cutUrl65 from '../../SelfMap/assets/650000.png'

interface IUseStainImgProps {
  mapIns: Ref<maplibregl.Map | null>
}

export const pngUrl = 'http://localhost:8085/tiansetu'

const opacity = 0.8
export const imgColor: IColorRange = {
  r: [0, 0, 0, 0, 2, 6, 37, 110, 182, 255, 255, 255, 255, 255, 255, 218],
  g: [0, 77, 155, 232, 239, 197, 188, 210, 233, 255, 228, 200, 173, 130, 80, 26],
  b: [255, 255, 255, 255, 204, 73, 13, 9, 4, 0, 0, 0, 0, 0, 0, 26],
  v: [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 82, 88, 92],
  o: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
}
export const imgScale: IScaleProps = {
  r: 10,
  g: 10,
  b: 10,
  a: 1,
}
export const defaultOption = {
  linear: 1,
  latmin: 43.43,
  latmax: 45.67,
  lonmin: 87.32,
  lonmax: 90.96,
  interval: 0.01,
  flipy: 0 as const,
  grid: false,
  minOpacity: true,
  useCorrect: false,
  cut: true,
  cutlatmin: 34.33,
  cutlatmax: 49.19,
  cutlonmin: 73.49,
  cutlonmax: 96.4,
  useCros: true,
  preserveDrawingBuffer: false,
  cutUrl: cutUrl65,
}

export function useStainImg({ mapIns }: IUseStainImgProps) {
  const stainImgLayer = ref<ColorfulMapImage | null>(null)

  onBeforeUnmount(() => {
    if (stainImgLayer.value) {
      stainImgLayer.value.destroy()
      stainImgLayer.value = null
    }
  })

  const selectedTime = ref('')
  watch(selectedTime, () => {
    drawStainImg(getUrl(selectedTime.value))
  })
  onMounted(() => {
    selectedTime.value = '202605171000'
  })

  // 当 map 就绪时触发首次绘制（此时 selectedTime 已赋值）
  watch(mapIns, (newMap, oldMap) => {
    if (newMap && !oldMap && selectedTime.value) {
      drawStainImg(getUrl(selectedTime.value))
    }
  })

  function drawStainImg(url: string) {
    if (!mapIns.value) return
    url = 'http://localhost:3124/glimg/xjms/png/1km/2026010100/T2_C/202601010000_202601010000.png'
    try {
      if (stainImgLayer.value) {
        stainImgLayer.value.changeAll({
          scale: imgScale,
          minOpacity: false,
          colors: imgColor,
          img: url,
        })
      } else {
        const layer = new ColorfulMapImage({
          img: url,
          scale: imgScale,
          colors: imgColor,
          ...defaultOption,
        })
        layer.setGetGrid(true)
        layer.addTo(mapIns.value)
        stainImgLayer.value = layer
      }
    } catch (error) {
      console.error(error)
    }
  }

  function getUrl(time: string) {
    return getStainImageUrl(time)
  }

  return {
    selectedTime,
  }
}

export function getStainImageUrl(time: string) {
  return `${pngUrl}/${time}_ghi.png`
}
