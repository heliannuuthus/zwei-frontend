import Taro from '@tarojs/taro';
import { isLoggedIn } from '../services/user';

// 需要登录的页面路径列表
const AUTH_REQUIRED_PAGES = [
  '/pages/profile/favorites',
  '/pages/profile/history',
];

/**
 * 检查页面是否需要登录
 */
function requiresAuth(url: string): boolean {
  return AUTH_REQUIRED_PAGES.some(page => url.includes(page));
}

/**
 * 显示登录提示并引导用户登录
 */
function showLoginPrompt(
  title: string = '需要登录',
  content: string = '登录后即可使用此功能'
): void {
  Taro.showModal({
    title,
    content,
    confirmText: '去登录',
    cancelText: '取消',
    success: res => {
      if (res.confirm) {
        // 跳转到 profile 页面，让用户在那里登录
        Taro.switchTab({ url: '/pages/profile/index' });
      }
    },
  });
}

/**
 * 初始化路由守卫（在 app.ts 中调用）
 * 拦截 Taro.navigateTo 和 Taro.redirectTo，自动检查登录状态
 */
export function initRouteGuard(): void {
  // 保存原始方法
  const originalNavigateTo = Taro.navigateTo;
  const originalRedirectTo = Taro.redirectTo;

  // 拦截 Taro.navigateTo
  Taro.navigateTo = function (options: Taro.navigateTo.Option) {
    const { url } = options;
    if (requiresAuth(url) && !isLoggedIn()) {
      showLoginPrompt('需要登录', '登录后即可查看此页面');
      return Promise.reject(new Error('用户未登录'));
    }
    return originalNavigateTo(options);
  } as typeof Taro.navigateTo;

  // 拦截 Taro.redirectTo
  Taro.redirectTo = function (options: Taro.redirectTo.Option) {
    const { url } = options;
    if (requiresAuth(url) && !isLoggedIn()) {
      showLoginPrompt('需要登录', '登录后即可查看此页面');
      return Promise.reject(new Error('用户未登录'));
    }
    return originalRedirectTo(options);
  } as typeof Taro.redirectTo;
}

/**
 * 添加需要登录的页面路径
 */
export function addAuthRequiredPage(pagePath: string): void {
  if (!AUTH_REQUIRED_PAGES.includes(pagePath)) {
    AUTH_REQUIRED_PAGES.push(pagePath);
  }
}

/**
 * 移除需要登录的页面路径
 */
export function removeAuthRequiredPage(pagePath: string): void {
  const index = AUTH_REQUIRED_PAGES.indexOf(pagePath);
  if (index > -1) {
    AUTH_REQUIRED_PAGES.splice(index, 1);
  }
}
