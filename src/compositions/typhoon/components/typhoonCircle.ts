import type { ITyphoonPoint } from '../type'
import { lineArc } from '../tools/lineArc'
import {
  GeojsonPolygon,
  GeojsonLines,
  type IGeojsonLinesInstance,
  type IGeojsonPolygonInstance,
} from 'hxmap'

// 台风7级、10级风圈、12级风圈,
export function getTyphoonCircle(
  pt: ITyphoonPoint,
  index: number
): (IGeojsonLinesInstance | IGeojsonPolygonInstance)[] {
  const { lat, lon } = pt
  const NE_l7 = pt.radiuBear1WingA7 > 99999 ? 0 : pt.radiuBear1WingA7
  const NW_l7 = pt.radiuBear2WingA7 > 99999 ? 0 : pt.radiuBear2WingA7
  const SE_l7 = pt.radiuBear3WingA7 > 99999 ? 0 : pt.radiuBear3WingA7
  const SW_l7 = pt.radiuBear4WingA7 > 99999 ? 0 : pt.radiuBear4WingA7

  const NE_l10 = pt.radiuBear1WingA10 > 99999 ? 0 : pt.radiuBear1WingA10
  const NW_l10 = pt.radiuBear2WingA10 > 99999 ? 0 : pt.radiuBear2WingA10
  const SE_l10 = pt.radiuBear3WingA10 > 99999 ? 0 : pt.radiuBear3WingA10
  const SW_l10 = pt.radiuBear4WingA10 > 99999 ? 0 : pt.radiuBear4WingA10

  const NE_l12 = pt.radiuBear1WingA12 > 99999 ? 0 : pt.radiuBear1WingA12
  const NW_l12 = pt.radiuBear2WingA12 > 99999 ? 0 : pt.radiuBear2WingA12
  const SE_l12 = pt.radiuBear3WingA12 > 99999 ? 0 : pt.radiuBear3WingA12
  const SW_l12 = pt.radiuBear4WingA12 > 99999 ? 0 : pt.radiuBear4WingA12

  const r7Ne = lineArc([lon, lat], NE_l7, 0, 90)
  const r7Se = lineArc([lon, lat], SE_l7, 90, 180)
  const r7Sw = lineArc([lon, lat], SW_l7, 180, 270)
  const r7Nw = lineArc([lon, lat], NW_l7, 270, 360)

  const r10Ne = lineArc([lon, lat], NE_l10, 0, 90)
  const r10Se = lineArc([lon, lat], SE_l10, 90, 180)
  const r10Sw = lineArc([lon, lat], SW_l10, 180, 270)
  const r10Nw = lineArc([lon, lat], NW_l10, 270, 360)

  const r12Ne = lineArc([lon, lat], NE_l12, 0, 90)
  const r12Se = lineArc([lon, lat], SE_l12, 90, 180)
  const r12Sw = lineArc([lon, lat], SW_l12, 180, 270)
  const r12Nw = lineArc([lon, lat], NW_l12, 270, 360)
  // 7级风圈
  const geojson7 = wrapToGeoJSONPolygon(
    [...r7Ne, ...r7Se, ...r7Sw, ...r7Nw].map((p) => [p[1], p[0]])
  )
  const circle7 = new GeojsonPolygon({
    data: geojson7,
    index: index,
    color: [244, 208, 0, 85],
  })
  const circleLine7 = new GeojsonLines({
    data: geojson7,
    lineWidth: 2,
    index: index,
    color: [244, 208, 0, 255],
  })

  // 10级风圈
  const geojson10 = wrapToGeoJSONPolygon(
    [...r10Ne, ...r10Se, ...r10Sw, ...r10Nw].map((p) => [p[1], p[0]])
  )
  const circle10 = new GeojsonPolygon({
    data: geojson10,
    index: index,
    color: [244, 208, 0, 135],
  })
  const circleLine10 = new GeojsonLines({
    data: geojson10,
    lineWidth: 2,
    index: index,
    color: [244, 208, 0, 255],
  })

  // 12级风圈
  const geojson12 = wrapToGeoJSONPolygon(
    [...r12Ne, ...r12Se, ...r12Sw, ...r12Nw].map((p) => [p[1], p[0]])
  )
  const circle12 = new GeojsonPolygon({
    data: geojson12,
    index: index,
    color: [244, 208, 0, 135],
  })
  const circleLine12 = new GeojsonLines({
    data: geojson12,
    lineWidth: 2,
    index: index,
    color: [244, 208, 0, 255],
  })

  return [circle7, circleLine7, circle10, circleLine10, circle12, circleLine12]
}
/**
 * 将二维数组坐标转换为 GeoJSON Polygon 格式
 * @param {Array<Array<number>>} coordinates - 坐标数组，例如 [[lng, lat], [lng, lat], ...]
 * @param {Object} properties - 可选的属性对象
 * @returns {Object} GeoJSON Feature
 */
export function wrapToGeoJSONPolygon(coordinates: number[][], properties = {}) {
  if (!Array.isArray(coordinates) || coordinates.length < 3) {
    throw new Error('多边形至少需要3个坐标点')
  }

  // 深度克隆一份数据，避免修改原始数组
  const coords = [...coordinates.map((p) => [...p])]

  // 检查是否闭合（起点和终点坐标是否相同）
  const first = coords[0]
  const last = coords[coords.length - 1]

  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([first[0], first[1]]) // 自动补齐闭合点
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords], // 包装成 GeoJSON 要求的嵌套结构
    },
    properties: properties,
  } as GeoJSON.Feature
}
