import vertexShaderSource from './shader/rectangle.vert?raw' // 顶点着色器代码
import fragmentShaderSource from './shader/rectangle.frag?raw' // 片元着色器代码

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

  // 找到全局变量u_resolution的位置，用于将分辨率传递给顶点着色器，进行坐标转换
  const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution')
  // 设置分辨率
  gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height)

  // 创建一个缓冲区，用于存放三个2d裁剪空间点（一个三角形），positionBuffer只是一个引用，实际的缓冲区在GPU中
  const positionBuffer = gl.createBuffer()
  // 将缓冲区绑定到ARRAY_BUFFER，表示这个缓冲区是用来存放顶点数据的。向GPU传递数据时，就是通过这个绑定点，明确数据的用途，并将数据传递到ARRAY_BUFFER绑定的缓冲区中
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  // 找到顶点着色器中的a_position属性的位置
  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position')
  // 启用属性（a_position）
  gl.enableVertexAttribArray(positionAttributeLocation)
  // 告诉属性如何从positionBuffer中获取数据
  const size = 2 // 每次迭代运行提取两个单位数据
  const type = gl.FLOAT // 数据类型是32位浮点型
  const normalize = false // 不要归一化数据
  const stride = 0 // 跨步，每次迭代运行运动stride * sizeof(type)以获得下一个位置
  gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, 0)

  // 找到全局变量u_color的位置，用于将颜色传递给片元着色器，进行颜色填充
  const colorUniformLocation = gl.getUniformLocation(program, 'u_color')

  // 循环绘制50个矩形
  for (let ii = 0; ii < 50; ++ii) {
    // 将setRectangle()返回的6个点（两个三角形）上传到缓冲区中，gl.STATIC_DRAW表示这些数据不会经常改变（一次修改多次使用）
    gl.bufferData(gl.ARRAY_BUFFER, setRectangle(gl.canvas.width, gl.canvas.height), gl.STATIC_DRAW)

    // 给片元着色器中的u_color赋值一个随机颜色
    gl.uniform4f(colorUniformLocation, Math.random(), Math.random(), Math.random(), 1)

    // 绘制矩形，gl.TRIANGLES代表绘制模式（每三个点绘制一个三角形），0代表从第0个点开始绘制，6代表绘制6个点（两个三角形）
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
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

/* *************************************************************************************************************************** */
/* ******************************************************工具-生成随机数据***************************************************** */
/* *************************************************************************************************************************** */
// 返回一个随机整数
function randomInt(range: number) {
  return Math.floor(Math.random() * range)
}
// 返回一个矩形的6个点（两个三角形）
function setRectangle(maxX = 300, maxY = 300, maxSide = 30) {
  const x = randomInt(maxX)
  const y = randomInt(maxY)
  const width = randomInt(maxSide)
  const height = randomInt(maxSide)
  const x1 = x
  const x2 = x + width
  const y1 = y
  const y2 = y + height
  return new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]) // 两个三角形形成一个矩形
}

