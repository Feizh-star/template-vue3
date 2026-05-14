import maplibregl from 'maplibre-gl'
import * as THREE from 'three'
import * as lodashLib from 'lodash'
import { Gplot3DEffect } from '../Gplot3DEffect/Gplot3DEffect'
import { filterAttrbuteByKeys } from '../tools/common'

interface IGplot3DLayerOption extends IGplot3DEffectOption {
  origin: maplibregl.LngLatLike
}
type ILayerOption = Omit<IGplot3DLayerOption, keyof IGplot3DEffectOption>

const defaultOption: ILayerOption = {
  origin: [115, 40],
}

export class Gplot3DLayer extends Gplot3DEffect implements maplibregl.CustomLayerInterface {
  public id = '3d-model'
  public type = 'custom' as const
  public renderingMode = '3d' as const
  protected layerOption: ILayerOption
  protected map!: maplibregl.Map
  constructor(layerOption?: DeepPartial<IGplot3DLayerOption>) {
    super(layerOption as any)
    this.layerOption = lodashLib.mergeWith(
      lodashLib.cloneDeep(defaultOption),
      filterAttrbuteByKeys(layerOption || {}, Object.keys(defaultOption))
    )
  }

  /**
   * 实现抽象类的抽象属性/方法
   */
  protected initScene() {
    this.scene = new THREE.Scene()
  }
  protected initCamera() {
    this.camera = new THREE.PerspectiveCamera()
  }
  public startEffect() {
    this.animationInitiator.startAnimationInitiator()
  }
  public stopEffect() {
    this.animationInitiator.stopAnimationInitiator()
  }
  /**
   * 覆写入口，转换坐标
   */
  // 使用经纬度坐标添加连线
  addFlowLinesLnglat(lineData: IFlowLineItem[]) {
    const origin = this.layerOption.origin
    this.addFlowLines(
      lineData.map((line) => {
        const path =
          line.path?.map((item) =>
            lnglatToWorldInMercator(this.map, origin, [item[0], item[1]], item[2])
          ) || []
        return { ...line, path }
      })
    )
  }
  // 使用经纬度坐标添加模型
  addGltfNodesLngLat(nodeData: DeepPartial<IGltfNodeItem>[]) {
    const origin = this.layerOption.origin
    this.addGltfNodes(
      nodeData.map((node) => {
        const pos = node.position
        const position = pos
          ? lnglatToWorldInMercator(this.map, origin, [pos[0], pos[1]], pos[2])
          : undefined
        return { ...node, position }
      })
    )
  }
  // 使用经纬度坐标添加区域
  addRailsLngLat(rails: IRailItem[]) {
    const origin = this.layerOption.origin
    this.addRails(
      rails.map((line) => {
        const lnglatPath =
          line.path?.map((item) =>
            lnglatToWorldInMercator(this.map, origin, [item[0], item[1]], item[2])
          ) || []
        return { ...line, path: lnglatPath }
      })
    )
  }
  // 使用经纬度坐标添加精灵图
  addSpriteNodesLngLat(nodeData: DeepPartial<ISpriteNodeItem>[]) {
    const origin = this.layerOption.origin
    this.addSpriteNodes(
      nodeData.map((node) => {
        const pos = node.position
        const position = pos
          ? lnglatToWorldInMercator(this.map, origin, [pos[0], pos[1]], pos[2])
          : undefined
        return { ...node, position }
      })
    )
  }

  /**
   * 图层生命周期：添加自定义图层时调用
   * @param map maplibregl.Map
   * @param gl WebGL2RenderingContext | WebGLRenderingContext
   */
  onAdd(map: maplibregl.Map) {
    this.map = map
    this.initEffect(map.getCanvas(), true)
  }
  /**
   * 图层生命周期：移除自定义图层时调用
   */
  onRemove() {
    this.destoryEffect()
  }
  /**
   * 每一帧都会被调用
   * @param gl WebGL2RenderingContext | WebGLRenderingContext
   * @param args maplibregl.CustomRenderMethodInput
   */
  render(
    gl: WebGL2RenderingContext | WebGLRenderingContext,
    args: maplibregl.CustomRenderMethodInput
  ) {
    const offsetFromCenterElevation = this.map.queryTerrainElevation(this.layerOption.origin) || 0
    const sceneOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(
      this.layerOption.origin,
      offsetFromCenterElevation
    )
    const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2)

    const scale = sceneOriginMercator.meterInMercatorCoordinateUnits()

    // maplibre的球面墨卡托坐标系下的视图投影矩阵
    const viewProjectionOfMercator = new THREE.Matrix4().fromArray(
      args.defaultProjectionData.mainMatrix
    )
    // 将threejs世界（看作一个整体的模型）变换到墨卡托投影指定大小、角度和位置的模型矩阵
    const modelOfThreeCoordinate = new THREE.Matrix4()
      .makeTranslation(sceneOriginMercator.x, sceneOriginMercator.y, sceneOriginMercator.z)
      .multiply(rotationX)
      .scale(new THREE.Vector3(scale, scale, -scale))
    // 最终得到threejs的视图投影矩阵
    this.camera.projectionMatrix = viewProjectionOfMercator.multiply(modelOfThreeCoordinate)
    this.renderer.resetState()
    this.tickEffect()
    this.map.triggerRepaint()
  }
}

export function calculateDistanceMercatorToMeters(
  from: maplibregl.MercatorCoordinate,
  to: maplibregl.MercatorCoordinate
) {
  const mercatorPerMeter = from.meterInMercatorCoordinateUnits()
  // mercator x: 0=west, 1=east
  const dEast = to.x - from.x
  const dEastMeter = dEast / mercatorPerMeter
  // mercator y: 0=north, 1=south
  const dNorth = from.y - to.y
  const dNorthMeter = dNorth / mercatorPerMeter
  return { dEastMeter, dNorthMeter }
}

export function lnglatToWorldInMercator(
  map: maplibregl.Map,
  center: maplibregl.LngLatLike,
  lnglat: maplibregl.LngLatLike,
  eleOffset: number
) {
  const sceneElevation = map.queryTerrainElevation(center) || 0
  const modelElevation = map.queryTerrainElevation(lnglat) || 0
  const up = modelElevation - sceneElevation + eleOffset

  const centerMercator = maplibregl.MercatorCoordinate.fromLngLat(center)
  const pointMercator = maplibregl.MercatorCoordinate.fromLngLat(lnglat)
  const { dEastMeter: east, dNorthMeter: north } = calculateDistanceMercatorToMeters(
    centerMercator,
    pointMercator
  )
  // east => x, up => y, -north => z，这里的xyz还是threejs中的坐标系（x轴朝东，y轴朝上，z轴朝南），在render中经过绕x轴逆时针旋转90度（x轴朝东，y轴朝南，z轴朝下），再对z取反，才变换到maplibre坐标系（x轴朝东，y轴朝南，z轴朝上）
  return [east, up, -north] as [number, number, number]
}
