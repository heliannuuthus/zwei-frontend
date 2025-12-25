import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { AtButton } from 'taro-ui';
import Taro from '@tarojs/taro';
import {
  getFuzzyLocation,
  getContext,
  getMealTimeName,
  getSeasonName,
  getWeatherTheme,
  checkLocationAuth,
  ContextResponse,
  LocationInfo,
  LocationAuthStatus,
} from '../../services/recommend';
import { wxLogin, isLoggedIn, ensureValidToken } from '../../services/user';
import './index.scss';

// 页面状态
type PageState = 'loading' | 'permission' | 'error' | 'success';

// 骨架屏组件
const ContextSkeleton = () => (
  <View className="recommend-container skeleton">
    <View className="skeleton-header" />
    <View className="skeleton-card" style={{ height: '200rpx' }} />
    <View className="skeleton-card" style={{ height: '150rpx' }} />
    <View className="skeleton-card" style={{ height: '150rpx' }} />
  </View>
);

// 权限请求组件
const PermissionRequest = ({
  authStatus,
  onRetry,
}: {
  authStatus: LocationAuthStatus;
  onRetry: () => void;
}) => {
  const handleOpenSetting = async () => {
    try {
      await Taro.openSetting();
      // 设置页面返回后重试
      onRetry();
    } catch (err) {
      console.error('[Permission] 打开设置失败:', err);
    }
  };

  const isDenied = authStatus === 'denied';

  return (
    <View className="permission-container">
      <View className="permission-icon">📍</View>
      <Text className="permission-title">需要获取位置信息</Text>
      <Text className="permission-desc">
        为了给您推荐适合当前天气和时间的菜品，
        我们需要获取您的大概位置来查询天气情况
      </Text>
      {isDenied ? (
        <AtButton
          type="primary"
          className="permission-btn"
          onClick={handleOpenSetting}
        >
          去设置开启
        </AtButton>
      ) : (
        <AtButton type="primary" className="permission-btn" onClick={onRetry}>
          授权位置
        </AtButton>
      )}
      <Text className="permission-hint">
        {isDenied
          ? '您之前拒绝了位置授权，请在设置中开启'
          : '我们只获取模糊位置，不会记录您的精确位置'}
      </Text>
    </View>
  );
};

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
  const [locationAuthStatus, setLocationAuthStatus] =
    useState<LocationAuthStatus>('not_determined');

  // 静默登录，确保有有效 token
  const ensureLogin = useCallback(async (): Promise<boolean> => {
    // 已经有有效 token
    if (isLoggedIn()) {
      const token = await ensureValidToken();
      if (token) return true;
    }
    // 没有 token 或 token 失效，静默登录
    try {
      await wxLogin();
      return true;
    } catch (err) {
      console.error('[Recommend] 静默登录失败:', err);
      return false;
    }
  }, []);

  // 获取位置
  const fetchLocation = useCallback(async () => {
    setState('loading');
    const loc = await getFuzzyLocation();
    if (loc) {
      setLocation(loc);
      return loc;
    } else {
      // 获取失败，检查授权状态
      const authStatus = await checkLocationAuth();
      setLocationAuthStatus(authStatus);
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
      // 检查是否是登录过期，尝试重新静默登录
      if (err.message?.includes('登录') || err.message?.includes('401')) {
        try {
          await wxLogin();
          // 重新请求
          const result = await getContext(loc);
          setContext(result);
          setState('success');
        } catch {
          setError('网络错误，请稍后重试');
          setState('error');
        }
      } else {
        setError(err.message || '网络错误');
        setState('error');
      }
    }
  }, []);

  // 初始化
  const init = useCallback(async () => {
    setState('loading');
    // 静默登录
    const loggedIn = await ensureLogin();
    if (!loggedIn) {
      setError('登录失败，请稍后重试');
      setState('error');
      return;
    }

    const loc = await fetchLocation();
    if (loc) {
      await fetchContext(loc);
    }
  }, [ensureLogin, fetchLocation, fetchContext]);

  // 刷新
  const refresh = useCallback(async () => {
    if (!location) {
      await init();
      return;
    }
    setRefreshing(true);
    try {
      // 确保 token 有效
      await ensureLogin();
      const result = await getContext(location);
      setContext(result);
      Taro.showToast({ title: '刷新成功', icon: 'success' });
    } catch (err: any) {
      // 尝试重新登录后再试一次
      try {
        await wxLogin();
        const result = await getContext(location);
        setContext(result);
        Taro.showToast({ title: '刷新成功', icon: 'success' });
      } catch {
        Taro.showToast({ title: '刷新失败', icon: 'none' });
      }
    } finally {
      setRefreshing(false);
    }
  }, [ensureLogin, location, init]);

  // 下拉刷新处理
  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  useEffect(() => {
    init();
  }, [init]);

  // 获取星期几的中文
  const getDayOfWeekName = (day: number) => {
    const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return names[day] || '';
  };

  // 根据状态渲染内容
  if (state === 'loading') {
    return <ContextSkeleton />;
  }

  if (state === 'permission') {
    return <PermissionRequest authStatus={locationAuthStatus} onRetry={init} />;
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
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={onRefresh}
      refresherBackground="#FFF9F5"
    >
      {/* 下拉刷新提示 */}
      <View className="pull-hint">
        <Text className="hint-text">下拉刷新推荐信息</Text>
      </View>

      {/* 天气卡片 */}
      {context && (
        <View className="weather-card">
          {/* 顶部：位置 + 时间 */}
          <View className="card-header">
            <Text className="location">
              📍 {context.location?.city || '未知位置'}
              {context.location?.district && ` · ${context.location.district}`}
            </Text>
            {context.time && (
              <Text className="datetime">
                {getDayOfWeekName(context.time.day_of_week)}{' '}
                {String(context.time.hour).padStart(2, '0')}:
                {String(new Date().getMinutes()).padStart(2, '0')}
              </Text>
            )}
          </View>

          {/* 核心：天气图标 + 温度湿度 */}
          <View className="weather-main">
            <Text className="weather-icon">
              {getWeatherTheme(context.weather?.weather || '').icon}
            </Text>
            <View className="data-row">
              <View className="data-item">
                <View className="data-value-row">
                  <Text className="data-value">
                    {context.weather?.temperature || '--'}
                  </Text>
                  <Text className="data-unit">°C</Text>
                </View>
                <Text className="data-label">温度</Text>
              </View>
              {context.weather?.humidity && (
                <View className="data-item">
                  <View className="data-value-row">
                    <Text className="data-value">
                      {context.weather.humidity}
                    </Text>
                    <Text className="data-unit">%</Text>
                  </View>
                  <Text className="data-label">湿度</Text>
                </View>
              )}
            </View>
            <Text className="weather-desc">
              {context.weather?.weather || '未知'}
            </Text>
          </View>

          {/* 底部：用餐 + 时节 */}
          {context.time && (
            <View className="card-footer">
              <View className="info-item">
                <Text className="info-label">用餐</Text>
                <Text className="info-value">
                  {getMealTimeName(context.time.meal_time)}
                </Text>
              </View>
              <View className="info-item">
                <Text className="info-label">时节</Text>
                <Text className="info-value">
                  {getSeasonName(context.time.season)}
                </Text>
              </View>
            </View>
          )}
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
