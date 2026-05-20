import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import type maplibregl from 'maplibre-gl'
import { ColorfulMapImage } from '@/libs/ColorfulMapImage'
import type { IColorRange, IScaleProps } from '@/libs/ColorfulMapImage/types'
import cutUrl from '../../SelfMap/assets/100000.png'

interface IUseStainImgProps {
  mapIns: Ref<maplibregl.Map | null>
}

const pngUrl = 'http://localhost/tiansetu'

const opacity = 0.8
const imgColor: IColorRange = {
  r: [235, 111, 124, 129, 155, 209, 250, 252, 252, 249, 247, 245, 235, 194, 158, 110],
  g: [235, 117, 150, 169, 226, 245, 247, 238, 214, 188, 158, 136, 100, 58, 40, 20],
  b: [235, 209, 217, 218, 144, 93, 70, 61, 36, 28, 20, 20, 38, 97, 115, 95],
  v: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500].map(
    (item) => item / 2
  ),
  o: new Array(16).fill(opacity) as number[],
}
const imgScale: IScaleProps = {
  r: 1,
  g: 1,
  b: 1,
  a: 1,
}
const defaultOption = {
  linear: 1,
  latmin: 17,
  latmax: 55,
  lonmin: 72,
  lonmax: 136,
  interval: 0.1,
  flipy: 0 as const,
  grid: false,
  minOpacity: false,
  useCorrect: false,
  cut: true,
  cutlatmin: 18.15,
  cutlatmax: 53.57,
  cutlonmin: 73.49,
  cutlonmax: 135.1,
  useCros: true,
  preserveDrawingBuffer: false,
  cutUrl: cutUrl,
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
    return `${pngUrl}/${time}_ghi.png`
  }

  return {
    selectedTime,
  }
}
