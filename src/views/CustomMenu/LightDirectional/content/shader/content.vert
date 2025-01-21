//attribute声明vec4类型变量a_position
attribute vec3 a_position;
attribute vec4 a_color;
attribute vec4 a_normal;
uniform vec3 u_color;
uniform vec3 u_lightDirection;
varying vec4 v_color;
void main() {
  //设置几何体轴旋转角度为10度，并把角度值转化为弧度值
  float xRadian = radians(10.0);
  float yRadian = radians(-10.0);
  float xcos = cos(xRadian);
  float xsin = sin(xRadian);
  float ycos = cos(yRadian);
  float ysin = sin(yRadian);
  //引用上面的计算数据，创建绕x轴旋转矩阵
  // 1      0       0    0
  // 0   cosα   -sinα   0
  // 0  sinα   cosα   0
  // 0      0        0   1
  mat4 mx = mat4(1,0,0,0,  0,xcos,xsin,0,  0,-xsin,xcos,0,  0,0,0,1);
  //引用上面的计算数据，创建绕y轴旋转矩阵
  // cosβ   0   sinβ    0
  //     0   1   0        0
  //-sinβ   0   cosβ    0
  //     0   0   0        1
  mat4 my = mat4(ycos,0,-ysin,0,  0,1,0,0,  ysin,0,ycos,0,  0,0,0,1);
  //两个旋转矩阵、顶点齐次坐标连乘
  gl_Position = mx * my * vec4(a_position, 1);

  // 计算平行光漫反射
  vec3 lightNormal = normalize(u_lightDirection);
  vec3 rotateNormal = normalize((mx * my * a_normal).xyz);
  float lightCos = max(dot(lightNormal, rotateNormal), 0.0);
  vec3 diffuse = a_color.rgb * u_color * lightCos;

  // // 计算平行光镜面反射
  // float mirrorCos =
  v_color = vec4(diffuse, a_color.a);
}
