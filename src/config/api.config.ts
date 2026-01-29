/**
 * API 配置文件
 *
 * 环境变量配置说明：
 * - 通过 .env.development / .env.production 文件配置
 * - 使用 --mode 参数指定环境模式（如：--mode development）
 * - 只有以 TARO_APP_ 开头的环境变量会被嵌入到客户端代码中
 *
 * 参考文档：
 * - https://docs.taro.zone/docs/envs
 * - https://docs.taro.zone/docs/env-mode-config
 */

export interface ApiConfigExport {
  API_BASE_URL: string;
  API_TIMEOUT: number;
  API_RETRIES: number;
}

// 各服务的 API 基础路径配置
export const apiEndpoints = {
  zwei: process.env.TARO_APP_API_ZWEI_URL || 'https://zwei.heliannuuthus.com/api',
  auth: process.env.TARO_APP_API_AUTH_URL || 'https://auth.heliannuuthus.com/api',
} as const;

export type ServiceName = keyof typeof apiEndpoints;

/**
 * 根据路径前缀获取对应的服务基础 URL
 * @param path 请求路径，如 /zwei/orders, /auth/login
 * @returns 完整的 URL 和处理后的路径
 */
export function getServiceUrl(path: string): { baseUrl: string; servicePath: string } {
  // 移除开头的斜杠以便解析
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const segments = normalizedPath.split('/');
  const service = segments[0] as ServiceName;

  if (service in apiEndpoints) {
    // 移除服务前缀，保留剩余路径
    const servicePath = '/' + segments.slice(1).join('/');
    return {
      baseUrl: apiEndpoints[service],
      servicePath,
    };
  }

  // 默认使用 zwei 服务
  return {
    baseUrl: apiEndpoints.zwei,
    servicePath: path,
  };
}

const apiConfigExport: ApiConfigExport = {
  // Taro 会自动将 .env.* 文件中 TARO_APP_* 开头的变量注入到 process.env
  // 兼容旧配置，默认使用 zwei 服务
  API_BASE_URL:
    process.env.TARO_APP_API_BASE_URL || apiEndpoints.zwei,
  API_TIMEOUT: 10000,
  API_RETRIES: 3,
};

export default apiConfigExport;
