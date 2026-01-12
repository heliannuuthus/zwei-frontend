import { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components';
import { AtIcon } from 'taro-ui';
import Taro from '@tarojs/taro';
import { getBanners, getHotRecipes, BannerItem } from '../../services/home';
import { RecipeListItem } from '../../services/recipe';
import RecipeCard from '../../components/RecipeCard/index';
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
  const [hotRecipes, setHotRecipes] = useState<RecipeListItem[]>([]);

  const loadHomeData = useCallback(async () => {
    setLoading(true);
    try {
      // 并行请求两个接口
      const [bannersData, hotData] = await Promise.all([
        getBanners().catch(() => []),
        getHotRecipes(6).catch(() => []),
      ]);
      setBanners(bannersData || []);
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

  const handleBannerClick = useCallback(
    (banner: BannerItem) => {
      if (banner.link_type === 'recipe' && banner.link) {
        navigateToRecipeDetail(banner.link);
      } else if (banner.link_type === 'url' && banner.link) {
        // 小程序不支持直接打开外部链接，可以复制到剪贴板
        Taro.setClipboardData({ data: banner.link });
      }
    },
    [navigateToRecipeDetail]
  );

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
            <SwiperItem
              key={banner.id}
              onClick={() => handleBannerClick(banner)}
            >
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
            <Text className="banner-subtitle">为你精选今日美食</Text>
            <View className="banner-button" onClick={navigateToRecommend}>
              <AtIcon value="lightning-bolt" size="16" color="#fff" />
              <Text className="banner-button-text">查看推荐</Text>
            </View>
          </View>
        </View>
      )}

      {/* 快捷入口 */}
      <View className="quick-actions">
        <View className="action-item" onClick={navigateToRecommend}>
          <View className="action-icon recommend-icon">✨</View>
          <Text className="action-text">今日推荐</Text>
        </View>
        <View
          className="action-item"
          onClick={() => Taro.switchTab({ url: '/pages/recipe/index' })}
        >
          <View className="action-icon recipe-icon">📖</View>
          <Text className="action-text">菜谱</Text>
        </View>
      </View>

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
              <RecipeCard key={recipe.id} recipe={recipe} layout="grid" />
            ))}
          </View>
        </View>
      )}

      {/* 空状态 */}
      {hotRecipes.length === 0 && (
        <View className="empty-state">
          <View className="empty-icon">🍳</View>
          <Text className="empty-text">暂无菜谱数据</Text>
          <View
            className="empty-action"
            onClick={() => Taro.switchTab({ url: '/pages/recipe/index' })}
          >
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
