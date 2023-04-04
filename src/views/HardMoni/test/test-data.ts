// 测试
import { defaultStyle } from '@/style/variables'
function getRandom(min: number, max: number, isFloat?: boolean) {
  return isFloat ? Math.floor(Math.random() * (max - min) + min) : Math.round((Math.random() * (max - min) + min))
}
class DoughnutData {
  theme: string
  count: number
  total: number
  unit: string
  doughnutData: any[]
  constructor(theme: string, unit: string, name1: string, name2: string, isFloat: boolean, fixTotal?: number) {
    const count1 = getRandom(50, 60, isFloat)
    const count2 = fixTotal ? fixTotal - count1 : getRandom(80, 90, isFloat)
    this.theme = theme
    this.count = count1
    this.total = count1 + count2
    this.unit = unit
    this.doughnutData = [
      { name: name1, color: defaultStyle.textHcolor, value: count1, type: 'used' },
      { name: name2, color: '#c7d4e3',value: count2, type: 'remain' },
    ]
  }
}
export function genDoughnutData() {
  return [
    new DoughnutData('在线服务器', '台', '在线', '离线', false),
    new DoughnutData('存储空间', 'GB', '已使用', '未使用', true),
    new DoughnutData('内存', 'GB', '已使用', '未使用', true),
    new DoughnutData('CPU', '%', '已使用', '未使用', true, 100),
  ]
}
class ServerBlock {
  status: {
    [p: string]: string | number
  }
  title: string
  lineData: any[]
  constructor() {
    this.status = {
      address: '192.168.100.' + getRandom(1, 255),
      status: Math.random() > 0.5 ? '离线' : '在线',
      type: '虚谷',
      linksNum: getRandom(1, 100),
    }
    this.title = ServerBlock.names[getRandom(0, 4)]
    this.lineData = [
      { name: '内存', value: getRandom(60, 70) },
      { name: 'cpu', value: getRandom(20, 30) },
      { name: '容量', value: getRandom(80, 83) },
    ]
  }
  static names = ['雷达服务器', '数据服务器', '数据传输应用服务器', '日志监控服务器', '应用服务器' ]
}
export function genServerBlockData(count:  number) {
  const arr = []
  for (let i = 0; i < count; i++) {
    arr.push(new ServerBlock())
  }
  return arr
}