//attribute声明vec4类型变量apos
attribute vec4 apos;
attribute vec3 color;
varying vec3 vColor;
void main() {
  //设置几何体轴旋转角度为10度，并把角度值转化为弧度值
  float radian = radians(10.0);
  //求解旋转角度余弦值
  float cos = cos(radian);
  //求解旋转角度正弦值
  float sin = sin(radian);
  //引用上面的计算数据，创建绕x轴旋转矩阵
  // 1      0       0    0
  // 0   cosα   sinα   0
  // 0  -sinα   cosα   0
  // 0      0        0   1
  mat4 mx = mat4(1,0,0,0,  0,cos,-sin,0,  0,sin,cos,0,  0,0,0,1);
  //引用上面的计算数据，创建绕y轴旋转矩阵
  // cosβ   0   sinβ    0
  //     0   1   0        0
  //-sinβ   0   cosβ    0
  //     0   0   0        1
  mat4 my = mat4(cos,0,sin,0,  0,1,0,0,  -sin,0,cos,0,  0,0,0,1);
  //两个旋转矩阵、顶点齐次坐标连乘
  gl_Position = mx*my*apos;
  vColor = color;
}
