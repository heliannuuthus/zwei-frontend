import Taro from '@tarojs/taro';
import request from './api';

// 位置信息
export interface LocationInfo {
  latitude: number;
  longitude: number;
}

/**
 * 获取模糊地理位置
 * 使用微信的 getFuzzyLocation API
 */
export async function getFuzzyLocation(): Promise<LocationInfo | null> {
  try {
    // 先检查授权状态
    const setting = await Taro.getSetting();
    
    if (!setting.authSetting['scope.userFuzzyLocation']) {
      // 请求授权
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
    meal_time: string;  // breakfast/lunch/afternoon/dinner/night
    season: string;     // spring/summer/autumn/winter
    day_of_week: number; // 0-6
    hour: number;       // 0-23
  } | null;
}

/**
 * 获取推荐上下文（位置、天气、时间）
 * 需要用户登录
 */
export async function getContext(location: LocationInfo): Promise<ContextResponse> {
  return request<ContextResponse>('/api/recommend/context', {
    method: 'POST',
    body: JSON.stringify({
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: Date.now(),
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
 * 获取天气图标
 */
export function getWeatherIcon(weather: string): string {
  if (weather.includes('晴')) return '☀️';
  if (weather.includes('云') || weather.includes('阴')) return '☁️';
  if (weather.includes('雨')) return '🌧️';
  if (weather.includes('雪')) return '❄️';
  if (weather.includes('雾') || weather.includes('霾')) return '🌫️';
  if (weather.includes('风')) return '💨';
  return '🌤️';
}

