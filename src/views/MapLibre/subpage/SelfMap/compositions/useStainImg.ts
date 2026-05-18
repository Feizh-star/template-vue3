import moment from 'moment'
import { debounce, isEffectiveNumber } from '@/utils/tools'
import { useGlStainImg } from './useGlStainImg'
import type { Ref } from 'vue'
import type { IMapInstance } from 'hxmap'
import cutUrl from '../assets/100000.png'

interface IUseStainImgProps {
  mapIns: Ref<IMapInstance | null>
}

const pngUrl = 'http://localhost/tiansetu'

const opacity = 0.8
const imgColor = {
  r: [235, 111, 124, 129, 155, 209, 250, 252, 252, 249, 247, 245, 235, 194, 158, 110],
  g: [235, 117, 150, 169, 226, 245, 247, 238, 214, 188, 158, 136, 100, 58, 40, 20],
  b: [235, 209, 217, 218, 144, 93, 70, 61, 36, 28, 20, 20, 38, 97, 115, 95],
  v: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500].map(
    (item) => item / 2
  ),
  o: new Array(16).fill(opacity) as number[],
}
const imgScale = {
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
  flipy: 0,
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
  index: 200,
  cutUrl: cutUrl,
}

export function useStainImg({ mapIns }: IUseStainImgProps) {
  const { addGlStainImg, updateGlStainImgOption, hasGlStainImgLayer, removeGlStainImg } =
    useGlStainImg({ mapIns })

  onBeforeUnmount(() => {
    removeGlStainImg()
  })

  const selectedTime = ref('')
  // 时间变化单独写，只改变url不重新绘制
  watch(selectedTime, () => {
    drawStainImg(getUrl(selectedTime.value))
  })
  onMounted(() => {
    selectedTime.value = '202605171000'
  })

  // repaint：从右往左，第一位是1，重绘填色图；第二位是1，重绘格点
  function drawStainImg(url: string) {
    if (!mapIns.value) return
    try {
      // 从右往左，第一位是1，时间变化；第二位是1，要素变化(那么url一定变化)
      if (hasGlStainImgLayer()) {
        const newPartialOption = {
          scale: imgScale,
          minOpacity: false,
          colors: imgColor,
          url: url,
        }
        updateGlStainImgOption(newPartialOption)
      } else {
        addGlStainImg(url, imgColor, imgScale, defaultOption)
      }
    } catch (error) {
      console.error(error)
    }
  }

  function getUrl(time: string) {
    const resUrl = `${pngUrl}/${time}_ghi.png`
    return resUrl
  }

  return {
    selectedTime,
  }
}
