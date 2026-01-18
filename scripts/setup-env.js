#!/usr/bin/env node

/**
 * 设置开发环境变量
 * 自动检测本地 IP 地址并生成 .env.development 文件
 *
 * Taro 环境变量说明：
 * - 只有以 TARO_APP_ 开头的变量会被嵌入到客户端代码中
 * - 通过 --mode 参数指定环境模式（如：--mode development）
 * - 参考：https://docs.taro.zone/docs/envs
 */

const fs = require('fs');
const { execSync } = require('child_process');

const mode = process.argv[2] || 'development';

function getLocalIP() {
  try {
    // macOS
    try {
      return execSync('ipconfig getifaddr en0', {
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim();
    } catch {
      try {
        return execSync('ipconfig getifaddr en1', {
          encoding: 'utf8',
          stdio: 'pipe',
        }).trim();
      } catch {
        // Linux
        return execSync("hostname -I | awk '{print $1}'", {
          encoding: 'utf8',
          stdio: 'pipe',
        }).trim();
      }
    }
  } catch {
    return 'localhost';
  }
}

const localIP = getLocalIP();
const apiBaseURL = `http://${localIP}:18000`;

const envContent = `# 自动生成的 ${mode} 环境配置文件
# 此文件由 scripts/setup-env.js 自动生成，请勿手动编辑
# 如需自定义，请复制 .env.example 并重命名为 .env.${mode}
#
# Taro 环境变量说明：
# - 只有以 TARO_APP_ 开头的变量会被嵌入到客户端代码中
# - 通过 --mode 参数指定环境模式
# - 参考：https://docs.taro.zone/docs/envs

TARO_APP_API_BASE_URL=${apiBaseURL}
`;

const envFile = `.env.${mode}`;
fs.writeFileSync(envFile, envContent, 'utf8');

console.log(`✓ 已生成 ${envFile}`);
console.log(`  TARO_APP_API_BASE_URL: ${apiBaseURL}`);
