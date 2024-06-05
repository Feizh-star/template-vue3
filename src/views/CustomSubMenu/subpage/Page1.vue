<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import { download } from '@/utils/tools'

const textarea = ref('')

function beforeUpload(elFile: any) {
  const file = elFile.raw as File
  const reader = new FileReader()
  reader.readAsText(file)
  reader.onload = function () {
    const fontJsonData = JSON.parse(this.result as string)
    handleFont(fontJsonData, file.name)
  }
}
function handleFont(font: any, filename = '') {
  const my_glyphs: any = {}
  let chars = textarea.value.replace(/[\n\r]+/g, '')
  for (const char of new Set(chars.split(''))) {
    const c = char
    const g = font.glyphs[c]
    if (g) {
      my_glyphs[c] = g
    } else {
      console.log('not found word:' + c)
    }
  }
  font.glyphs = my_glyphs
  delete font.original_font_information
  const json = JSON.stringify(font)
  const blob = new Blob([json], { type: 'application/json' })
  download(filename, blob)
}
/*
1234567890
qwertyuiopasdfghjklzxcvbnm
QWERTYUIOPASDFGHJKLZXCVBNM
`~!@#$%^&*()_+-=[]\{}|;',./:"<>?
·！￥…（）—【】、：“；‘《》？，。
电力监控系统
内网防火墙
风功率预测交换机
风功率预测服务器
反向隔离装置
气象服务器
外网防火墙
互联网
平面非实时交换机一
平面非实时纵向加密装置一
平面非实时纵向加密装置二
平面非实时交换机二
调度数据网
安全区1
安全区2
管理信息大区
*/
</script>

<template>
  <div class="custom-page1">
    <div class="char-input">
      <el-input
        v-model="textarea"
        style="width: 100%"
        :rows="5"
        type="textarea"
        placeholder="请先输入要保留的字符组成的字符串"
      />
    </div>
    <div class="upload-area">
      <el-upload
        class="upload-demo"
        action="#"
        :auto-upload="false"
        drag
        :disabled="!textarea"
        :show-file-list="false"
        accept=".json"
        :on-change="beforeUpload"
      >
        <el-icon class="el-icon--upload"><Plus /></el-icon>
        <div class="el-upload__text">拖拽json格式的字体文件到此处 或<em> 点击选择文件</em></div>
      </el-upload>
    </div>
  </div>
</template>

<style scoped lang="less">
.custom-page1 {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  .char-input {
    width: 400px;
    padding-bottom: 20px;
    :deep(.el-textarea) {
      textarea {
        resize: none;
      }
    }
  }
  .upload-area {
    width: 400px;
  }
}
</style>
