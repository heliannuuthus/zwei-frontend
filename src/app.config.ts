// @ts-ignore - defineAppConfig 是 Taro 编译时宏，运行时不存在
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/recommend/index',
    'pages/recipe/index',
    'pages/recipe/detail',
    'pages/takeout/index',
    'pages/profile/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#E8503A',
    navigationBarTitleText: 'Choosy',
    navigationBarTextStyle: 'white',
    backgroundColor: '#FFF9F5',
  },
  lazyCodeLoading: 'requiredComponents',
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
