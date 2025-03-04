import request from '@/utils/request'

// 获取验证码
export function getValidImage() {
  return new Promise((resolve) => {
    resolve({
      code: 200,
      img: '',
      uuid: '123'
    })
  })
  // return request({
  //   url: '/captchaImage',
  //   method: 'get',
  // })
}

// 登录方法
export function login(data: ILoginParams) {
  return new Promise((resolve) => {
    resolve({
      code: 200,
      token: '1125648964163',
    })
  })
  // return request({
  //   url: '/login',
  //   headers: {
  //     isToken: false,
  //   },
  //   method: 'post',
  //   data: data,
  // })
}

// 退出方法
export function logout() {
  return new Promise((resolve) => {
    resolve('')
  })
  // return request({
  //   url: '/logout',
  //   method: 'post',
  // })
}

// 获取用户详细信息
export function getInfo() {
  return new Promise((resolve) => {
    resolve({
      code: 200,
      roles: '',
      user: '123',
      permissions: ''
    })
  })
  // return request({
  //   url: '/getInfo',
  //   method: 'get',
  // })
}
