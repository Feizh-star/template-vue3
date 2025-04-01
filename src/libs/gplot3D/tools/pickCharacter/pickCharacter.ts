import { gzip, gunzip, type FlateError } from 'fflate'
import { download } from '@/utils/tools'

// 挑出要取用的字
export function handleFont(text: string, font: any, filename = '') {
  const my_glyphs: any = {}
  const chars = text.replace(/[\n\r]+/g, '')
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
  if (filename.endsWith('.gz')) {
    compressAndDownload(json, filename)
  } else {
    const blob = new Blob([json], { type: 'application/json' })
    download(filename, blob)
  }
}

// 压缩并下载
async function compressAndDownload(content: string, filename: string) {
  // 将字符串转换为Uint8Array
  const encoder = new TextEncoder()
  const originalData = encoder.encode(content)

  // 使用gzip压缩
  const compressedData = await new Promise<Uint8Array>((resolve, reject) => {
    gzip(originalData, (err: FlateError | null, data: Uint8Array) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
  const blob = new Blob([compressedData], { type: 'application/gzip' })
  download(filename, blob)
}

export async function decompressFromUint8Array(bf: Uint8Array) {
  const decompressedData = await new Promise<Uint8Array>((resolve, reject) => {
    gunzip(bf, (err: FlateError | null, data: Uint8Array) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
  return new TextDecoder().decode(decompressedData)
}

// 异步解压函数（通过URL获取压缩文件）
export async function decompressGZipFont(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/gzip',
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status} ${response.statusText}`)
    }
    // 对于gzip文件，浏览器自动进行了解压（跟Content-Encoding: gzip响应头有关）
    const str = await response.json()
    return str
    // const compressedBuffer = await response.json()
    // const compressedData = new Uint8Array(compressedBuffer)
    // return decompressFromUint8Array(compressedData)
  } catch (error) {
    throw new Error(
      `gzip字体文件解压失败: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
