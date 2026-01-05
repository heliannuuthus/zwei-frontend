import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import { AtButton, AtMessage } from 'taro-ui';
import Taro from '@tarojs/taro';
import {
  getFuzzyLocation,
  getContext,
  getMealTimeName,
  getSeasonName,
  getWeatherTheme,
  checkLocationAuth,
  ContextResponse,
  RecommendResponse,
  LocationInfo,
  LocationAuthStatus,
} from '../../services/recommend';
import {
  fetchAiRecommendations,
  getCacheState,
  getCachedResult,
  subscribeEvents,
  clearCache,
} from '../../services/aiRecommendCache';
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
  // 保留的菜品 ID（换一批时不替换这些）
  const [keepRecipeIds, setKeepRecipeIds] = useState<Set<string>>(new Set());
  // 新加入的菜品 ID（用于控制动画，只有新菜品播放入场动画）
  const [newRecipeIds, setNewRecipeIds] = useState<Set<string>>(new Set());

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
  // isRefresh: 是否为换一批操作（保留用户选中的菜品）
  const generateAiRecommendations = useCallback(
    async (isRefresh: boolean = false) => {
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

        // 确保登录
        try {
          await ensureLogin();
        } catch (err) {
          console.log('[AI Recommend] 登录验证失败，继续生成');
        }

        // 计算需要排除和保留的菜品
        let excludeIds: string[] | undefined;
        let keepRecipes: RecommendResponse['recipes'] = [];
        const targetCount = 6;

        if (isRefresh && aiRecommendations) {
          // 换一批：保留用户选中的菜品，排除当前所有菜品
          excludeIds = aiRecommendations.recipes.map(r => r.id);
          keepRecipes = aiRecommendations.recipes.filter(r =>
            keepRecipeIds.has(r.id)
          );
        }

        // 计算需要请求的数量
        const needCount = targetCount - keepRecipes.length;

        if (needCount <= 0) {
          // 全部保留，无需请求
          setAiLoading(false);
          Taro.showToast({ title: '您已保留所有菜品', icon: 'none' });
          return;
        }

        // 调用 AI 推荐 API
        const result = await fetchAiRecommendations(
          location,
          needCount,
          excludeIds
        );
        clearCache();

        // 记录新加入的菜品 ID（用于控制动画）
        const newIds = new Set(result.recipes.map(r => r.id));
        setNewRecipeIds(newIds);

        // 合并保留的菜品和新推荐的菜品
        const mergedRecipes = [...keepRecipes, ...result.recipes];
        setAiRecommendations({
          recipes: mergedRecipes,
          summary: result.summary,
          remaining: result.remaining,
        });

        setAiLoading(false);
        Taro.atMessage({ message: '✨ 推荐生成成功', type: 'success' });
        // 只有首次生成时滚动到结果区域
        if (!isRefresh) {
          setTimeout(() => {
            Taro.pageScrollTo({ scrollTop: 500, duration: 300 });
          }, 100);
        }
      } catch (err: any) {
        console.error('[AI Recommend] 生成失败:', err);
        setAiLoading(false);

        let errorMessage = '生成失败，请重试';
        if (err.message) {
          errorMessage = err.message;
        }

        setAiError(errorMessage);
        Taro.atMessage({ message: errorMessage, type: 'error' });
      }
    },
    [
      location,
      isUserLoggedIn,
      handleLogin,
      ensureLogin,
      aiRecommendations,
      keepRecipeIds,
    ]
  );

  // 检查登录状态
  const checkLoginStatus = useCallback(() => {
    const loggedIn = isLoggedIn();
    setIsUserLoggedIn(loggedIn);
  }, []);

  // 保存 location 的 ref，供 useDidShow 使用
  const locationRef = React.useRef(location);
  locationRef.current = location;

  // 恢复缓存状态
  const restoreCacheState = useCallback(() => {
    const loc = locationRef.current;
    if (!loc) return;

    // 检查是否有缓存结果
    const cached = getCachedResult(loc);
    if (cached) {
      setAiRecommendations(cached);
      setAiLoading(false);
      setAiError('');
      return;
    }

    // 检查是否有进行中的请求
    const state = getCacheState();
    if (state.loading) {
      setAiLoading(true);
      setAiError('');
    } else if (state.error) {
      setAiError(state.error);
      setAiLoading(false);
    } else if (state.result) {
      setAiRecommendations(state.result);
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    init();
    checkLoginStatus();
  }, [init, checkLoginStatus]);

  // 订阅 AI 推荐事件（处理后台请求完成的情况）
  useEffect(() => {
    const unsubscribe = subscribeEvents({
      onSuccess: result => {
        setAiRecommendations(result);
        setAiLoading(false);
        setAiError('');
      },
      onError: error => {
        setAiError(error);
        setAiLoading(false);
      },
    });

    return unsubscribe;
  }, []);

  // 页面显示时检查登录状态和恢复缓存
  Taro.useDidShow(() => {
    checkLoginStatus();
    restoreCacheState();
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
    <View className="recommend-page">
      <AtMessage />
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
                {context.location?.district &&
                  ` · ${context.location.district}`}
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
              {/* 智能生成按钮 */}
              <View
                className={`smart-generate-btn ${aiLoading ? 'loading' : ''} ${!isUserLoggedIn ? 'disabled' : ''}`}
                onClick={
                  aiLoading ? undefined : () => generateAiRecommendations()
                }
              >
                {/* 按钮内容 */}
                <View className="btn-content">
                  {aiLoading ? (
                    <>
                      <View className="loading-spinner">
                        <View className="spinner-ring" />
                      </View>
                      <Text className="btn-main-text">AI 正在思考...</Text>
                    </>
                  ) : (
                    <>
                      <Text className="btn-icon">✨</Text>
                      <View className="btn-text-group">
                        <Text className="btn-main-text">
                          {isUserLoggedIn
                            ? '生成专属推荐'
                            : '登录后生成专属推荐'}
                        </Text>
                        <Text className="btn-sub-text">每日可用 10 次</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* 错误提示卡片 */}
              {aiError && (
                <View className="error-tip-card">
                  <View className="error-tip-content">
                    <Text className="error-tip-icon">⚠️</Text>
                    <View className="error-tip-text">
                      <Text className="error-tip-title">生成失败</Text>
                      <Text className="error-tip-message">{aiError}</Text>
                    </View>
                  </View>
                  <View
                    className="error-tip-close"
                    onClick={() => setAiError('')}
                  >
                    <Text>✕</Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View className="ai-results">
              {/* 推荐菜谱列表 */}
              {aiRecommendations && (
                <>
                  {aiRecommendations.recipes.length > 0 ? (
                    <>
                      <View className="ai-results-header">
                        <View className="header-left">
                          <Text className="results-summary">
                            {aiRecommendations.summary ||
                              `为您精选 ${aiRecommendations.recipes.length} 道美食`}
                          </Text>
                          <Text className="remaining-count">
                            今日剩余 {aiRecommendations.remaining} 次
                          </Text>
                        </View>
                        <View
                          className={`refresh-btn ${aiLoading ? 'loading' : ''} ${aiRecommendations.remaining <= 0 ? 'disabled' : ''}`}
                          onClick={() => {
                            if (aiLoading) return;
                            if (aiRecommendations.remaining <= 0) {
                              Taro.showToast({
                                title: '今日次数已用完',
                                icon: 'none',
                              });
                              return;
                            }
                            generateAiRecommendations(true);
                          }}
                        >
                          {aiLoading ? (
                            <>
                              <View className="refresh-spinner" />
                              <Text className="refresh-text">生成中...</Text>
                            </>
                          ) : (
                            <>
                              <Text className="refresh-icon">↻</Text>
                              <Text className="refresh-text">换一批</Text>
                            </>
                          )}
                        </View>
                      </View>
                      <View className="recipes-list">
                        {aiRecommendations.recipes.map((recipe, index) => {
                          const isKept = keepRecipeIds.has(recipe.id);
                          const isNew = newRecipeIds.has(recipe.id);
                          return (
                            <View
                              key={recipe.id}
                              className={`recipe-card-wrapper ${isKept ? 'kept' : ''} ${isNew ? 'animate-in' : ''}`}
                              style={
                                isNew
                                  ? { animationDelay: `${index * 0.1}s` }
                                  : undefined
                              }
                            >
                              {/* 保留按钮 */}
                              <View
                                className={`keep-btn ${isKept ? 'active' : ''}`}
                                onClick={e => {
                                  e.stopPropagation();
                                  setKeepRecipeIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(recipe.id)) {
                                      next.delete(recipe.id);
                                    } else {
                                      next.add(recipe.id);
                                    }
                                    return next;
                                  });
                                }}
                              >
                                <Text className="keep-icon">
                                  {isKept ? '🔖' : '🏷️'}
                                </Text>
                              </View>
                              {/* 菜品封面 */}
                              <View
                                className="recipe-cover"
                                onClick={() =>
                                  Taro.navigateTo({
                                    url: `/pages/recipe/detail?id=${recipe.id}`,
                                  })
                                }
                              >
                                <Image
                                  className="cover-image"
                                  src={
                                    recipe.image_path ||
                                    'https://via.placeholder.com/400x300'
                                  }
                                  mode="aspectFill"
                                />
                                <View className="cover-overlay">
                                  <Text className="recipe-name">
                                    {recipe.name}
                                  </Text>
                                  <View className="recipe-meta">
                                    {recipe.total_time_minutes && (
                                      <Text className="meta-item">
                                        ⏱ {recipe.total_time_minutes}分钟
                                      </Text>
                                    )}
                                    <Text className="meta-item">
                                      🔥{' '}
                                      {['简单', '较易', '中等', '较难', '困难'][
                                        recipe.difficulty - 1
                                      ] || '未知'}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                              {/* 推荐理由 */}
                              {recipe.reason && (
                                <View className="reason-section">
                                  <View className="reason-accent" />
                                  <View className="reason-content">
                                    <Text className="reason-badge">
                                      💡 推荐理由
                                    </Text>
                                    <Text className="reason-text">
                                      "{recipe.reason}"
                                    </Text>
                                  </View>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </>
                  ) : (
                    <View className="ai-empty-state">
                      <Text className="empty-icon">🍽️</Text>
                      <Text className="empty-title">暂无推荐结果</Text>
                      <Text className="empty-desc">
                        AI 未能为您生成推荐，请重试
                      </Text>
                      <View
                        className={`retry-btn ${aiLoading ? 'loading' : ''}`}
                        onClick={() => {
                          if (aiLoading) return;
                          generateAiRecommendations();
                        }}
                      >
                        {aiLoading ? (
                          <>
                            <View className="refresh-spinner" />
                            <Text>生成中...</Text>
                          </>
                        ) : (
                          <Text>重新生成</Text>
                        )}
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </View>

        {/* 底部间距 */}
        <View className="bottom-spacer" />
      </ScrollView>
    </View>
  );
};

export default Recommend;
