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

  // 找到顶点着色器中的a_position属性的位置
  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position')

  // 找到全局变量的位置
  const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution')
  const colorUniformLocation = gl.getUniformLocation(program, 'u_color')

  // 启用属性（a_position）
  gl.enableVertexAttribArray(positionAttributeLocation)

  // Create a buffer to put three 2d clip space points in
  const positionBuffer = gl.createBuffer()
  // Bind the position buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)

  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  const size = 2 // 2 components per iteration
  const type = gl.FLOAT // the data is 32bit floats
  const normalize = false // don't normalize the data
  const stride = 0 // 0 = move forward size * sizeof(type) each iteration to get the next position
  gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, 0)

  // set the resolution
  gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height)

  // draw 50 random rectangles in random colors
  for (let ii = 0; ii < 50; ++ii) {
    // Setup a random rectangle
    // This will write to positionBuffer because
    // its the last thing we bound on the ARRAY_BUFFER
    // bind point
    gl.bufferData(gl.ARRAY_BUFFER, setRectangle(), gl.STATIC_DRAW)

    // Set a random color.
    gl.uniform4f(colorUniformLocation, Math.random(), Math.random(), Math.random(), 1)

    // Draw the rectangle.
    const count = 6
    gl.drawArrays(gl.TRIANGLES, 0, count)
  }
}

// Returns a random integer from 0 to range - 1.
function randomInt(range: number) {
  return Math.floor(Math.random() * range)
}
// Fill the buffer with the values that define a rectangle.
function setRectangle() {
  const x = randomInt(300)
  const y = randomInt(300)
  const width = randomInt(300)
  const height = randomInt(300)
  const x1 = x
  const x2 = x + width
  const y1 = y
  const y2 = y + height
  return new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2])
}

/**
 * Loads a shader.
 * @param {WebGLRenderingContext} gl The WebGLRenderingContext to use.
 * @param {string} shaderSource The shader source.
 * @param {number} shaderType The type of shader.
 * @return {WebGLShader} The created shader.
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
 * Creates a program, attaches shaders, binds attrib locations, links the
 * program and calls useProgram.
 * @param {WebGLShader[]} shaders The shaders to attach
 * @param {string[]} [opt_attribs] An array of attribs names. Locations will be assigned by index if not passed in
 * @param {number[]} [opt_locations] The locations for the. A parallel array to opt_attribs letting you assign locations.
 * @memberOf module:webgl-utils
 */
function createProgram(
  gl: WebGLRenderingContext,
  shaders: WebGLShader[],
  opt_attribs?: string[],
  opt_locations?: number[]
) {
  const program = gl.createProgram()
  if (!program) {
    throw new Error(`Error createShader program`)
  }
  shaders.forEach(function (shader) {
    gl.attachShader(program, shader)
  })
  if (opt_attribs) {
    opt_attribs.forEach(function (attrib, ndx) {
      gl.bindAttribLocation(program, opt_locations ? opt_locations[ndx] : ndx, attrib)
    })
  }
  gl.linkProgram(program)

  // Check the link status
  const linked = gl.getProgramParameter(program, gl.LINK_STATUS)
  if (!linked) {
    // something went wrong with the link
    const lastError = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error('Error in program linking:' + lastError)
  }
  return program
}

/**
 * Resize a canvas to match the size its displayed.
 * @param {HTMLCanvasElement} canvas The canvas to resize.
 * @param {number} [multiplier] amount to multiply by.
 *    Pass in window.devicePixelRatio for native pixels.
 * @return {boolean} true if the canvas was resized.
 * @memberOf module:webgl-utils
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
