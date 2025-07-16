interface IFlowLine3DEffectOption {
  id: number
  canvas?: HTMLCanvasElement
  devicePixelRatio: number
  path: [number, number, number][]
  lineMaterial: {
    // 更多参数详见：https://github.com/mrdoob/three.js/blob/master/examples/jsm/lines/LineMaterial.js
    color: string
    linewidth: number
    dashed: boolean
    alphaToCoverage: boolean // 暂时默认true
  }
  effect: {
    enable: boolean
    reverse: boolean
    colorStop: { color: string; percent: number }[] // 渐变色，优先级高于lineMaterial.color
    density: number // 点密度，单位距离上多少个点，可以是小数
    length: number // 特效长度（米），可以是小数
    size: number // 特效宽度，可以是小数
    speed: number // 移动速度（米/秒）
    scale: (sizeVal: number, index: number, length: number) => number
  }
  line: {
    scale: [number, number, number]
  }
}

type IFlowLineClassItem = DeepPartial<IFlowLine3DEffectOption>
