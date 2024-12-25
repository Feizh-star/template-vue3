import { login, logout, getInfo } from '@/api/user'
import { setToken, getToken, removeToken } from '@/utils/auth'
import { removeAddedRoutes } from '@/store/menu'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken(),
    name: '',
    avatar: '',
    roles: [] as string[],
    permissions: [] as string[],
  }),
  actions: {
    login(userInfo: ILoginParams) {
      userInfo.username = userInfo.username.trim()
      return new Promise((resolve) => {
        const token = '123'
        setToken(token)
        this.token = token
        resolve(true)
        // login(userInfo)
        //   .then((res: any) => {
        //     setToken(res.token)
        //     this.token = res.token
        //     resolve(true)
        //   })
        //   .catch((error) => {
        //     reject(error)
        //   })
      })
    },
    // 获取用户信息
    getInfo() {
      return new Promise((resolve, reject) => {
        this.roles = ['ROLE_DEFAULT']
        this.permissions = [] as string[]
        this.name = 'admin'
        resolve({})
        // getInfo()
        //   .then((res: any) => {
        //     const user = res.user

        //     if (res.roles && res.roles.length > 0) {
        //       // 验证返回的roles是否是一个非空数组
        //       this.roles = res.roles
        //       this.permissions = res.permissions
        //     } else {
        //       this.roles = ['ROLE_DEFAULT']
        //     }
        //     this.name = user.userName
        //     // const avatar = (user.avatar == "" || user.avatar == null) ? defAva : import.meta.env.VITE_APP_BASE_API + user.avatar;
        //     // this.avatar = avatar;
        //     resolve(res)
        //   })
        //   .catch((error) => {
        //     reject(error)
        //   })
      })
    },
    logOut() {
      return new Promise((resolve, reject) => {
        this.token = ''
        this.roles = []
        this.permissions = []
        removeToken()
        removeAddedRoutes()
        resolve(true)
        // logout()
        //   .then(() => {
        //     this.token = ''
        //     this.roles = []
        //     this.permissions = []
        //     removeToken()
        //     removeAddedRoutes()
        //     resolve(true)
        //   })
        //   .catch((error) => {
        //     reject(error)
        //   })
      })
    },
  },
})
