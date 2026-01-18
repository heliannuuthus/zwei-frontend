import { defineConfig, type UserConfigExport } from '@tarojs/cli';
import devConfig from './dev';
import prodConfig from './prod';

// 微信小程序 AppID
// 本地开发：使用 touristappid（测试号）
// 生产环境：通过环境变量 TARO_APP_WEAPP_APPID 或 CI/CD 配置
const weappAppId = process.env.TARO_APP_WEAPP_APPID || 'touristappid';
// 抖音小程序 AppID（与后端 config.toml 中的 idps.tt.appid 保持一致）
const ttAppId = process.env.TARO_APP_TT_APPID || 'ttae6ed8d3300d352501';
// 支付宝小程序 AppID（与后端 config.toml 中的 idps.alipay.appid 保持一致）
const alipayAppId = process.env.TARO_APP_ALIPAY_APPID || '';

const ciPluginConfig: any = {
  weapp: {
    appid: weappAppId,
    privateKeyPath: `key/private.${weappAppId}.key`,
    setting: {
      developer: process.env.WEAPP_DEVELOPER || 'heliannuuthus',
    },
  },
};

// 抖音小程序 CI 配置：只有当 appid、email 和 password 都配置时才启用
if (ttAppId && process.env.TT_EMAIL && process.env.TT_PASSWORD) {
  ciPluginConfig.tt = {
    email: process.env.TT_EMAIL,
    password: process.env.TT_PASSWORD,
    appid: ttAppId,
  };
}

// 支付宝小程序 CI 配置：只有当 appid 和 toolId 都配置时才启用
if (alipayAppId && process.env.ALIPAY_TOOL_ID) {
  ciPluginConfig.alipay = {
    appid: alipayAppId,
    toolId: process.env.ALIPAY_TOOL_ID,
    privateKeyPath: `key/private.${alipayAppId}.key`,
  };
}

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'webpack5'>(async (merge, { command, mode }) => {
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'myApp',
    date: '2025-11-14',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: `dist/${process.env.TARO_ENV}`,
    plugins: [['@tarojs/plugin-mini-ci', ciPluginConfig]],
    // defineConstants 用于定义编译时常量（非环境变量）
    // 环境变量通过 .env.* 文件配置，Taro 会自动注入到 process.env
    // 参考：https://docs.taro.zone/docs/envs
    defineConstants: {},
    copy: {
      patterns: [],
      options: {},
    },
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: {
        exclude: ['taro-ui'],
      },
    },
    sass: {
      // 静默 taro-ui 的 Sass deprecation warnings
      silenceDeprecations: ['import', 'global-builtin'],
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',

      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css',
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
    rn: {
      appName: 'taroDemo',
      postcss: {
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
        },
      },
    },
  };
  // #ifdef DEV
  // 本地开发构建配置（不混淆压缩）
  return merge({}, baseConfig, devConfig);
  // #endif

  // #ifndef DEV
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig);
  // #endif
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig);
});
