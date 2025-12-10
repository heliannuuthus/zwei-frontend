import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import {
  AtSearchBar,
  AtMessage,
  AtActivityIndicator,
  AtIcon,
  AtBadge,
  AtFloatLayout,
  AtRate,
} from 'taro-ui';
import {
  getRecipes,
  getCategories,
  RecipeListItem,
  Category,
} from '../../services/recipe';
import { getCategoryColor } from '../../utils/category';
import './index.scss';

// 存储 key
const COOKING_LIST_KEY = 'cooking_list';

// 清单项类型
interface CookingListItem {
  id: string;
  name: string;
  image_path?: string;
  category: string;
  addedAt: number;
}

// 获取做饭清单
const getCookingList = (): CookingListItem[] => {
  try {
    const data = Taro.getStorageSync(COOKING_LIST_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// 保存做饭清单
const saveCookingList = (items: CookingListItem[]) => {
  Taro.setStorageSync(COOKING_LIST_KEY, JSON.stringify(items));
};

// 每个分类的数据状态
interface CategoryData {
  recipes: RecipeListItem[];
  loading: boolean;
  hasMore: boolean;
  page: number;
}

const Recipe = () => {
  const [categoryData, setCategoryData] = useState<
    Record<string, CategoryData>
  >({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string>('');
  const [searchValue, setSearchValue] = useState<string>('');
  const [cookingList, setCookingList] = useState<CookingListItem[]>([]);
  const [showCookingList, setShowCookingList] = useState(false);
  const [scrollHeight, setScrollHeight] = useState<number>(0);
  const pageSize = 20;

  // 使用 ref 保存最新的 searchValue
  const searchValueRef = useRef<string>('');
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    searchValueRef.current = searchValue;
  }, [searchValue]);

  // 使用 ref 保存 categoryData
  const categoryDataRef = useRef<Record<string, CategoryData>>({});
  useEffect(() => {
    categoryDataRef.current = categoryData;
  }, [categoryData]);

  // 初始化加载做饭清单
  useEffect(() => {
    const list = getCookingList();
    setCookingList(list);
  }, []);

  // 计算滚动区域高度
  useEffect(() => {
    const query = Taro.createSelectorQuery();
    query.select('.header-section').boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec(res => {
      const headerHeight = res[0]?.height || 0;
      const systemInfo = Taro.getSystemInfoSync();
      const windowHeight = systemInfo.windowHeight;
      // 减去 1px 补偿 border
      setScrollHeight(windowHeight - headerHeight - 1);
    });
  }, []);

  // 更新分类数据
  const updateCategoryData = useCallback(
    (category: string, updates: Partial<CategoryData>) => {
      setCategoryData(prev => {
        const currentData = prev[category] || {
          recipes: [],
          loading: false,
          hasMore: true,
          page: 0,
        };
        return {
          ...prev,
          [category]: {
            ...currentData,
            ...updates,
          },
        };
      });
    },
    []
  );

  // 加载分类列表
  const loadCategories = useCallback(async () => {
    try {
      const categoriesData = await getCategories();
      const safeCategories = Array.isArray(categoriesData)
        ? categoriesData
        : [];
      setCategories(safeCategories);
      // 缓存分类数据到本地存储，供其他页面使用
      Taro.setStorageSync('categories_cache', JSON.stringify(safeCategories));
    } catch (error) {
      console.error('加载分类失败:', error);
      Taro.atMessage({
        message: '加载分类失败',
        type: 'error',
      });
      setCategories([]);
    }
  }, []);

  // 加载菜谱列表
  const loadRecipes = useCallback(
    async (category: string, reset = false) => {
      const currentData = categoryDataRef.current[category] || {
        recipes: [],
        loading: false,
        hasMore: true,
        page: 0,
      };

      if (currentData.loading) return;

      updateCategoryData(category, { loading: true });

      try {
        const page = reset ? 0 : currentData.page;
        const currentSearchValue = searchValueRef.current;
        const recipes = await getRecipes({
          category: category || undefined,
          search: currentSearchValue || undefined,
          limit: pageSize,
          offset: page * pageSize,
        });

        const latestData = categoryDataRef.current[category] || {
          recipes: [],
          loading: false,
          hasMore: true,
          page: 0,
        };
        setCategoryData(prev => ({
          ...prev,
          [category]: {
            recipes: reset ? recipes : [...latestData.recipes, ...recipes],
            hasMore: recipes.length === pageSize,
            page: page + 1,
            loading: false,
          },
        }));
      } catch (error) {
        console.error('加载菜谱失败:', error);
        updateCategoryData(category, { loading: false });
        Taro.atMessage({
          message: '加载菜谱失败',
          type: 'error',
        });
      }
    },
    [updateCategoryData, pageSize]
  );

  // 切换分类
  const handleCategoryChange = useCallback(
    (category: string) => {
      setCurrentCategory(category);

      const currentData = categoryDataRef.current[category] || {
        recipes: [],
        loading: false,
        hasMore: true,
        page: 0,
      };

      if (currentData.recipes.length === 0 && !currentData.loading) {
        loadRecipes(category, true);
      }
    },
    [loadRecipes]
  );

  // 执行搜索（内部方法）
  const doSearch = useCallback(
    (value: string) => {
      searchValueRef.current = value;
      setCategoryData({});
      categoryDataRef.current = {};
      setTimeout(() => {
        loadRecipes(currentCategory, true);
      }, 0);
    },
    [currentCategory, loadRecipes]
  );

  // 搜索输入变化（带防抖）
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);

      // 清除之前的定时器
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }

      // 设置新的防抖定时器（500ms）
      searchTimerRef.current = setTimeout(() => {
        doSearch(value);
      }, 500);
    },
    [doSearch]
  );

  // 清理定时器
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // 跳转到详情页
  const navigateToDetail = useCallback((recipeId: string) => {
    Taro.navigateTo({
      url: `/pages/recipe/detail?id=${recipeId}`,
    });
  }, []);

  // 加载更多
  const loadMore = useCallback(() => {
    const currentData = categoryDataRef.current[currentCategory] || {
      recipes: [],
      loading: false,
      hasMore: true,
      page: 0,
    };
    if (currentData.hasMore && !currentData.loading) {
      loadRecipes(currentCategory, false);
    }
  }, [currentCategory, loadRecipes]);

  // 格式化菜谱名称（去掉"的做法"后缀）
  const formatRecipeName = useCallback((name: string) => {
    return name.replace(/的做法$/, '');
  }, []);

  // 添加到做饭清单
  const addToCookingList = useCallback(
    (recipe: RecipeListItem) => {
      const isInList = cookingList.some(item => item.id === recipe.id);

      if (isInList) {
        // 已在清单中，移除
        const newList = cookingList.filter(item => item.id !== recipe.id);
        setCookingList(newList);
        saveCookingList(newList);
      } else {
        // 添加到清单
        const newItem: CookingListItem = {
          id: recipe.id,
          name: formatRecipeName(recipe.name),
          image_path: recipe.image_path,
          category: recipe.category,
          addedAt: Date.now(),
        };
        const newList = [...cookingList, newItem];
        setCookingList(newList);
        saveCookingList(newList);
      }
    },
    [cookingList, formatRecipeName]
  );

  // 从清单移除
  const removeFromCookingList = useCallback((itemId: string) => {
    setCookingList(prev => {
      const newList = prev.filter(item => item.id !== itemId);
      saveCookingList(newList);
      return newList;
    });
    Taro.showToast({
      title: '已移除',
      icon: 'none',
      duration: 1000,
    });
  }, []);

  // 清空做饭清单
  const clearCookingList = useCallback(() => {
    Taro.showModal({
      title: '确认清空',
      content: '确定要清空做饭清单吗？',
      success: res => {
        if (res.confirm) {
          // 先关闭浮层，避免组件卸载时事件清理问题
          setShowCookingList(false);
          setTimeout(() => {
            setCookingList([]);
            saveCookingList([]);
            Taro.showToast({
              title: '已清空',
              icon: 'success',
            });
          }, 100);
        }
      },
    });
  }, []);
  // 初始化加载
  useEffect(() => {
    loadCategories();
    loadRecipes('', true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 获取当前分类的数据
  const currentCategoryData = useMemo(() => {
    return (
      categoryData[currentCategory] || {
        recipes: [],
        loading: false,
        hasMore: true,
        page: 0,
      }
    );
  }, [categoryData, currentCategory]);

  // 检查菜谱是否在清单中
  const isInCookingList = useCallback(
    (recipeId: string) => {
      return cookingList.some(item => item.id === recipeId);
    },
    [cookingList]
  );

  // 根据分类 key 获取中文名称
  const getCategoryLabel = useCallback(
    (key: string) => {
      const cat = categories.find(c => c.key === key);
      return cat?.label || key;
    },
    [categories]
  );

  return (
    <View className="recipe-page">
      <AtMessage />

      {/* 顶部搜索栏 */}
      <View className="header-section">
        <View className="search-wrapper">
          <AtSearchBar
            value={searchValue}
            onChange={handleSearchChange}
            onConfirm={() => {
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              doSearch(searchValue);
            }}
            onActionClick={() => {
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              doSearch(searchValue);
            }}
            placeholder="搜索菜谱..."
            actionName="搜索"
          />
        </View>
      </View>

      {/* 主内容区域 - 左右布局 */}
      <View className="main-content">
        {/* 左侧分类栏 */}
        <ScrollView
          className="category-sidebar"
          scrollY
          enhanced
          bounces
          style={{ height: scrollHeight ? `${scrollHeight}px` : '100%' }}
        >
          <View
            className={`category-item ${currentCategory === '' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('')}
          >
            <Text className="category-text">全部</Text>
          </View>
          {categories.map(cat => (
            <View
              key={cat.key}
              className={`category-item ${currentCategory === cat.key ? 'active' : ''}`}
              onClick={() => handleCategoryChange(cat.key)}
            >
              <Text className="category-text">{cat.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* 右侧菜谱列表 */}
        <ScrollView
          className="recipe-list"
          scrollY
          enhanced
          bounces
          style={{ height: scrollHeight ? `${scrollHeight}px` : '100%' }}
          onScrollToLower={loadMore}
          enableBackToTop
        >
          {/* Loading 状态 */}
          {currentCategoryData.loading &&
            currentCategoryData.recipes.length === 0 && (
              <View className="loading-container">
                <AtActivityIndicator mode="center" content="加载中..." />
              </View>
            )}

          {/* 空状态 */}
          {!currentCategoryData.loading &&
            currentCategoryData.recipes.length === 0 && (
              <View className="empty-state">
                <View className="empty-icon">🍳</View>
                <Text className="empty-text">暂无菜谱</Text>
              </View>
            )}

          {/* 菜谱列表 */}
          {currentCategoryData.recipes.length > 0 && (
            <View className="recipe-grid">
              {currentCategoryData.recipes.map(recipe => {
                const inList = isInCookingList(recipe.id);
                return (
                  <View key={recipe.id} className="recipe-card">
                    {/* 可点击区域 */}
                    <View
                      className="card-clickable"
                      onClick={() => navigateToDetail(recipe.id)}
                    >
                      {/* 图片区域 */}
                      <View className="card-image">
                        {recipe.image_path ? (
                          <Image
                            src={recipe.image_path}
                            className="image-content"
                            mode="aspectFill"
                            lazyLoad
                          />
                        ) : (
                          <View className="image-placeholder">
                            <Text className="placeholder-emoji">🍽️</Text>
                          </View>
                        )}
                      </View>

                      {/* 信息区域 */}
                      <View className="card-info">
                        <Text className="recipe-name">
                          {formatRecipeName(recipe.name)}
                        </Text>
                        {/* 烹饪时间 */}
                        {recipe.total_time_minutes && (
                          <View className="recipe-meta">
                            <Text className="meta-label">时间：</Text>
                            <Text className="meta-text">
                              {recipe.total_time_minutes}分钟
                            </Text>
                          </View>
                        )}
                        {/* 难度 */}
                        <View className="recipe-difficulty">
                          <Text className="meta-label">难度：</Text>
                          <AtRate value={recipe.difficulty} max={5} size={8} />
                        </View>
                        {/* 分类标签 */}
                        <View
                          className="category-badge"
                          style={{
                            backgroundColor: getCategoryColor(recipe.category),
                          }}
                        >
                          {getCategoryLabel(recipe.category)}
                        </View>
                      </View>
                    </View>
                    {/* 添加到清单按钮 - 独立区域 */}
                    <View
                      className={`add-to-list-btn ${inList ? 'in-list' : ''}`}
                      onClick={() => addToCookingList(recipe)}
                    >
                      <AtIcon
                        value={inList ? 'check' : 'add'}
                        size="14"
                        color="#fff"
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* 加载更多 */}
          {currentCategoryData.loading &&
            currentCategoryData.recipes.length > 0 && (
              <View className="list-footer loading">
                <AtActivityIndicator size={24} />
                <Text className="footer-text">加载中</Text>
              </View>
            )}
          {!currentCategoryData.hasMore &&
            currentCategoryData.recipes.length > 0 && (
              <View className="list-footer no-more">
                <View className="footer-line" />
                <Text className="footer-text">已经到底啦</Text>
                <View className="footer-line" />
              </View>
            )}
        </ScrollView>
      </View>

      {/* 悬浮清单按钮 */}
      <View
        className="floating-cart-btn"
        onClick={() => setShowCookingList(true)}
      >
        <AtBadge value={cookingList.length > 0 ? cookingList.length : ''}>
          <View className="cart-icon-wrapper">
            <AtIcon value="shopping-bag" size="22" color="#fff" />
          </View>
        </AtBadge>
      </View>

      {/* 做饭清单浮层 */}
      <AtFloatLayout
        isOpened={showCookingList}
        title="做饭清单"
        onClose={() => setShowCookingList(false)}
      >
        <View className="cooking-list">
          {cookingList.length === 0 ? (
            <View className="cooking-empty">
              <View className="cooking-empty-icon">🛒</View>
              <Text className="cooking-empty-text">清单是空的</Text>
              <Text className="cooking-empty-hint">
                点击菜品卡片右下角的 + 添加到清单
              </Text>
            </View>
          ) : (
            <>
              <View className="cooking-header">
                <Text className="cooking-count">
                  共 {cookingList.length} 道菜
                </Text>
                <View className="clear-btn" onClick={clearCookingList}>
                  <Text>清空</Text>
                </View>
              </View>
              <ScrollView className="cooking-scroll" scrollY>
                {cookingList.map(item => (
                  <View key={item.id} className="cooking-item">
                    <View
                      className="cooking-item-content"
                      onClick={() => {
                        setShowCookingList(false);
                        navigateToDetail(item.id);
                      }}
                    >
                      <View className="cooking-item-image">
                        {item.image_path ? (
                          <Image
                            src={item.image_path}
                            className="cooking-image"
                            mode="aspectFill"
                          />
                        ) : (
                          <View className="cooking-image-placeholder">🍽️</View>
                        )}
                      </View>
                      <View className="cooking-item-info">
                        <Text className="cooking-item-name">{item.name}</Text>
                        <Text className="cooking-item-category">
                          {getCategoryLabel(item.category)}
                        </Text>
                      </View>
                    </View>
                    <View
                      className="cooking-item-remove"
                      onClick={() => removeFromCookingList(item.id)}
                    >
                      <AtIcon value="close" size="16" color="#999" />
                    </View>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </AtFloatLayout>
    </View>
  );
};

export default Recipe;
