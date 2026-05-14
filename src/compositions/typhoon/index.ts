import type { IMapInstance2 } from 'hxmap'
import { TyphoonLayer, getTyphoonWarnLineLayer } from './Typhoon'
import type { ITyphoonData } from './type'

export const homeTyphoonManager = {
  homeTyphoonList: [] as TyphoonLayer[],
  ...getTyphoonWarnLineLayer(),
  addHomeTyphoons(map: IMapInstance2, datas: ITyphoonData[], setBound = false) {
    if (!map) {
      throw new Error('There is not a map instance!')
    }
    if (!datas?.length) {
      throw new Error('Please provide a data object!')
    }
    this.clearHomeTyphoons(map)
    if (setBound) {
      const allCoord = datas
        .map((item) =>
          [...(item.typh_skdata || []), ...(item.typh_fcstdata || [])].map((point) => [
            point.lat,
            point.lon,
          ])
        )
        .flat()
      const allLat = allCoord.map((item) => item[0]).filter((item) => item || item === 0)
      const allLon = allCoord.map((item) => item[1]).filter((item) => item || item === 0)
      const latmin = Math.min(...allLat)
      const lonmin = Math.min(...allLon)
      const latmax = Math.max(...allLat)
      const lonmax = Math.max(...allLon)
      map.flyToBounds(latmin, latmax, lonmin, lonmax)
    }
    for (const item of datas) {
      this.homeTyphoonList.push(new TyphoonLayer({ map, data: item }))
    }
    if (datas.length > 0) {
      this.line24.addTo(map)
      this.line48.addTo(map)
      this.text24.addTo(map)
      this.text48.addTo(map)
    }
  },
  clearHomeTyphoons(map: IMapInstance2) {
    for (const item of this.homeTyphoonList) {
      try {
        item?.destroy()
      } catch (error) {
        console.error(error)
      }
    }
    this.homeTyphoonList = []
    if (this.line24 && map.hasLayer(this.line24)) this.line24.removeFromMap(map)
    if (this.line48 && map.hasLayer(this.line48)) this.line48.removeFromMap(map)
    if (this.text24 && map.hasLayer(this.text24)) this.text24.removeFromMap(map)
    if (this.text48 && map.hasLayer(this.text48)) this.text48.removeFromMap(map)
  },
}
