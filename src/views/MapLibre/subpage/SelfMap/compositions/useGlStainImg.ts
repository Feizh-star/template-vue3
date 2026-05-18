/**
 * 通用：管理填色图组合式函数，如果更换地图库，只需修改底层api调用
 */
import { shallowRef } from 'vue'
import type { ShallowRef } from 'vue'
import { GlImg } from 'hxmap'
import type { IMapInstance, IGlImgInstance } from 'hxmap'

export interface IHclColorsRange {
  r: Array<number>
  g: Array<number>
  b: Array<number>
  v: Array<number>
  o: Array<number>
}
export interface IScaleProps {
  r: number
  g: number
  b: number
  a: number
}

export function useGlStainImg({ mapIns }: { mapIns: ShallowRef<IMapInstance | null> }) {
  const glStainImgLayer = shallowRef<IGlImgInstance | null>(null)
  const addGlStainImg = (
    url: string,
    color: IHclColorsRange,
    scale: IScaleProps,
    options: Record<string, any>
  ) => addGlStainImgFunc(mapIns, glStainImgLayer, url, color, scale, options)
  const updateGlStainImgUrl = (url: string) => updateGlStainImgUrlFunc(glStainImgLayer, url)
  const updateGlStainImgOption = (options: Record<string, any>) =>
    updateGlStainImgOptionFunc(glStainImgLayer, options)
  const hasGlStainImgLayer = () => !!glStainImgLayer.value
  const getValueByPosition = (lat: number, lon: number) =>
    getValueByPositionFunc(glStainImgLayer, lat, lon)
  const removeGlStainImg = () => removeGlStainImgFunc(mapIns, glStainImgLayer)
  onBeforeUnmount(() => {
    removeGlStainImg()
  })
  return {
    addGlStainImg,
    updateGlStainImgUrl,
    updateGlStainImgOption,
    hasGlStainImgLayer,
    getValueByPosition,
    removeGlStainImg,
  }
}

/**
 * 添加色斑图
 * @param url url
 * @param color 颜色配置
 * @param scale 缩放配置
 * @param options 其他选项
 */
function addGlStainImgFunc(
  mapIns: ShallowRef<IMapInstance | null>,
  glStainImgLayer: ShallowRef<IGlImgInstance | null>,
  url: string,
  color: IHclColorsRange,
  scale: IScaleProps,
  options: Record<string, any>
) {
  if (!mapIns.value) return
  removeGlStainImgFunc(mapIns, glStainImgLayer)
  try {
    const imgOption = {
      img: url,
      linear: 0, //设置色斑图的渐变度
      latmin: 31.7576,
      latmax: 43.6512,
      lonmin: 88.9501,
      lonmax: 112.5247,
      interval: 0.05,
      scale: scale,
      flipy: 0 as const,
      colors: color,
      grid: true,
      minOpacity: true,
      useCorrect: false,
      cut: false,
      cutUrl: '',
      cutlatmin: 30.9,
      cutlatmax: 32.6,
      cutlonmin: 116.5,
      cutlonmax: 118,
      useCros: true,
      preserveDrawingBuffer: false,
      ...options,
    }
    glStainImgLayer.value = new GlImg(imgOption)
    glStainImgLayer.value.setGetGrid(true)
    glStainImgLayer.value.addTo(mapIns.value)
  } catch (error) {
    console.error(error)
  }
}
/**
 * 更新图片地址
 * @param url url
 */
function updateGlStainImgUrlFunc(glStainImgLayer: ShallowRef<IGlImgInstance | null>, url: string) {
  if (!glStainImgLayer.value) return
  glStainImgLayer.value.changeImage(url)
}

/**
 * 更新配置
 * @param option Record<string, any>
 */
function updateGlStainImgOptionFunc(
  glStainImgLayer: ShallowRef<IGlImgInstance | null>,
  option: Record<string, any>
) {
  if (!glStainImgLayer.value) return
  ;(glStainImgLayer.value as any).changeAll(option)
}

function getValueByPositionFunc(
  glStainImgLayer: ShallowRef<IGlImgInstance | null>,
  lat: number,
  lon: number
) {
  if (!glStainImgLayer.value) return null
  return glStainImgLayer.value.getGridDataByLatLon(lat, lon)
}
/**
 * 移除色斑图
 */
function removeGlStainImgFunc(
  mapIns: ShallowRef<IMapInstance | null>,
  glStainImgLayer: ShallowRef<IGlImgInstance | null>
) {
  if (!glStainImgLayer.value) return
  if (mapIns.value) {
    glStainImgLayer.value.destroy(mapIns.value)
    glStainImgLayer.value = null
  }
}
