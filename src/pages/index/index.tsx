import { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, ScrollView, Swiper, SwiperItem } from '@tarojs/components';
import { AtIcon, AtRate } from 'taro-ui';
import Taro from '@tarojs/taro';
import { getBanners, getRecommendRecipes, getHotRecipes, BannerItem } from '../../services/home';
import { RecipeListItem } from '../../services/recipe';
import { getCategoryColor, getCategoryLabel } from '../../utils/category';
import './index.scss';

// 骨架屏组件
const HomeSkeleton = () => (
  <View className="home-container skeleton">
    <View className="skeleton-banner" />
    <View className="skeleton-actions">
      {[1, 2, 3].map(i => (
        <View key={i} className="skeleton-action-item" />
      ))}
    </View>
    <View className="skeleton-section">
      <View className="skeleton-section-title" />
      <View className="skeleton-cards">
        {[1, 2].map(i => (
          <View key={i} className="skeleton-card" />
        ))}
      </View>
    </View>
    <View className="skeleton-section">
      <View className="skeleton-section-title" />
      <View className="skeleton-grid">
        {[1, 2, 3, 4].map(i => (
          <View key={i} className="skeleton-grid-item" />
        ))}
      </View>
    </View>
  </View>
);

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [recommendRecipes, setRecommendRecipes] = useState<RecipeListItem[]>([]);
  const [hotRecipes, setHotRecipes] = useState<RecipeListItem[]>([]);

  const loadHomeData = useCallback(async () => {
    setLoading(true);
    try {
      // 并行请求三个接口
      const [bannersData, recommendData, hotData] = await Promise.all([
        getBanners().catch(() => []),
        getRecommendRecipes(4).catch(() => []),
        getHotRecipes(6).catch(() => []),
      ]);
      setBanners(bannersData || []);
      setRecommendRecipes(recommendData || []);
      setHotRecipes(hotData || []);
    } catch (error) {
      console.error('加载首页数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const navigateToRecommend = useCallback(() => {
    Taro.switchTab({
      url: '/pages/recommend/index',
    });
  }, []);

  const navigateToRecipeDetail = useCallback((recipeId: string) => {
    Taro.navigateTo({
      url: `/pages/recipe/detail?id=${recipeId}`,
    });
  }, []);

  const handleBannerClick = useCallback((banner: BannerItem) => {
    if (banner.link_type === 'recipe' && banner.link) {
      navigateToRecipeDetail(banner.link);
    } else if (banner.link_type === 'url' && banner.link) {
      // 小程序不支持直接打开外部链接，可以复制到剪贴板
      Taro.setClipboardData({ data: banner.link });
    }
  }, [navigateToRecipeDetail]);

  // 格式化菜谱名称（去掉"的做法"后缀）
  const formatRecipeName = useCallback((name: string) => {
    return name.replace(/的做法$/, '');
  }, []);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  // 下拉刷新
  useEffect(() => {
    Taro.eventCenter.on('pullDownRefresh', () => {
      loadHomeData().then(() => {
        Taro.stopPullDownRefresh();
      });
    });
    return () => {
      Taro.eventCenter.off('pullDownRefresh');
    };
  }, [loadHomeData]);

  if (loading) {
    return <HomeSkeleton />;
  }

  return (
    <View className="home-container">
      {/* 顶部 Banner 轮播 */}
      {banners.length > 0 ? (
        <Swiper
          className="banner-swiper"
          indicatorDots
          indicatorColor="rgba(255,255,255,0.4)"
          indicatorActiveColor="#fff"
          autoplay
          circular
          interval={4000}
        >
          {banners.map(banner => (
            <SwiperItem key={banner.id} onClick={() => handleBannerClick(banner)}>
              <View className="banner-item">
                <Image
                  src={banner.image_url}
                  className="banner-image"
                  mode="aspectFill"
                />
                {banner.title && (
                  <View className="banner-overlay">
                    <Text className="banner-title">{banner.title}</Text>
                  </View>
                )}
              </View>
            </SwiperItem>
          ))}
        </Swiper>
      ) : (
        <View className="banner-section">
          <View className="banner-content">
            <Text className="banner-main-title">今天吃什么？</Text>
            <Text className="banner-subtitle">让 AI 帮你决定</Text>
            <View className="banner-button" onClick={navigateToRecommend}>
              <AtIcon value="lightning-bolt" size="16" color="#fff" />
              <Text className="banner-button-text">智能推荐</Text>
            </View>
          </View>
        </View>
      )}

      {/* 快捷入口 */}
      <View className="quick-actions">
        <View className="action-item" onClick={navigateToRecommend}>
          <View className="action-icon recommend-icon">🤖</View>
          <Text className="action-text">AI 推荐</Text>
        </View>
        <View
          className="action-item"
          onClick={() => Taro.switchTab({ url: '/pages/recipe/index' })}
        >
          <View className="action-icon recipe-icon">📖</View>
          <Text className="action-text">菜谱</Text>
        </View>
        <View
          className="action-item"
          onClick={() => Taro.switchTab({ url: '/pages/takeout/index' })}
        >
          <View className="action-icon takeout-icon">🍔</View>
          <Text className="action-text">外卖</Text>
        </View>
      </View>

      {/* 今日推荐 */}
      {recommendRecipes.length > 0 && (
        <View className="section">
          <View className="section-header">
            <Text className="section-title">✨ 今日推荐</Text>
            <Text className="section-more" onClick={navigateToRecommend}>
              更多 <AtIcon value="chevron-right" size="14" color="#999" />
            </Text>
          </View>
          <ScrollView className="recommend-scroll" scrollX>
            {recommendRecipes.map(recipe => (
              <View
                key={recipe.id}
                className="recommend-card"
                onClick={() => navigateToRecipeDetail(recipe.id)}
              >
                <View className="recommend-image-wrapper">
                  {recipe.image_path ? (
                    <Image
                      src={recipe.image_path}
                      className="recommend-image"
                      mode="aspectFill"
                    />
                  ) : (
                    <View className="recommend-image-placeholder">
                      <Text className="placeholder-icon">📷</Text>
                      <Text className="placeholder-text">暂无图片</Text>
                    </View>
                  )}
                  <View
                    className="recommend-category"
                    style={{ backgroundColor: getCategoryColor(recipe.category) }}
                  >
                    {getCategoryLabel(recipe.category)}
                  </View>
                </View>
                <View className="recommend-info">
                  <Text className="recommend-name">{formatRecipeName(recipe.name)}</Text>
                  {recipe.tags && (
                    <ScrollView className="recommend-tags" scrollX enhanced showScrollbar={false}>
                      <View className="tags-inner">
                        {recipe.tags.cuisines?.map((tag, idx) => (
                          <Text key={`c-${idx}`} className="tag tag-cuisine">{tag}</Text>
                        ))}
                        {recipe.tags.flavors?.map((tag, idx) => (
                          <Text key={`f-${idx}`} className="tag tag-flavor">{tag}</Text>
                        ))}
                        {recipe.tags.scenes?.map((tag, idx) => (
                          <Text key={`s-${idx}`} className="tag tag-scene">{tag}</Text>
                        ))}
                      </View>
                    </ScrollView>
                  )}
                  <View className="recommend-meta">
                    <AtRate value={recipe.difficulty} max={5} size={10} />
                    {recipe.total_time_minutes && (
                      <Text className="recommend-time">{recipe.total_time_minutes}分钟</Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 热门菜谱 */}
      {hotRecipes.length > 0 && (
        <View className="section">
          <View className="section-header">
            <Text className="section-title">🔥 热门菜谱</Text>
            <Text
              className="section-more"
              onClick={() => Taro.switchTab({ url: '/pages/recipe/index' })}
            >
              更多 <AtIcon value="chevron-right" size="14" color="#999" />
            </Text>
          </View>
          <View className="recipe-grid">
            {hotRecipes.map(recipe => (
              <View
                key={recipe.id}
                className="recipe-item"
                onClick={() => navigateToRecipeDetail(recipe.id)}
              >
                <View className="recipe-image-wrapper">
                  {recipe.image_path ? (
                    <Image
                      src={recipe.image_path}
                      className="recipe-image"
                      mode="aspectFill"
                    />
                  ) : (
                    <View className="recipe-image-placeholder">
                      <Text className="placeholder-icon">📷</Text>
                      <Text className="placeholder-text">暂无图片</Text>
                    </View>
                  )}
                  <View
                    className="recipe-category"
                    style={{ backgroundColor: getCategoryColor(recipe.category) }}
                  >
                    {getCategoryLabel(recipe.category)}
                  </View>
                </View>
                <View className="recipe-info">
                  <Text className="recipe-name">{formatRecipeName(recipe.name)}</Text>
                  {recipe.tags && (
                    <ScrollView className="recipe-tags" scrollX enhanced showScrollbar={false}>
                      <View className="tags-inner">
                        {recipe.tags.cuisines?.map((tag, idx) => (
                          <Text key={`c-${idx}`} className="tag tag-cuisine">{tag}</Text>
                        ))}
                        {recipe.tags.flavors?.map((tag, idx) => (
                          <Text key={`f-${idx}`} className="tag tag-flavor">{tag}</Text>
                        ))}
                        {recipe.tags.scenes?.map((tag, idx) => (
                          <Text key={`s-${idx}`} className="tag tag-scene">{tag}</Text>
                        ))}
                      </View>
                    </ScrollView>
                  )}
                  <View className="recipe-meta">
                    <AtRate value={recipe.difficulty} max={5} size={10} />
                    {recipe.total_time_minutes && (
                      <Text className="recipe-time">{recipe.total_time_minutes}分钟</Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 空状态 */}
      {recommendRecipes.length === 0 && hotRecipes.length === 0 && (
        <View className="empty-state">
          <View className="empty-icon">🍳</View>
          <Text className="empty-text">暂无菜谱数据</Text>
          <View className="empty-action" onClick={() => Taro.switchTab({ url: '/pages/recipe/index' })}>
            <Text>去看看菜谱</Text>
          </View>
        </View>
      )}

      {/* 底部间距 */}
      <View className="bottom-spacer" />
    </View>
  );
};

export default Index;
