// @ts-ignore - defineAppConfig 是 Taro 编译时宏，运行时不存在
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/recommend/index',
    'pages/recipe/index',
    'pages/recipe/detail',
    'pages/recipe/shopping',
    'pages/profile/index',
    'pages/profile/settings',
    'pages/profile/favorites',
    'pages/profile/history',
    'pages/profile/help',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#E8503A',
    navigationBarTitleText: 'Choosy',
    navigationBarTextStyle: 'white',
    backgroundColor: '#FFF9F5',
  },
  lazyCodeLoading: 'requiredComponents',
  // 微信小程序支持 requiredPrivateInfos 和 permission 配置
  // 抖音小程序不支持自定义 permission，只配置 requiredPrivateInfos
  // 支付宝小程序不支持这些配置
  ...(process.env.TARO_ENV === 'weapp' && {
    requiredPrivateInfos: ['getFuzzyLocation'],
    permission: {
      'scope.userFuzzyLocation': {
        desc: '用于获取天气信息，为您推荐合适的菜品',
      },
    },
  }),
  ...(process.env.TARO_ENV === 'tt' && {
    requiredPrivateInfos: ['getFuzzyLocation'],
  }),
  tabBar: {
    color: '#999999',
    selectedColor: '#E8503A',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '',
        iconPath: 'assets/icons/home.png',
        selectedIconPath: 'assets/icons/home-active.png',
      },
      {
        pagePath: 'pages/recommend/index',
        text: '',
        iconPath: 'assets/icons/recommend.png',
        selectedIconPath: 'assets/icons/recommend-active.png',
      },
      {
        pagePath: 'pages/recipe/index',
        text: '',
        iconPath: 'assets/icons/recipe.png',
        selectedIconPath: 'assets/icons/recipe-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '',
        iconPath: 'assets/icons/profile.png',
        selectedIconPath: 'assets/icons/profile-active.png',
      },
    ],
  },
});
