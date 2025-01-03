precision mediump float; // 将浮点数的默认精度设置为中等精度
varying vec4 v_color; // 用于接收从顶点着色器传递过来的颜色值（光栅化插值后的）

void main() {
  gl_FragColor = v_color; // 将片段颜色传递给管线的下一阶段
}
