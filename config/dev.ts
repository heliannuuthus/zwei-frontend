import type { UserConfigExport } from "@tarojs/cli";
export default {
  
  mini: {},
  h5: {
    devServer: {
      proxy: {
        // Zwei 服务
        '/zwei': {
          target: 'https://zwei.heliannuuthus.com/api',
          changeOrigin: true,
          pathRewrite: { '^/zwei': '' },
        },
        // Auth 认证服务
        '/auth': {
          target: 'https://auth.heliannuuthus.com/api',
          changeOrigin: true,
          pathRewrite: { '^/auth': '' },
        },
        // 兼容旧的 /api 路径（默认路由到 zwei）
        '/api': {
          target: 'https://zwei.heliannuuthus.com',
          changeOrigin: true,
        }
      }
    }
  }
} satisfies UserConfigExport<'webpack5'>
