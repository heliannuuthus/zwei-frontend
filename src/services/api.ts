import Taro from '@tarojs/taro';
import apiConfigFile from '../config/api.config';

// API配置
interface ApiConfig {
  baseURL: string;
  timeout: number;
  retries: number;
}

// 从配置文件获取API设置
const apiConfig: ApiConfig = {
  baseURL: apiConfigFile.API_BASE_URL,
  timeout: apiConfigFile.API_TIMEOUT,
  retries: apiConfigFile.API_RETRIES,
};

// 是否正在刷新 token
let isRefreshing = false;
// 等待刷新的请求队列
let refreshQueue: Array<() => void> = [];

/**
 * 获取 token（避免循环依赖，直接读取 storage）
 */
function getToken(): string | null {
  try {
    return Taro.getStorageSync('access_token') || null;
  } catch {
    return null;
  }
}

/**
 * 刷新 token（避免循环依赖，直接调用接口）
 * 使用 OAuth2.1 风格的 /token 端点，form-urlencoded 格式
 */
async function doRefreshToken(): Promise<boolean> {
  try {
    const refreshToken = Taro.getStorageSync('refresh_token');
    if (!refreshToken) return false;

    const response = await Taro.request({
      url: `${apiConfig.baseURL}/api/token`,
      method: 'POST',
      header: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
      timeout: apiConfig.timeout,
    });

    if (response.statusCode === 200 && response.data) {
      const data = response.data as any;
      Taro.setStorageSync('access_token', data.access_token);
      Taro.setStorageSync('refresh_token', data.refresh_token);
      const expiresAt = Date.now() + (data.expires_in - 300) * 1000;
      Taro.setStorageSync('token_expires_at', expiresAt);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 处理 token 刷新
 */
async function handleTokenRefresh(): Promise<boolean> {
  if (isRefreshing) {
    // 已经在刷新中，等待完成
    return new Promise(resolve => {
      refreshQueue.push(() => resolve(true));
    });
  }

  isRefreshing = true;
  const success = await doRefreshToken();
  isRefreshing = false;

  // 通知等待的请求
  refreshQueue.forEach(callback => callback());
  refreshQueue = [];

  return success;
}

// 请求封装
async function request<T>(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<T> {
  const fullUrl = `${apiConfig.baseURL}${url}`;

  // 使用自定义超时时间，如果没有则使用默认值
  const timeout = options.timeout ?? apiConfig.timeout;

  // 重试逻辑
  for (let attempt = 1; attempt <= apiConfig.retries; attempt++) {
    try {
      // 获取 token（token 接口不需要）
      const token = url.includes('/auth/token') ? null : getToken();
      const headers: any = {
        'Content-Type': 'application/json',
        ...(options.headers as any),
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log(
        `[API] ${attempt}/${apiConfig.retries} 请求: ${fullUrl}, 超时: ${timeout}ms`
      );

      const response = await Taro.request({
        url: fullUrl,
        method: (options.method as any) || 'GET',
        header: headers,
        data: options.body ? JSON.parse(options.body as string) : undefined,
        timeout: timeout,
      });

      if (response.statusCode >= 200 && response.statusCode < 300) {
        console.log(`[API] 成功: ${fullUrl}`);
        return response.data as T;
      }

      // 401 尝试刷新 token
      if (response.statusCode === 401 && !url.includes('/auth/')) {
        console.log('[API] Token 过期，尝试刷新...');
        const refreshed = await handleTokenRefresh();
        if (refreshed) {
          // 刷新成功，重试当前请求
          continue;
        } else {
          // 刷新失败，清除凭证
          Taro.removeStorageSync('access_token');
          Taro.removeStorageSync('refresh_token');
          Taro.removeStorageSync('token_expires_at');
          Taro.removeStorageSync('user_info');
          throw new Error('登录已过期，请重新登录');
        }
      }

      // 处理 OAuth2Error 格式的错误响应（包含 error_description）
      const errorData = response.data as any;
      const errorMsg =
        errorData?.error_description ||
        errorData?.message ||
        errorData?.detail ||
        `请求失败: ${response.statusCode}`;
      console.error(`[API] ${errorMsg}`);

      if (attempt === apiConfig.retries) {
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error(`[API] 第${attempt}次请求失败:`, error);

      if (attempt < apiConfig.retries) {
        console.log(`[API] ${apiConfig.retries - attempt}秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      throw error;
    }
  }

  throw new Error('请求失败');
}

// 导出API配置信息（用于调试）
export const getApiConfig = () => ({
  baseURL: apiConfig.baseURL,
  timeout: apiConfig.timeout,
  retries: apiConfig.retries,
});

// 导出默认请求函数
export default request;
