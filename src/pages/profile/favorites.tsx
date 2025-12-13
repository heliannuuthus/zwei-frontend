import { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AtIcon, AtLoadMore } from 'taro-ui';
import { getFavorites, FavoriteListItem } from '../../services/favorite';
import { isLoggedIn } from '../../services/user';
import { getCategoryLabel, getCategoryColor } from '../../utils/category';
import './favorites.scss';

const FavoritesPage = () => {
  const [favorites, setFavorites] = useState<FavoriteListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);
  const PAGE_SIZE = 20;

  // 加载收藏列表
  const loadFavorites = useCallback(async (isLoadMore = false) => {
    if (!isLoggedIn()) {
      setLoading(false);
      return;
    }

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const offset = isLoadMore ? favorites.length : 0;
      const res = await getFavorites({ limit: PAGE_SIZE, offset });
      
      if (isLoadMore) {
        setFavorites(prev => [...prev, ...res.items]);
      } else {
        setFavorites(res.items);
      }
      
      setTotal(res.total);
      setHasMore(res.items.length === PAGE_SIZE);
    } catch (error) {
      console.error('加载收藏列表失败:', error);
      Taro.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [favorites.length]);

  useEffect(() => {
    loadFavorites();
  }, []);

  // 页面显示时刷新（从详情页返回可能状态变化）
  Taro.useDidShow(() => {
    if (isLoggedIn() && favorites.length > 0) {
      loadFavorites();
    }
  });

  // 跳转到菜谱详情
  const navigateToDetail = useCallback((recipeId: string) => {
    Taro.navigateTo({
      url: `/pages/recipe/detail?id=${recipeId}`,
    });
  }, []);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadFavorites(true);
    }
  }, [loadingMore, hasMore, loadFavorites]);

  // 未登录状态
  if (!isLoggedIn()) {
    return (
      <View className="favorites-page">
        <View className="empty-state">
          <AtIcon value="heart" size="64" color="#ddd" />
          <Text className="empty-text">登录后查看收藏</Text>
          <View 
            className="login-btn"
            onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}
          >
            <Text className="login-btn-text">去登录</Text>
          </View>
        </View>
      </View>
    );
  }

  // 加载中
  if (loading) {
    return (
      <View className="favorites-page">
        <AtLoadMore status="loading" />
      </View>
    );
  }

  // 空状态
  if (favorites.length === 0) {
    return (
      <View className="favorites-page">
        <View className="empty-state">
          <AtIcon value="heart" size="64" color="#ddd" />
          <Text className="empty-text">暂无收藏</Text>
          <Text className="empty-hint">在菜谱详情页点击收藏按钮即可添加</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="favorites-page">
      <View className="favorites-header">
        <Text className="favorites-count">共 {total} 个收藏</Text>
      </View>
      
      <ScrollView
        className="favorites-scroll"
        scrollY
        onScrollToLower={handleLoadMore}
      >
        <View className="favorites-list">
          {favorites.map((item) => (
            <View
              key={item.id}
              className="favorite-card"
              onClick={() => navigateToDetail(item.recipe_id)}
            >
              {item.recipe?.image_path ? (
                <Image
                  className="favorite-image"
                  src={item.recipe.image_path}
                  mode="aspectFill"
                />
              ) : (
                <View className="favorite-image-placeholder">
                  <AtIcon value="image" size="32" color="#ccc" />
                </View>
              )}
              
              <View className="favorite-content">
                <Text className="favorite-name">{item.recipe?.name || '未知菜谱'}</Text>
                {item.recipe?.description && (
                  <Text className="favorite-desc" numberOfLines={2}>
                    {item.recipe.description}
                  </Text>
                )}
                <View className="favorite-meta">
                  {item.recipe?.category && (
                    <View 
                      className="favorite-tag"
                      style={{ backgroundColor: getCategoryColor(item.recipe.category) }}
                    >
                      <Text className="tag-text">{getCategoryLabel(item.recipe.category)}</Text>
                    </View>
                  )}
                  {item.recipe?.total_time_minutes && (
                    <View className="favorite-time">
                      <AtIcon value="clock" size="12" color="#999" />
                      <Text className="time-text">{item.recipe.total_time_minutes}分钟</Text>
                    </View>
                  )}
                </View>
              </View>
              
              <View className="favorite-arrow">
                <AtIcon value="chevron-right" size="18" color="#ccc" />
              </View>
            </View>
          ))}
        </View>

        {/* 加载状态 */}
        {loadingMore && (
          <AtLoadMore status="loading" />
        )}
        
        {!hasMore && favorites.length > 0 && (
          <View className="no-more">
            <Text className="no-more-text">没有更多了</Text>
          </View>
        )}

        <View className="bottom-spacer" />
      </ScrollView>
    </View>
  );
};

export default FavoritesPage;

