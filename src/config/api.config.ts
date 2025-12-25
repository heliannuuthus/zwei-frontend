/**
 * API 配置文件
 * 环境变量通过 .env.development / .env.production 配置
 */

export interface ApiConfigExport {
  API_BASE_URL: string;
  API_TIMEOUT: number;
  API_RETRIES: number;
}

const apiConfigExport: ApiConfigExport = {
  API_BASE_URL: process.env.TARO_APP_API_BASE_URL || '',
  API_TIMEOUT: 10000,
  API_RETRIES: 3,
};

export default apiConfigExport;
