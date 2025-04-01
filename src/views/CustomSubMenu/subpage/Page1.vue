<script setup lang="ts">
import {
  handleFont,
  decompressFromUint8Array,
} from '@/libs/gplot3D/tools/pickCharacter/pickCharacter'
import { symbol, character3500, character2500 } from '@/libs/gplot3D/tools/pickCharacter/presetFont'
import { Plus } from '@element-plus/icons-vue'

const characterTypeList = [
  { value: '3500', label: '3500常用字', character: character3500 },
  { value: '2500', label: '2500常用字', character: character2500 },
  { value: 'custom', label: '自定义', character: '' },
]
const opeTypeList = [
  { value: 'json', label: 'JSON' },
  { value: 'gzip', label: '压缩' },
  { value: 'gunzip', label: '解压(打印验证)' },
]
const characterType = ref('3500')
const textarea = ref(symbol + character3500)
const operation = ref('gzip')
watch(
  characterType,
  (newVal) => {
    const typeCharacter = characterTypeList.find((item) => item.value === newVal)?.character
    textarea.value = symbol + typeCharacter
  },
  { immediate: true }
)

// 获取选中文件内容
function beforeUpload(elFile: any) {
  const file = elFile.raw as File
  const reader = new FileReader()
  switch (operation.value) {
    case 'gunzip':
      if (!file.name.endsWith('.gz')) {
        console.error('请选择.gz文件')
        return
      }
      reader.readAsArrayBuffer(file)
      reader.onload = function () {
        const compressedData = new Uint8Array(this.result as ArrayBuffer)
        decompressFromUint8Array(compressedData).then((res) => {
          console.log(res)
        })
      }
      break
    default:
      if (!file.name.endsWith('.json')) {
        console.error('请选择.json文件')
        return
      }
      reader.readAsText(file)
      reader.onload = function () {
        const fontJsonData = JSON.parse(this.result as string)
        const downloadFilename = getDownloadFilename(file.name, operation.value == 'gzip')
        handleFont(textarea.value, fontJsonData, downloadFilename)
      }
  }
}
// 处理文件名
function getDownloadFilename(filename: string, compress: boolean) {
  const fragment = filename.split('.')
  if (fragment.length > 1) fragment.pop()
  const newFilename = `${fragment.join('').replace(/\s/g, '_')}_${characterType.value}.${
    compress ? 'gz' : 'json'
  }`
  return newFilename
}
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
        <div class="el-upload__text">
          拖拽json(过滤/压缩)、gz(解压)格式的字体文件到此处 或<em> 点击选择文件</em>
        </div>
      </el-upload>
    </div>
    <div class="control-area">
      <el-form inline>
        <el-form-item>
          <el-radio-group v-model="characterType">
            <el-radio v-for="item in characterTypeList" :key="item.value" :value="item.value">{{
              item.label
            }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <!-- opeTypeList -->
          <el-radio-group v-model="operation" :max="1">
            <el-radio v-for="item in opeTypeList" :key="item.value" :value="item.value">{{
              item.label
            }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
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
    padding-bottom: 20px;
    :deep(.el-textarea) {
      textarea {
        resize: none;
      }
    }
  }
  .char-input,
  .upload-area,
  .control-area {
    width: 360px;
  }
  .upload-area {
    :deep(.el-upload) {
      .el-upload__text {
        line-height: 1.4;
      }
    }
  }
  .control-area {
    padding-top: 8px;
    padding-left: 8px;
    :deep(.el-form) {
      .el-form-item {
        margin-right: 8px;
        margin-bottom: 8px;
      }
      .el-radio-group {
        .el-radio {
          margin-right: 12px;
        }
      }
    }
  }
}
</style>
