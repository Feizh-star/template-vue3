/**
 * 所有菜单路由定义
 * component：在menu store中component会根据路径被解析为真实组件，路径从src/views/下开始，不带/或./
 * name：不用手动指定，会自动生成，规则：path的各段用-连接，以实时功率为例，name就是realtime-power
 * meta.isLeaf：按照目前一级菜单在顶部，二级菜单在左侧的布局，需要给下列所有一级路由配置加上isLeaf: true，二级路由菜单在对应的页面中自己实现
 * meta.title：菜单名称
 * meta中的其他属性保持跟已有的路由配置一致即可，目前没用到
 * 完整的自定义属性说明可参考src/types/router/router.d.ts（按下ctrl点击下方的IOriginRoute即可跳转）
 */
import img1 from '@/assets/images/position2x.png'
import img2 from '@/assets/images/position2x-sel.png'
export const menuRouters: IOriginRoute[] = [
  {
    path: '/testmenu',
    component: 'TestMenu/Index.vue',
    meta: {
      title: '测试菜单',
      hidden: false,
      icon: {
        type: 'class',
        value: 'iconfont icon-yuandianxiao-copy',
      },
    },
  },
  {
    path: 'https://www.baidu.com/',
    meta: {
      title: '百度',
      hidden: false,
      icon: {
        type: 'class',
        value: 'iconfont icon-yuandianxiao-copy',
      },
    },
  },
  {
    path: '/custommenu',
    component: 'CustomMenu/Index.vue',
    meta: {
      title: '自定义组件目录',
      hidden: false,
      alwaysShow: false,
      isLeaf: true,
      icon: {
        type: 'img',
        value: img1,
        valueSel: img2,
      },
    },
    children: [
      {
        path: 'cusmenupage1',
        component: 'CustomMenu/subpage/Page1.vue',
        meta: {
          title: '自定义组件',
          hidden: false,
          icon: {
            type: 'class',
            value: 'Female',
          },
        },
      },
      {
        path: 'cusmenupage2',
        component: 'CustomMenu/subpage/Page2.vue',
        meta: {
          title: '宽高比组件',
          hidden: false,
          icon: {
            type: 'class',
            value: 'Male',
          },
        },
      },
    ],
  },
  {
    path: '/customsubmenu',
    meta: {
      title: '自定义非首级子目录',
      hidden: false,
      alwaysShow: true,
      icon: {
        type: 'class',
        value: 'iconfont icon-yitihuajiankong',
      },
    },
    children: [
      {
        path: 'submenu1',
        component: 'CustomSubMenu/Index.vue',
        meta: {
          title: '非首级子目录1',
          hidden: false,
          alwaysShow: false,
          isLeaf: true,
          icon: {
            type: 'img',
            value: img1,
            valueSel: img2,
          },
        },
        children: [
          {
            path: 'subpage1',
            component: 'CustomSubMenu/subpage/Page1.vue',
            meta: {
              title: '自定义非首级子菜单1',
              hidden: false,
              icon: {
                type: 'class',
                value: 'Female',
              },
            },
          },
          {
            path: 'subpage2',
            component: 'CustomSubMenu/subpage/Page2.vue',
            meta: {
              title: '自定义非首级子菜单2',
              hidden: false,
              icon: {
                type: 'class',
                value: 'Male',
              },
            },
          },
        ],
      },
    ],
  },
  {
    path: '/test3',
    meta: {
      title: 'Test3',
      hidden: false,
      alwaysShow: false,
      icon: {
        type: 'class',
        value: 'iconfont icon-yitihuajiankong',
      },
    },
    children: [
      {
        path: 'test31',
        meta: {
          title: 'Test31',
          hidden: false,
          alwaysShow: true,
          icon: {
            type: 'class',
            value: 'iconfont icon-yuandianxiao-copy',
          },
        },
        children: [
          {
            path: 'test311',
            component: 'TestMenu/Test311.vue',
            meta: {
              title: 'Test311',
              hidden: false,
              icon: {
                type: 'class',
                value: 'iconfont icon-yuandianxiao-copy',
              },
            },
          },
        ],
      },
      {
        path: 'test32',
        meta: {
          title: 'Test32',
          hidden: false,
          alwaysShow: false,
          icon: {
            type: 'class',
            value: 'iconfont icon-yuandianxiao-copy',
          },
        },
        children: [
          {
            path: 'test321',
            component: 'TestMenu/Test321.vue',
            meta: {
              title: 'Test321',
              hidden: false,
              icon: {
                type: 'class',
                value: 'iconfont icon-yuandianxiao-copy',
              },
            },
          },
          {
            path: 'https://www.taobao.com/',
            meta: {
              title: '淘宝',
              hidden: false,
              icon: {
                type: 'class',
                value: 'iconfont icon-yuandianxiao-copy',
              },
            },
          },
        ],
      },
    ],
  },
]
