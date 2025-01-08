import vertexShaderSource from './shader/content.vert?raw' // 顶点着色器代码
import fragmentShaderSource from './shader/content.frag?raw' // 片元着色器代码
import { vertexs, colors, normalData } from './data_define'

export function init(canvas: HTMLCanvasElement) {
  const gl = canvas?.getContext('webgl')
  if (!gl) {
    return
  }
  // 设置canvas渲染区域的宽高
  setCanvasToDisplaySize(canvas)

  // 设置最终绘制的画布尺寸，将据此把裁剪空间的空间坐标换算成像素坐标
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

  // 清空画布
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  // 创建顶点着色器
  const vertexShader = loadShader(gl, vertexShaderSource, gl.VERTEX_SHADER)
  // 创建片元着色器
  const fragmentShader = loadShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER)

  // 创建着色程序
  const program = createProgram(gl, [vertexShader, fragmentShader])
  // 使用程序
  gl.useProgram(program)

  // 传递全局数据
  const lightColorLocation = gl.getUniformLocation(program, 'u_color')
  gl.uniform3f(lightColorLocation, 1.0, 1.0, 1.0)
  const lightDirectionLocation = gl.getUniformLocation(program, 'u_lightDirection')
  gl.uniform3f(lightDirectionLocation, 2, 3, -4)

  /* ************************************************************************************ */
  /* *******************************传递立方体的顶点数据********************************** */
  /* ************************************************************************************ */
  const positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertexs, gl.STATIC_DRAW)
  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position')
  gl.vertexAttribPointer(positionAttributeLocation,3,gl.FLOAT,false,0,0);
  gl.enableVertexAttribArray(positionAttributeLocation)

  /* ************************************************************************************ */
  /* ********************************传递顶点的颜色数据*********************************** */
  /* ************************************************************************************ */
  const colorBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW)
  const colorAttributeLocation = gl.getAttribLocation(program, 'a_color')
  gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(colorAttributeLocation)

  /* ************************************************************************************ */
  /* ********************************传递顶点的法线数据*********************************** */
  /* ************************************************************************************ */
  const normalBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, normalData, gl.STATIC_DRAW)
  const normalAttributeLocation = gl.getAttribLocation(program, 'a_normal')
  gl.vertexAttribPointer(normalAttributeLocation, 3, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(normalAttributeLocation)

  gl.enable(gl.DEPTH_TEST)
  gl.drawArrays(gl.TRIANGLES, 0, vertexs.length / 3)
}

/**
 * 编译着色器
 * @param {WebGLRenderingContext} gl webgl上下文
 * @param {string} shaderSource 着色器代码
 * @param {number} shaderType 着色器类型
 * @return {WebGLShader} 编译完成的着色器
 */
function loadShader(
  gl: WebGLRenderingContext,
  shaderSource: string,
  shaderType:
    | WebGLRenderingContextBase['VERTEX_SHADER']
    | WebGLRenderingContextBase['FRAGMENT_SHADER']
) {
  // 创建着色器对象
  const shader = gl.createShader(shaderType)
  if (!shader) {
    throw new Error(`Error createShader shader ${shaderType}`)
  }

  // 加载着色器代码
  gl.shaderSource(shader, shaderSource)

  // 编译着色器
  gl.compileShader(shader)

  // 错误处理
  const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (!compiled) {
    // 获取错误
    const lastError = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(
      `Error compiling shader ${shader}: ${lastError}\n${shaderSource
        .split('\n')
        .map((l, i) => `${i + 1}: ${l}`)
        .join('\n')}`
    )
  }

  return shader
}

/**
 * 创建一个着色程序，附加着色器，绑定属性位置，链接程序到webgl上下文
 * @param {WebGLRenderingContext} gl webgl上下文
 * @param {WebGLShader[]} shaders 着色器数组
 * @param {string[]} [opt_attribs] 一个可选的字符串数组，包含顶点属性的名称，用于绑定顶点属性位置。
 * @param {number[]} [opt_locations] 一个可选的数字数组，与 opt_attribs 对应，用于指定顶点属性的位置。
 */
function createProgram(
  gl: WebGLRenderingContext,
  shaders: WebGLShader[],
  opt_attribs?: string[],
  opt_locations?: number[]
) {
  // 创建一个着色程序
  const program = gl.createProgram()
  if (!program) {
    throw new Error(`Error createShader program`)
  }
  // 附加着色器
  shaders.forEach(function (shader) {
    gl.attachShader(program, shader)
  })
  if (opt_attribs) {
    opt_attribs.forEach(function (attrib, ndx) {
      gl.bindAttribLocation(program, opt_locations ? opt_locations[ndx] : ndx, attrib)
    })
  }
  // 链接程序到webgl上下文
  gl.linkProgram(program)

  // 检查链接是否成功
  const linked = gl.getProgramParameter(program, gl.LINK_STATUS)
  if (!linked) {
    // something went wrong with the link
    const lastError = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Error in program linking: ${lastError}`)
  }
  return program
}

/**
 * 设置canvas渲染区域的宽高
 * @param {HTMLCanvasElement} canvas canvas元素
 * @param {number} [multiplier] 渲染区域的宽高乘数，默认为1，传入window.devicePixelRatio为原生像素
 * @return {boolean} 如果canvas的宽高有变化，返回true，否则返回false
 */
function setCanvasToDisplaySize(canvas: HTMLCanvasElement, multiplier?: number) {
  multiplier = multiplier || 1
  const width = (canvas.clientWidth * multiplier) | 0
  const height = (canvas.clientHeight * multiplier) | 0
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
    return true
  }
  return false
}


