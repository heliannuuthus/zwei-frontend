import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { AtButton } from 'taro-ui';
import Taro from '@tarojs/taro';
import {
  getFuzzyLocation,
  getContext,
  getRecommendations,
  getMealTimeName,
  getSeasonName,
  getWeatherTheme,
  checkLocationAuth,
  ContextResponse,
  RecommendResponse,
  LocationInfo,
  LocationAuthStatus,
} from '../../services/recommend';
import { wxLogin, isLoggedIn, ensureValidToken } from '../../services/user';
import RecipeCard from '../../components/RecipeCard/index';
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
      <View className="permission-icon">🍳</View>
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

// 错误状态组件 - 专业 UI/UX 设计
const ErrorState = ({
  message,
  onRetry,
  errorType = 'general',
}: {
  message: string;
  onRetry: () => void;
  errorType?: 'network' | 'auth' | 'general';
}) => {
  const errorConfig = {
    network: {
      illustration: '🍳',
      title: '网络似乎开小差了',
      subtitle: '请检查您的网络连接',
      color: '#3498db',
      bgGradient: 'linear-gradient(135deg, #ebf4ff 0%, #e8f4f8 100%)',
    },
    auth: {
      illustration: '🍳',
      title: '登录状态已失效',
      subtitle: '重新加载将自动恢复',
      color: '#9b59b6',
      bgGradient: 'linear-gradient(135deg, #f5f0ff 0%, #faf0ff 100%)',
    },
    general: {
      illustration: '🍳',
      title: '出了点小问题',
      subtitle: message || '请稍后再试',
      color: '#e67e22',
      bgGradient: 'linear-gradient(135deg, #fff8f0 0%, #fff5eb 100%)',
    },
  };

  const config = errorConfig[errorType];

  return (
    <View className="error-page">
      {/* 背景装饰 */}
      <View className="error-bg-decoration">
        <View className="bg-circle bg-circle-1" />
        <View className="bg-circle bg-circle-2" />
        <View className="bg-circle bg-circle-3" />
      </View>

      <View className="error-content">
        {/* 插图区域 */}
        <View className="error-illustration">
          <View
            className="illustration-glow"
            style={{ background: config.color }}
          />
          <View className="illustration-icon">{config.illustration}</View>
          <View className="illustration-ring" />
          <View className="illustration-ring illustration-ring-2" />
        </View>

        {/* 文案区域 */}
        <View className="error-text">
          <Text className="error-title">{config.title}</Text>
          <Text className="error-subtitle">{config.subtitle}</Text>
        </View>

        {/* 操作按钮 */}
        <View className="error-actions">
          <View className="retry-btn" onClick={onRetry}>
            <View className="retry-btn-bg" />
            <View className="retry-btn-content">
              <Text className="retry-icon">↻</Text>
              <Text className="retry-text">重新加载</Text>
            </View>
          </View>

          <View
            className="home-link"
            onClick={() => Taro.switchTab({ url: '/pages/index/index' })}
          >
            <Text className="home-text">返回首页</Text>
          </View>
        </View>
      </View>

      {/* 底部提示 */}
      <View className="error-footer">
        <View className="footer-tips">
          <View className="tip-row">
            <Text className="tip-icon">🍳</Text>
            <Text className="tip-label">检查网络连接</Text>
          </View>
          <View className="tip-divider" />
          <View className="tip-row">
            <Text className="tip-icon">🍳</Text>
            <Text className="tip-label">开启位置权限</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const Recommend = () => {
  const [state, setState] = useState<PageState>('loading');
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [context, setContext] = useState<ContextResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [errorType, setErrorType] = useState<'network' | 'auth' | 'general'>(
    'general'
  );
  const [refreshing, setRefreshing] = useState(false);
  const [locationAuthStatus, setLocationAuthStatus] =
    useState<LocationAuthStatus>('not_determined');

  // AI 推荐相关状态
  const [aiRecommendations, setAiRecommendations] =
    useState<RecommendResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string>('');
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);

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
      setError('');
      setErrorType('general');
    } catch (err: any) {
      console.error('[Context] 获取失败:', err);

      // 检查是否是登录过期
      if (err.message?.includes('登录') || err.message?.includes('401')) {
        try {
          console.log('[Context] 尝试重新登录...');
          await wxLogin();
          // 重新请求
          const result = await getContext(loc);
          setContext(result);
          setState('success');
          setError('');
          return;
        } catch (retryErr: any) {
          console.error('[Context] 重试失败:', retryErr);
          setError('登录失败，请重试');
          setErrorType('auth');
          setState('error');
        }
      } else if (
        err.message?.includes('网络') ||
        err.message?.includes('timeout') ||
        err.message?.includes('请求失败')
      ) {
        setError('网络连接失败，请检查网络后重试');
        setErrorType('network');
        setState('error');
      } else {
        setError(err.message || '获取信息失败，请稍后重试');
        setErrorType('general');
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

  // 处理登录
  const handleLogin = useCallback(async (): Promise<boolean> => {
    try {
      Taro.showLoading({ title: '登录中...', mask: true });
      await wxLogin();
      const loggedIn = isLoggedIn();
      setIsUserLoggedIn(loggedIn);
      Taro.hideLoading();
      if (loggedIn) {
        Taro.showToast({ title: '登录成功', icon: 'success' });
        return true;
      } else {
        Taro.showToast({ title: '登录失败', icon: 'none' });
        return false;
      }
    } catch (err: any) {
      Taro.hideLoading();
      console.error('[Recommend] 登录失败:', err);
      Taro.showToast({
        title: err.message || '登录失败，请重试',
        icon: 'none',
        duration: 2000,
      });
      return false;
    }
  }, []);

  // 生成 AI 推荐
  const generateAiRecommendations = useCallback(async () => {
    if (!location) {
      Taro.showToast({ title: '请先获取位置信息', icon: 'none' });
      return;
    }

    // 检查登录状态
    if (!isUserLoggedIn) {
      const loginSuccess = await handleLogin();
      if (!loginSuccess) {
        return;
      }
    }

    try {
      setAiLoading(true);
      setAiError('');
      Taro.showLoading({ title: 'AI 生成中...', mask: true });

      // 确保登录
      try {
        await ensureLogin();
      } catch (err) {
        console.log('[AI Recommend] 登录验证失败，继续生成');
      }

      // 调用 AI 推荐 API
      const result = await getRecommendations(location, 6);
      setAiRecommendations(result);

      Taro.hideLoading();
      Taro.showToast({ title: '✨ 推荐成功', icon: 'success', duration: 1500 });

      // 滚动到推荐结果
      setTimeout(() => {
        Taro.pageScrollTo({ scrollTop: 500, duration: 300 });
      }, 100);
    } catch (err: any) {
      console.error('[AI Recommend] 生成失败:', err);
      Taro.hideLoading();

      // 设置详细的错误信息
      let errorMessage = '生成失败，请重试';
      if (
        err.message?.includes('401') ||
        err.message?.includes('Unauthorized')
      ) {
        errorMessage = 'API 认证失败，请联系管理员';
      } else if (
        err.message?.includes('网络') ||
        err.message?.includes('timeout')
      ) {
        errorMessage = '网络连接失败，请检查网络';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setAiError(errorMessage);

      Taro.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000,
      });
    } finally {
      setAiLoading(false);
    }
  }, [location, isUserLoggedIn, handleLogin, ensureLogin]);

  // 检查登录状态
  const checkLoginStatus = useCallback(() => {
    const loggedIn = isLoggedIn();
    setIsUserLoggedIn(loggedIn);
  }, []);

  useEffect(() => {
    init();
    checkLoginStatus();
  }, [init, checkLoginStatus]);

  // 页面显示时检查登录状态
  Taro.useDidShow(() => {
    checkLoginStatus();
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

  if (state === 'permission') {
    return <PermissionRequest authStatus={locationAuthStatus} onRetry={init} />;
  }

  if (state === 'error') {
    return <ErrorState message={error} onRetry={init} errorType={errorType} />;
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
      {/* 天气卡片 */}
      {context && (
        <View className="weather-card">
          {/* 顶部：位置 + 时间 */}
          <View className="card-header">
            <Text className="location">
              🍳 {context.location?.city || '未知位置'}
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

      {/* AI 智能推荐功能 */}
      <View className="ai-recommend-section">
        <View className="section-header">
          <View className="header-badge">
            <Text className="badge-icon">✨</Text>
            <Text className="badge-text">AI 推荐</Text>
          </View>
          <Text className="section-title">智能美食推荐</Text>
          <Text className="section-desc">
            基于您的口味偏好 · 当前天气 · 用餐时段
          </Text>
        </View>

        {!aiRecommendations ? (
          <View className="generate-container">
            {/* 特性标签云 */}
            <View className="features-cloud">
              <View className="feature-tag">🎯 个性化</View>
              <View className="feature-tag">🌈 多样化</View>
              <View className="feature-tag">⚡ 即时生成</View>
            </View>

            {/* 智能生成按钮 */}
            <View
              className={`smart-generate-btn ${aiLoading ? 'loading' : ''} ${!isUserLoggedIn ? 'disabled' : ''} ${aiError ? 'error' : ''}`}
              onClick={aiLoading ? undefined : generateAiRecommendations}
            >
              {/* 背景光晕效果 */}
              <View className="btn-glow" />

              {/* 按钮内容 */}
              <View className="btn-content">
                {aiLoading ? (
                  <>
                    <View className="loading-spinner">
                      <View className="spinner-ring" />
                      <View className="spinner-ring" />
                      <View className="spinner-ring" />
                    </View>
                    <View className="btn-text-group">
                      <Text className="btn-main-text">AI 正在思考</Text>
                      <Text className="btn-sub-text">为您精选美味...</Text>
                    </View>
                  </>
                ) : aiError ? (
                  <>
                    <View className="btn-icon-wrapper">
                      <Text className="btn-icon">⚠️</Text>
                    </View>
                    <View className="btn-text-group">
                      <Text className="btn-main-text">生成失败</Text>
                      <Text className="btn-sub-text">{aiError}</Text>
                    </View>
                    <Text className="btn-arrow">↻</Text>
                  </>
                ) : (
                  <>
                    <View className="btn-icon-wrapper">
                      <Text className="btn-icon">🎨</Text>
                      <View className="icon-pulse" />
                    </View>
                    <View className="btn-text-group">
                      <Text className="btn-main-text">
                        {isUserLoggedIn ? '生成专属推荐' : '登录后生成专属推荐'}
                      </Text>
                      <Text className="btn-sub-text">
                        {isUserLoggedIn
                          ? '点击开启美食之旅'
                          : '登录后享受个性化推荐'}
                      </Text>
                    </View>
                    <Text className="btn-arrow">→</Text>
                  </>
                )}
              </View>

              {/* 装饰性粒子 */}
              <View className="particle particle-1">✨</View>
              <View className="particle particle-2">💫</View>
              <View className="particle particle-3">⭐</View>
            </View>
          </View>
        ) : (
          <View className="ai-results">
            {/* 推荐理由 */}
            {aiRecommendations.reason && (
              <View className="reason-card">
                <Text className="reason-icon">🍳</Text>
                <Text className="reason-text">{aiRecommendations.reason}</Text>
              </View>
            )}

            {/* 推荐菜谱列表 */}
            <View className="recipes-grid">
              {aiRecommendations.recipes.map(recipe => (
                <RecipeCard key={recipe.id} recipe={recipe} layout="grid" />
              ))}
            </View>
          </View>
        )}
      </View>

      {/* 底部间距 */}
      <View className="bottom-spacer" />
    </ScrollView>
  );
};

export default Recommend;
