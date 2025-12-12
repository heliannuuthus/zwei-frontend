/**
 * API 配置文件
 * 用于不同环境的 API 地址配置
 * 注意：小程序环境不支持 process.env，请使用条件编译
 */

// API 配置接口
interface ApiEnvironmentConfig {
  dev: string
  production: string
}

// API 配置 - 使用条件编译确定环境
let apiConfig: ApiEnvironmentConfig

apiConfig = {
  dev: 'http://172.19.26.76:18000',   // 真机调试地址
  production: 'https://choosy.heliannuuthus.com',
}

// API 配置导出接口
export interface ApiConfigExport {
  API_BASE_URL: string
  API_TIMEOUT: number
  API_RETRIES: number
  config: ApiEnvironmentConfig
}

// 根据平台确定 API 基础地址
let apiBaseUrl: string
apiBaseUrl = apiConfig.dev  // 小程序环境：使用 WSL IP

// 默认导出配置
const apiConfigExport: ApiConfigExport = {
  // 当前使用的 API 基础地址
  API_BASE_URL: apiBaseUrl,

  // API 超时时间（毫秒）
  API_TIMEOUT: 10000,

  // 请求重试次数
  API_RETRIES: 3,

  // 完整的配置对象（用于调试）
  config: apiConfig,
}

export default apiConfigExport

