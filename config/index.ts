import { defineConfig, type UserConfigExport } from '@tarojs/cli';
import devConfig from './dev';
import prodConfig from './prod';

const weappAppId = process.env.TARO_APP_WEAPP_APPID || 'wxe26f0b5a99b12e96';
const ttAppId = process.env.TARO_APP_TT_APPID || '';
const alipayAppId = process.env.TARO_APP_ALIPAY_APPID || '';

const ciPluginConfig = {
  weapp: {
    appid: weappAppId,
    privateKeyPath: `key/private.${weappAppId}.key`,
    setting: {
      developer: process.env.WEAPP_DEVELOPER || 'heliannuuthus',
    },
  },
  tt: ttAppId
    ? {
        email: process.env.TT_EMAIL || '',
        password: process.env.TT_PASSWORD || '',
        appid: ttAppId,
      }
    : undefined,
  alipay: alipayAppId
    ? {
        appid: alipayAppId,
        toolId: process.env.ALIPAY_TOOL_ID || '',
        privateKeyPath: `key/private.${alipayAppId}.key`,
      }
    : undefined,
};

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
    outputRoot: 'dist',
    plugins: [['@tarojs/plugin-mini-ci', ciPluginConfig]],
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
