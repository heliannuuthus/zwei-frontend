import Taro from '@tarojs/taro';
import request from './api';

// 位置信息
export interface LocationInfo {
  latitude: number;
  longitude: number;
}

// 位置授权状态
export type LocationAuthStatus = 'authorized' | 'denied' | 'not_determined';

/**
 * 检查位置授权状态
 */
export async function checkLocationAuth(): Promise<LocationAuthStatus> {
  try {
    const setting = await Taro.getSetting();
    const auth = setting.authSetting['scope.userFuzzyLocation'];
    if (auth === true) return 'authorized';
    if (auth === false) return 'denied';
    return 'not_determined';
  } catch {
    return 'not_determined';
  }
}

/**
 * 获取模糊地理位置
 * 使用微信的 getFuzzyLocation API
 */
export async function getFuzzyLocation(): Promise<LocationInfo | null> {
  try {
    const authStatus = await checkLocationAuth();

    if (authStatus === 'denied') {
      // 用户之前拒绝过，需要引导去设置页面
      console.log('[Location] 用户之前拒绝过授权，需要打开设置');
      return null;
    }

    if (authStatus === 'not_determined') {
      // 从未授权过，请求授权
      try {
        await Taro.authorize({ scope: 'scope.userFuzzyLocation' });
      } catch (authErr) {
        console.log('[Location] 用户拒绝授权模糊位置');
        return null;
      }
    }

    // 获取模糊位置
    const res = await Taro.getFuzzyLocation({
      type: 'wgs84',
    });

    console.log('[Location] 获取成功:', res.latitude, res.longitude);

    return {
      latitude: res.latitude,
      longitude: res.longitude,
    };
  } catch (error) {
    console.error('[Location] 获取位置失败:', error);

    // 尝试使用精确位置作为 fallback
    try {
      const setting = await Taro.getSetting();
      if (setting.authSetting['scope.userLocation']) {
        const res = await Taro.getLocation({ type: 'wgs84' });
        return {
          latitude: res.latitude,
          longitude: res.longitude,
        };
      }
    } catch (e) {
      console.error('[Location] Fallback 也失败:', e);
    }

    return null;
  }
}

// 上下文响应
export interface ContextResponse {
  location: {
    province: string;
    city: string;
    district: string;
  } | null;
  weather: {
    temperature: number;
    humidity: number;
    weather: string;
    icon: string;
  } | null;
  time: {
    timestamp: number;
    meal_time: string; // breakfast/lunch/afternoon/dinner/night
    season: string; // spring/summer/autumn/winter
    day_of_week: number; // 0-6
    hour: number; // 0-23
  } | null;
}

/**
 * 获取推荐上下文（位置、天气、时间）
 * 只需传入经纬度，其他信息由后端返回
 */
export async function getContext(
  location: LocationInfo
): Promise<ContextResponse> {
  return request<ContextResponse>('/api/recommend/context', {
    method: 'POST',
    body: JSON.stringify({
      latitude: location.latitude,
      longitude: location.longitude,
    }),
  });
}

/**
 * 获取用餐时段的中文名称
 */
export function getMealTimeName(mealTime: string): string {
  const names: Record<string, string> = {
    breakfast: '早餐',
    lunch: '午餐',
    afternoon: '下午茶',
    dinner: '晚餐',
    night: '夜宵',
  };
  return names[mealTime] || '美食';
}

/**
 * 获取季节的中文名称
 */
export function getSeasonName(season: string): string {
  const names: Record<string, string> = {
    spring: '春季',
    summer: '夏季',
    autumn: '秋季',
    winter: '冬季',
  };
  return names[season] || '';
}

/**
 * 天气主题配置
 */
export interface WeatherTheme {
  icon: string;
  gradient: string;
  textColor: string;
}

/**
 * 获取天气主题（图标 + 背景渐变 + 文字颜色）
 */
export function getWeatherTheme(weather: string): WeatherTheme {
  // 晴天
  if (weather.includes('晴')) {
    return {
      icon: '☀️',
      gradient: 'linear-gradient(180deg, #56CCF2 0%, #2F80ED 100%)',
      textColor: '#fff',
    };
  }
  // 多云
  if (weather.includes('多云')) {
    return {
      icon: '⛅',
      gradient: 'linear-gradient(180deg, #a1c4fd 0%, #c2e9fb 100%)',
      textColor: '#333',
    };
  }
  // 阴天
  if (weather.includes('阴') || weather.includes('云')) {
    return {
      icon: '☁️',
      gradient: 'linear-gradient(180deg, #bdc3c7 0%, #2c3e50 100%)',
      textColor: '#fff',
    };
  }
  // 小雨
  if (weather.includes('小雨') || weather.includes('阵雨')) {
    return {
      icon: '🌦️',
      gradient:
        'linear-gradient(180deg, #667db6 0%, #0082c8 50%, #667db6 100%)',
      textColor: '#fff',
    };
  }
  // 大雨/暴雨
  if (weather.includes('雨')) {
    return {
      icon: '🌧️',
      gradient: 'linear-gradient(180deg, #373B44 0%, #4286f4 100%)',
      textColor: '#fff',
    };
  }
  // 雷阵雨
  if (weather.includes('雷')) {
    return {
      icon: '⛈️',
      gradient: 'linear-gradient(180deg, #232526 0%, #414345 100%)',
      textColor: '#fff',
    };
  }
  // 雪
  if (weather.includes('雪')) {
    return {
      icon: '❄️',
      gradient: 'linear-gradient(180deg, #e6dada 0%, #274046 100%)',
      textColor: '#fff',
    };
  }
  // 雾/霾
  if (weather.includes('雾') || weather.includes('霾')) {
    return {
      icon: '🌫️',
      gradient: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 100%)',
      textColor: '#fff',
    };
  }
  // 风
  if (weather.includes('风')) {
    return {
      icon: '💨',
      gradient: 'linear-gradient(180deg, #83a4d4 0%, #b6fbff 100%)',
      textColor: '#333',
    };
  }
  // 默认
  return {
    icon: '🌤️',
    gradient: 'linear-gradient(180deg, #89f7fe 0%, #66a6ff 100%)',
    textColor: '#fff',
  };
}

/**
 * 获取天气图标（兼容旧接口）
 */
export function getWeatherIcon(weather: string): string {
  return getWeatherTheme(weather).icon;
}

// === LLM 推荐相关 ===

/**
 * 推荐请求参数
 */
export interface RecommendRequest {
  latitude: number;
  longitude: number;
  timestamp?: number;
}

/**
 * 推荐响应
 */
export interface RecommendResponse {
  recipes: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    difficulty: number;
    tags: Record<string, string[]>;
    image_path: string;
    total_time_minutes: number;
  }>;
  reason: string; // LLM 生成的推荐理由
  weather: {
    temperature: number;
    humidity: number;
    weather: string;
    city?: string;
  } | null;
  meal_time: string;
  season: string;
  temperature: string;
}

/**
 * 获取 LLM 推荐（支持可选登录）
 * 超时时间：30秒（30000ms）
 */
export async function getRecommendations(
  location: LocationInfo,
  limit: number = 6
): Promise<RecommendResponse> {
  return request<RecommendResponse>(`/api/recommend?limit=${limit}`, {
    method: 'POST',
    body: JSON.stringify({
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: Date.now(),
    }),
    timeout: 30000, // 30秒超时
  });
}
