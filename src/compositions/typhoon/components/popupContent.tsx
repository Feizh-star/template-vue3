import type { ITyphoonPoint } from '../type'
import { render } from 'vue'
import { Close } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import './popupContentStyle.less'
import { numberFixed } from '@/utils/math'
import { isEffectiveNumber } from '@/utils/tools'
import { getTyphoonLevel, getWindDirect } from '../tools/tool'

export function renderPopupContent({ data, type }: { data: ITyphoonPoint; type: 'sk' | 'fcst' }) {
  const name = `${data.numNati} ${data.typhName}`
  const typeName = type === 'sk' ? '观测' : '预报'
  const dataTime = data.dataTime
  const [month, day, hour] = [
    dataTime.substring(2, 4),
    dataTime.substring(4, 6),
    dataTime.substring(6, 8),
  ]
  const lonUnit = isEffectiveNumber(data.lon) ? (data.lon >= 0 ? '°E' : '°W') : ''
  const latUnit = isEffectiveNumber(data.lat) ? (data.lat >= 0 ? '°N' : '°S') : ''
  // 基础信息
  const dataList = [
    { label: '时间：', value: `${month}月${day}日 ${hour}时`, unit: '' },
    { label: '台风等级：', value: getTyphoonLevel(data.typhGrade), unit: '' },
    {
      label: '中心位置：',
      value: `${data.lon ?? ''}${lonUnit} / ${data.lat ?? ''}${latUnit}`,
      unit: '',
    },
    isEffectiveNumber(data.prs)
      ? { label: '中心气压：', value: numberFixed(data.prs, 2), unit: '百帕' }
      : null,
    isEffectiveNumber(data.winSContiMax)
      ? { label: '最大风速：', value: numberFixed(data.winSContiMax, 2), unit: 'm/s' }
      : null,
    isEffectiveNumber(data.modirFuture)
      ? { label: '移动方向：', value: getWindDirect(data.modirFuture)[1] || '', unit: '' }
      : null,
    isEffectiveNumber(data.mospeedFutrue)
      ? { label: '移动速度：', value: numberFixed(data.mospeedFutrue, 2), unit: 'km/h' }
      : null,
  ].filter(Boolean) as { label: string; value: string; unit: string }[]

  // 风圈半径
  const circleRadius7 = [
    data.radiuBear1WingA7,
    data.radiuBear3WingA7,
    data.radiuBear4WingA7,
    data.radiuBear2WingA7,
  ]
  const circle7 = circleRadius7.every((item) => isEffectiveNumber(item)) ? circleRadius7 : null
  const circleRadius10 = [
    data.radiuBear1WingA10,
    data.radiuBear3WingA10,
    data.radiuBear4WingA10,
    data.radiuBear2WingA10,
  ]
  const circle10 = circleRadius10.every((item) => isEffectiveNumber(item)) ? circleRadius10 : null
  const circleRadius12 = [
    data.radiuBear1WingA12,
    data.radiuBear3WingA12,
    data.radiuBear4WingA12,
    data.radiuBear2WingA12,
  ]
  const circle12 = circleRadius12.every((item) => isEffectiveNumber(item)) ? circleRadius12 : null
  const tableData =
    circle7 || circle10 || circle12
      ? [
          { label: '风圈半径：', value: ['东北', '东南', '西南', '西北'], unit: '' },
          { label: '七级：', value: circle7 || new Array(4).fill(''), unit: 'KM' },
          { label: '十级：', value: circle10 || new Array(4).fill(''), unit: 'KM' },
          { label: '十二级：', value: circle12 || new Array(4).fill(''), unit: 'KM' },
        ]
      : []

  const iconContainer = document.createElement('div')
  render(
    <div class="typhoon-popup-dialog">
      <div class="dialog-title">
        <div class="title-content">
          <span class="typhoon-name">{name}</span>
          <span class="typhoon-type">{typeName}</span>
        </div>
        <span class="typhoon-close-icon">
          <ElIcon>
            <Close />
          </ElIcon>
        </span>
      </div>
      <div class="typhoon-data">
        {dataList.map((item) => (
          <div class="data-item">
            <span class="item-label">{item.label || ''}</span>
            <span class="item-value">{item.value || ''}</span>
            <span class="item-value">{item.unit || ''}</span>
          </div>
        ))}
        {tableData.map((item) => (
          <div class="data-item-row">
            <span class="item-cell item-label">{item.label || ''}</span>
            {item.value?.map((value) => <span class="item-cell">{value || '--'}</span>) || ''}
            <span class="item-cell item-unit">{item.unit || ''}</span>
          </div>
        ))}
      </div>
    </div>,
    iconContainer
  )
  return iconContainer.innerHTML
}
