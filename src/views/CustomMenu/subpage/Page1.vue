<script setup lang="ts">
import testImage from '@/assets/images/position2x-sel.png'

// 为当这个元素创建一个类
class PopupInfo extends HTMLElement {
  constructor() {
    // 必须首先调用 super 方法
    super()
  }

  connectedCallback() {
    // 创建影子根
    const shadow = this.attachShadow({ mode: 'closed' })

    // 创建几个 span
    const wrapper = document.createElement('span')
    wrapper.setAttribute('class', 'wrapper')

    const icon = document.createElement('span')
    icon.setAttribute('class', 'icon')
    icon.setAttribute('tabindex', '0')

    const info = document.createElement('span')
    info.setAttribute('class', 'info')

    // 获取属性内容然后将其放入 info 这个 span 内
    const text = this.getAttribute('data-text')
    info.textContent = text

    // 插入图标
    let imgUrl: string | undefined
    if (this.hasAttribute('img')) {
      imgUrl = this.getAttribute('img') || ''
    } else {
      imgUrl = 'img/default.png'
    }

    const img = document.createElement('img')
    img.src = imgUrl
    icon.appendChild(img)

    // 创建一些 CSS 应用于影子 DOM
    const style = document.createElement('style')
    console.log(style.isConnected)

    style.textContent = `
      .wrapper {
        position: relative;
      }

      .info {
        font-size: 0.8rem;
        width: 200px;
        display: inline-block;
        border: 1px solid black;
        padding: 10px;
        background: white;
        border-radius: 10px;
        opacity: 0;
        transition: 0.6s all;
        position: absolute;
        bottom: 20px;
        left: 10px;
        z-index: 3;
      }

      img {
        width: 1.2rem;
      }

      .icon:hover + .info, .icon:focus + .info {
        opacity: 1;
      }
    `

    // 将创建好的元素附加到影子 DOM 上
    shadow.appendChild(style)
    console.log(style.isConnected)
    shadow.appendChild(wrapper)
    wrapper.appendChild(icon)
    wrapper.appendChild(info)
  }
}

customElements.define('customel-popup-info', PopupInfo)
</script>

<template>
  <div class="custom-page1">
    <el-empty description="CustomMenu 页面一" />
    <customel-popup-info
      :img="testImage"
      data-text="Your card validation code (CVC) is an extra security feature — it is the last 3 or 4 numbers on the back of your card."
    ></customel-popup-info>
  </div>
</template>

<style scoped lang="less">
.custom-page1 {
  width: 100%;
  height: 100%;
}
</style>
