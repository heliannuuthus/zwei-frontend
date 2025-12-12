/**
 * API 配置文件
 * 
 * 环境变量通过 .env.development / .env.production 配置
 * - 开发环境: pnpm dev:weapp
 * - 生产环境: pnpm build:weapp
 */

// API 配置导出接口
export interface ApiConfigExport {
  API_BASE_URL: string
  API_TIMEOUT: number
  API_RETRIES: number
}

// 从环境变量获取 API 地址，fallback 到默认值
const API_BASE_URL = process.env.TARO_APP_API_BASE_URL || 'http://172.19.26.76:18000'

// 默认导出配置
const apiConfigExport: ApiConfigExport = {
  // API 基础地址（从环境变量读取）
  API_BASE_URL,

  // API 超时时间（毫秒）
  API_TIMEOUT: 10000,

  // 请求重试次数
  API_RETRIES: 3,
}

export default apiConfigExport
