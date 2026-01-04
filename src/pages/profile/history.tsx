import { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AtIcon, AtLoadMore } from 'taro-ui';
import {
  getViewHistory,
  HistoryListItem,
  clearViewHistory,
} from '../../services/history';
import { isLoggedIn } from '../../services/user';
import { getCategoryLabel, getCategoryColor } from '../../utils/category';
import './history.scss';

const HistoryPage = () => {
  const [history, setHistory] = useState<HistoryListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);
  const PAGE_SIZE = 20;

  // 加载浏览历史列表
  const loadHistory = useCallback(
    async (isLoadMore = false) => {
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
        const offset = isLoadMore ? history.length : 0;
        const res = await getViewHistory({ limit: PAGE_SIZE, offset });

        if (isLoadMore) {
          setHistory(prev => [...prev, ...res.items]);
        } else {
          setHistory(res.items);
        }

        setTotal(res.total);
        setHasMore(res.items.length === PAGE_SIZE);
      } catch (error) {
        console.error('加载浏览历史失败:', error);
        Taro.showToast({
          title: '加载失败',
          icon: 'none',
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [history.length]
  );

  useEffect(() => {
    loadHistory();
  }, []);

  // 页面显示时刷新（从详情页返回可能状态变化）
  Taro.useDidShow(() => {
    if (isLoggedIn() && history.length > 0) {
      loadHistory();
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
      loadHistory(true);
    }
  }, [loadingMore, hasMore, loadHistory]);

  // 清空浏览历史
  const handleClearHistory = useCallback(() => {
    Taro.showModal({
      title: '确认清空',
      content: '确定要清空所有浏览历史吗？',
      success: async res => {
        if (res.confirm) {
          try {
            await clearViewHistory();
            setHistory([]);
            setTotal(0);
            Taro.showToast({
              title: '已清空',
              icon: 'success',
            });
          } catch (error) {
            console.error('清空浏览历史失败:', error);
            Taro.showToast({
              title: '清空失败',
              icon: 'none',
            });
          }
        }
      },
    });
  }, []);

  // 未登录状态
  if (!isLoggedIn()) {
    return (
      <View className="history-page">
        <View className="empty-state">
          <AtIcon value="eye" size="64" color="#ddd" />
          <Text className="empty-text">登录后查看浏览历史</Text>
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
      <View className="history-page">
        <AtLoadMore status="loading" />
      </View>
    );
  }

  // 空状态
  if (history.length === 0) {
    return (
      <View className="history-page">
        <View className="empty-state">
          <AtIcon value="eye" size="64" color="#ddd" />
          <Text className="empty-text">暂无浏览历史</Text>
          <Text className="empty-hint">浏览过的菜谱会显示在这里</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="history-page">
      <View className="history-header">
        <Text className="history-count">共 {total} 条记录</Text>
        {total > 0 && (
          <View className="clear-btn" onClick={handleClearHistory}>
            <AtIcon value="trash" size="16" color="#E8503A" />
            <Text className="clear-text">清空</Text>
          </View>
        )}
      </View>

      <ScrollView
        className="history-scroll"
        scrollY
        onScrollToLower={handleLoadMore}
      >
        <View className="history-list">
          {history.map(item => (
            <View
              key={item.recipe_id}
              className="history-card"
              onClick={() => navigateToDetail(item.recipe_id)}
            >
              {item.recipe?.image_path ? (
                <Image
                  className="history-image"
                  src={item.recipe.image_path}
                  mode="aspectFill"
                />
              ) : (
                <View className="history-image-placeholder">
                  <AtIcon value="image" size="32" color="#ccc" />
                </View>
              )}

              <View className="history-content">
                <Text className="history-name">
                  {item.recipe?.name || '未知菜谱'}
                </Text>
                {item.recipe?.description && (
                  <Text className="history-desc" numberOfLines={2}>
                    {item.recipe.description}
                  </Text>
                )}
                <View className="history-meta">
                  {item.recipe?.category && (
                    <View
                      className="history-tag"
                      style={{
                        backgroundColor: getCategoryColor(item.recipe.category),
                      }}
                    >
                      <Text className="tag-text">
                        {getCategoryLabel(item.recipe.category)}
                      </Text>
                    </View>
                  )}
                  {item.recipe?.total_time_minutes && (
                    <View className="history-time">
                      <AtIcon value="clock" size="12" color="#999" />
                      <Text className="time-text">
                        {item.recipe.total_time_minutes}分钟
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View className="history-arrow">
                <AtIcon value="chevron-right" size="18" color="#ccc" />
              </View>
            </View>
          ))}
        </View>

        {/* 加载状态 */}
        {loadingMore && <AtLoadMore status="loading" />}

        {!hasMore && history.length > 0 && (
          <View className="no-more">
            <Text className="no-more-text">没有更多了</Text>
          </View>
        )}

        <View className="bottom-spacer" />
      </ScrollView>
    </View>
  );
};

export default HistoryPage;
