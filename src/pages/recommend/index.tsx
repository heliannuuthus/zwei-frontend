import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { AtIcon, AtButton } from 'taro-ui';
import Taro from '@tarojs/taro';
import {
  getFuzzyLocation,
  getContext,
  getMealTimeName,
  getSeasonName,
  getWeatherIcon,
  ContextResponse,
  LocationInfo,
} from '../../services/recommend';
import './index.scss';

// 页面状态
type PageState = 'loading' | 'login' | 'permission' | 'error' | 'success';

// 检查是否已登录
function isLoggedIn(): boolean {
  try {
    const token = Taro.getStorageSync('access_token');
    return !!token;
  } catch {
    return false;
  }
}

// 骨架屏组件
const ContextSkeleton = () => (
  <View className="recommend-container skeleton">
    <View className="skeleton-header" />
    <View className="skeleton-card" style={{ height: '200rpx' }} />
    <View className="skeleton-card" style={{ height: '150rpx' }} />
    <View className="skeleton-card" style={{ height: '150rpx' }} />
  </View>
);

// 登录请求组件
const LoginRequest = ({ onLogin }: { onLogin: () => void }) => (
  <View className="permission-container">
    <View className="permission-icon">🔐</View>
    <Text className="permission-title">需要登录</Text>
    <Text className="permission-desc">
      智能推荐功能需要登录后使用， 请先登录您的账号
    </Text>
    <AtButton type="primary" className="permission-btn" onClick={onLogin}>
      去登录
    </AtButton>
  </View>
);

// 权限请求组件
const PermissionRequest = ({ onRetry }: { onRetry: () => void }) => (
  <View className="permission-container">
    <View className="permission-icon">📍</View>
    <Text className="permission-title">需要获取位置信息</Text>
    <Text className="permission-desc">
      为了给您推荐适合当前天气和时间的菜品，
      我们需要获取您的大概位置来查询天气情况
    </Text>
    <AtButton type="primary" className="permission-btn" onClick={onRetry}>
      授权位置
    </AtButton>
    <Text className="permission-hint">
      我们只获取模糊位置，不会记录您的精确位置
    </Text>
  </View>
);

// 错误提示组件
const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <View className="error-container">
    <View className="error-icon">😢</View>
    <Text className="error-title">获取信息失败</Text>
    <Text className="error-desc">{message}</Text>
    <AtButton type="primary" className="error-btn" onClick={onRetry}>
      重试
    </AtButton>
  </View>
);

const Recommend = () => {
  const [state, setState] = useState<PageState>('loading');
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [context, setContext] = useState<ContextResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  // 检查登录状态
  const checkLogin = useCallback(() => {
    if (!isLoggedIn()) {
      setState('login');
      return false;
    }
    return true;
  }, []);

  // 跳转到登录页
  const goToLogin = useCallback(() => {
    Taro.switchTab({ url: '/pages/profile/index' });
  }, []);

  // 获取位置
  const fetchLocation = useCallback(async () => {
    setState('loading');
    const loc = await getFuzzyLocation();
    if (loc) {
      setLocation(loc);
      return loc;
    } else {
      setState('permission');
      return null;
    }
  }, []);

  // 获取上下文
  const fetchContext = useCallback(async (loc: LocationInfo) => {
    try {
      setState('loading');
      const result = await getContext(loc);
      setContext(result);
      setState('success');
    } catch (err: any) {
      // 检查是否是登录过期
      if (err.message?.includes('登录') || err.message?.includes('401')) {
        setState('login');
      } else {
        setError(err.message || '网络错误');
        setState('error');
      }
    }
  }, []);

  // 初始化
  const init = useCallback(async () => {
    // 先检查登录
    if (!checkLogin()) return;

    const loc = await fetchLocation();
    if (loc) {
      await fetchContext(loc);
    }
  }, [checkLogin, fetchLocation, fetchContext]);

  // 刷新
  const refresh = useCallback(async () => {
    if (!checkLogin()) return;

    if (!location) {
      await init();
      return;
    }
    setRefreshing(true);
    try {
      const result = await getContext(location);
      setContext(result);
      Taro.showToast({ title: '刷新成功', icon: 'success' });
    } catch (err: any) {
      if (err.message?.includes('登录') || err.message?.includes('401')) {
        setState('login');
      } else {
        Taro.showToast({ title: '刷新失败', icon: 'none' });
      }
    } finally {
      setRefreshing(false);
    }
  }, [checkLogin, location, init]);

  useEffect(() => {
    init();
  }, [init]);

  // 页面显示时重新检查登录状态
  Taro.useDidShow(() => {
    if (state === 'login' && isLoggedIn()) {
      init();
    }
  });

  // 获取星期几的中文
  const getDayOfWeekName = (day: number) => {
    const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return names[day] || '';
  };

  // 根据状态渲染内容
  if (state === 'loading') {
    return <ContextSkeleton />;
  }

  if (state === 'login') {
    return <LoginRequest onLogin={goToLogin} />;
  }

  if (state === 'permission') {
    return <PermissionRequest onRetry={init} />;
  }

  if (state === 'error') {
    return <ErrorState message={error} onRetry={init} />;
  }

  return (
    <ScrollView
      className="recommend-container"
      scrollY
      enhanced
      showScrollbar={false}
    >
      {/* 页面头部 */}
      <View className="page-header">
        <Text className="page-title">🤖 智能推荐</Text>
        <View className="refresh-btn" onClick={refresh}>
          <AtIcon
            value="reload"
            size="20"
            color="#e8503a"
            className={refreshing ? 'rotating' : ''}
          />
        </View>
      </View>

      {/* 位置信息卡片 */}
      {context?.location && (
        <View className="context-card">
          <View className="card-header">
            <Text className="card-icon">📍</Text>
            <Text className="card-title">当前位置</Text>
          </View>
          <View className="card-content">
            <Text className="location-text">
              {context.location.province}
              {context.location.city !== context.location.province &&
                ` ${context.location.city}`}
              {context.location.district && ` ${context.location.district}`}
            </Text>
          </View>
        </View>
      )}

      {/* 天气信息卡片 */}
      {context?.weather && (
        <View className="context-card weather-card">
          <View className="card-header">
            <Text className="card-icon">
              {getWeatherIcon(context.weather.weather)}
            </Text>
            <Text className="card-title">当前天气</Text>
          </View>
          <View className="card-content weather-content">
            <View className="weather-main">
              <Text className="weather-temp">
                {context.weather.temperature}°C
              </Text>
              <Text className="weather-desc">{context.weather.weather}</Text>
            </View>
            <View className="weather-detail">
              <View className="detail-item">
                <Text className="detail-label">湿度</Text>
                <Text className="detail-value">
                  {context.weather.humidity}%
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 时间信息卡片 */}
      {context?.time && (
        <View className="context-card time-card">
          <View className="card-header">
            <Text className="card-icon">🕐</Text>
            <Text className="card-title">当前时间</Text>
          </View>
          <View className="card-content">
            <View className="time-tags">
              <View className="time-tag">
                <Text className="tag-icon">🍽️</Text>
                <Text className="tag-text">
                  {getMealTimeName(context.time.meal_time)}
                </Text>
              </View>
              <View className="time-tag">
                <Text className="tag-icon">🍃</Text>
                <Text className="tag-text">
                  {getSeasonName(context.time.season)}
                </Text>
              </View>
              <View className="time-tag">
                <Text className="tag-icon">📅</Text>
                <Text className="tag-text">
                  {getDayOfWeekName(context.time.day_of_week)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 推荐功能开发中提示 */}
      <View className="coming-soon">
        <View className="coming-soon-icon">🚧</View>
        <Text className="coming-soon-title">智能推荐功能开发中</Text>
        <Text className="coming-soon-desc">
          我们将根据您的位置、天气和时间， 为您推荐最适合的菜品，敬请期待！
        </Text>
      </View>

      {/* 底部间距 */}
      <View className="bottom-spacer" />
    </ScrollView>
  );
};

export default Recommend;
