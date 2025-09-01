/**
 * 此模块只在项目入口引入一次即可
 * 自定义元素：可保持元素宽高比
 * 使用ratio属性设置，可相应变化
 * 建议只有width、margin、定位等影响盒子外部布局的样式通过根元素customel-keep-proportion控制，其他（边框以内的）布局样式通过插槽控制
 *
 * vite配置文件中加入以下配置
 * plugins: [
 *   vue({
 *     template: {
 *       compilerOptions: {
 *         // 将所有以customel-开头的标签名都视为自定义元素
 *         isCustomElement: (tag) => tag.startsWith('customel-'),
 *       },
 *     },
 *   }),
 * ]
 */
const defaultStyle = `
  :host {
    display: block;
  }
  .keep-proportion {
    width: 100%;
    position: relative;
  }
  .keep-proportion > .inner {
    padding-top: 100%;
  }
  .keep-proportion > .inner > .content {
    position: absolute;
    inset: 0;
  }
`
class CustomelKeepProportion extends HTMLElement {
  static observedAttributes = ['ratio']
  private styleElement: HTMLStyleElement | null = null

  constructor() {
    // 必须首先调用 super 方法
    super()
  }
  attributeChangedCallback(name: string, oldValue: any, newValue: any) {
    switch (name) {
      case 'ratio':
        if (newValue !== oldValue) {
          this.setRatioStyle()
        }
        break
    }
  }

  connectedCallback() {
    // 创建影子根
    const shadow = this.attachShadow({ mode: 'closed' })

    // 创建几个 div
    const wrapper = document.createElement('div')
    wrapper.setAttribute('class', 'keep-proportion')
    const inner = document.createElement('div')
    inner.setAttribute('class', 'inner')
    const content = document.createElement('div')
    content.setAttribute('class', 'content')
    const slot = document.createElement('slot')
    content.appendChild(slot)
    inner.appendChild(content)
    wrapper.appendChild(inner)

    this.styleElement = document.createElement('style')
    this.styleElement.textContent = defaultStyle
    this.setRatioStyle()

    shadow.appendChild(this.styleElement)
    shadow.appendChild(wrapper)
  }

  // 设置样式
  setRatioStyle() {
    if (!this.styleElement) return

    let ratioValue = this.hasAttribute('ratio') ? this.getAttribute('ratio') || '100%' : '100%'
    if (!/^(0|[1-9]\d*)(\.\d+)?%?$/.test(ratioValue)) {
      console.warn('ratio is a number or percent!')
      ratioValue = '100%'
    }
    ratioValue = ratioValue.endsWith('%') ? ratioValue : `${parseFloat(ratioValue) * 100}%`

    this.styleElement.textContent = this.styleElement.textContent
      ? this.styleElement.textContent.replace(/padding-top:\s*.*;/, `padding-top: ${ratioValue};`)
      : defaultStyle
  }
}

if (!customElements.get('customel-keep-proportion')) {
  customElements.define('customel-keep-proportion', CustomelKeepProportion)
}
