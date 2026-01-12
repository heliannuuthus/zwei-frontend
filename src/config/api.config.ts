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

const apiConfigExport: ApiConfigExport = {
  // Taro 会自动将 .env.* 文件中 TARO_APP_* 开头的变量注入到 process.env
  API_BASE_URL:
    process.env.TARO_APP_API_BASE_URL || 'https://choosy.heliannuuthus.com',
  API_TIMEOUT: 10000,
  API_RETRIES: 3,
};

export default apiConfigExport;
