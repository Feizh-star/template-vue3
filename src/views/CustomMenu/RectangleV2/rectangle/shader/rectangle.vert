attribute vec2 a_position; // 属性 接收从缓冲中传递过来的顶点数据
attribute vec4 a_color; // 属性 接收从缓冲中传递过来的颜色数据
varying vec4 v_color; // 每一次运行顶点着色器，都会将这个值传递给片元着色器
uniform vec2 u_resolution; // 全局变量 用于存储画布的宽高，计算坐标变换

void main() {
  v_color = a_color; // 后续光栅化时，将利用顶点颜色进行插值计算，得到片元颜色，传递给片元着色器
  vec2 zeroToOne = a_position / u_resolution; // 将顶点坐标转换到 0.0 -> 1.0 的范围内

  vec2 zeroToTwo = zeroToOne * 2.0; // 将顶点坐标转换到 0.0 -> 2.0 的范围内

  vec2 clipSpace = zeroToTwo - 1.0; // 将顶点坐标转换到 -1.0 -> +1.0 的范围内

  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1); // 将y轴翻转，得到最终的裁剪空间坐标
}
