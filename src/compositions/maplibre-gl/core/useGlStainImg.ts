import type { Map } from 'maplibre-gl'
import type { ShallowRef } from 'vue'
import { onBeforeUnmount } from 'vue'
import { ColorfulMapImage } from '@/libs/ColorfulMapImage'
import type { IColorfulMapImageOptions } from '@/libs/ColorfulMapImage'

export function useGlStainImg({ mapIns }: { mapIns: ShallowRef<Map | null> }) {
  let layer: ColorfulMapImage | null = null
  let submitted: Partial<IColorfulMapImageOptions> = {}
  const removeGlStainImg = () => {
    layer?.destroy()
    layer = null
    submitted = {}
  }
  const drawGlStainImg = (options: Partial<IColorfulMapImageOptions>) => {
    if (!mapIns.value) return
    const configuration = { ...submitted, ...options }
    if (layer) {
      const patch = Object.fromEntries(
        Object.entries(options).filter(
          ([key, value]) => submitted[key as keyof typeof submitted] !== value
        )
      )
      if (Object.keys(patch).length) layer.setOption(patch)
    } else {
      if (!hasImageOptions(configuration)) return
      layer = new ColorfulMapImage({ useCros: true, ...configuration })
      layer.addTo(mapIns.value)
    }
    submitted = configuration
  }
  onBeforeUnmount(removeGlStainImg)
  return {
    drawGlStainImg,
    removeGlStainImg,
  }
}

function hasImageOptions(
  options: Partial<IColorfulMapImageOptions>
): options is IColorfulMapImageOptions {
  return (
    !!options.img &&
    !!options.colors &&
    !!options.scale &&
    typeof options.latmin === 'number' &&
    typeof options.latmax === 'number' &&
    typeof options.lonmin === 'number' &&
    typeof options.lonmax === 'number' &&
    options.latmin < options.latmax &&
    options.lonmin < options.lonmax
  )
}
