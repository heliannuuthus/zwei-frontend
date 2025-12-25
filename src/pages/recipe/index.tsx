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
import checklistIcon from '../../assets/icons/checklist.svg';
import './index.scss';

// 存储 key
const COOKING_LIST_KEY = 'cooking_list';

// 菜单项类型
interface CookingListItem {
  id: string;
  name: string;
  description?: string;
  image_path?: string;
  category: string;
  tags?: {
    cuisines: string[];
    flavors: string[];
    scenes: string[];
  };
  servings: number;
  addedAt: number;
}

// 辅助函数：将分组 tags 转为数组
const flattenTags = (tags?: {
  cuisines: string[];
  flavors: string[];
  scenes: string[];
}): string[] => {
  if (!tags) return [];
  return [
    ...(tags.cuisines || []),
    ...(tags.flavors || []),
    ...(tags.scenes || []),
  ];
};

// 获取今日菜单
const getCookingList = (): CookingListItem[] => {
  try {
    const data = Taro.getStorageSync(COOKING_LIST_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// 保存今日菜单
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
  const [showServingsModal, setShowServingsModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeListItem | null>(
    null
  );
  const [selectedServings, setSelectedServings] = useState(1);
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

  // 初始化加载今日菜单
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

  // 点击添加按钮，打开份数选择
  const handleAddClick = useCallback(
    (recipe: RecipeListItem) => {
      const existingItem = cookingList.find(item => item.id === recipe.id);
      if (existingItem) {
        setSelectedServings(existingItem.servings);
      } else {
        setSelectedServings(1);
      }
      setSelectedRecipe(recipe);
      setShowServingsModal(true);
    },
    [cookingList]
  );

  // 确认添加到菜单
  const confirmAddToList = useCallback(() => {
    if (!selectedRecipe) return;

    const existingIndex = cookingList.findIndex(
      item => item.id === selectedRecipe.id
    );

    if (existingIndex >= 0) {
      // 更新份数
      const newList = [...cookingList];
      newList[existingIndex].servings = selectedServings;
      setCookingList(newList);
      saveCookingList(newList);
    } else {
      // 新增
      const newItem: CookingListItem = {
        id: selectedRecipe.id,
        name: formatRecipeName(selectedRecipe.name),
        description: selectedRecipe.description,
        image_path: selectedRecipe.image_path,
        category: selectedRecipe.category,
        tags: selectedRecipe.tags,
        servings: selectedServings,
        addedAt: Date.now(),
      };
      const newList = [...cookingList, newItem];
      setCookingList(newList);
      saveCookingList(newList);
    }

    setShowServingsModal(false);
    setSelectedRecipe(null);
  }, [selectedRecipe, selectedServings, cookingList, formatRecipeName]);

  // 从菜单移除
  const removeFromList = useCallback(
    (recipeId: string) => {
      const newList = cookingList.filter(item => item.id !== recipeId);
      setCookingList(newList);
      saveCookingList(newList);
    },
    [cookingList]
  );

  // 更新菜单项份数
  const updateServings = useCallback(
    (recipeId: string, delta: number) => {
      const newList = cookingList.map(item => {
        if (item.id === recipeId) {
          const newServings = Math.max(1, item.servings + delta);
          return { ...item, servings: newServings };
        }
        return item;
      });
      setCookingList(newList);
      saveCookingList(newList);
    },
    [cookingList]
  );

  // 清空今日菜单
  const clearCookingList = useCallback(() => {
    Taro.showModal({
      title: '确认清空',
      content: '确定要清空今日菜单吗？',
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

  // 检查菜谱是否在菜单中
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
                            <Text className="placeholder-icon">📷</Text>
                            <Text className="placeholder-text">暂无图片</Text>
                          </View>
                        )}
                        <View
                          className="image-category"
                          style={{
                            backgroundColor: getCategoryColor(recipe.category),
                          }}
                        >
                          {getCategoryLabel(recipe.category)}
                        </View>
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
                        {/* Tags */}
                        {recipe.tags && (
                          <ScrollView
                            className="recipe-tags"
                            scrollX
                            enhanced
                            showScrollbar={false}
                          >
                            <View className="tags-inner">
                              {recipe.tags.cuisines?.map((tag, idx) => (
                                <Text
                                  key={`c-${idx}`}
                                  className="tag tag-cuisine"
                                >
                                  {tag}
                                </Text>
                              ))}
                              {recipe.tags.flavors?.map((tag, idx) => (
                                <Text
                                  key={`f-${idx}`}
                                  className="tag tag-flavor"
                                >
                                  {tag}
                                </Text>
                              ))}
                              {recipe.tags.scenes?.map((tag, idx) => (
                                <Text
                                  key={`s-${idx}`}
                                  className="tag tag-scene"
                                >
                                  {tag}
                                </Text>
                              ))}
                            </View>
                          </ScrollView>
                        )}
                      </View>
                    </View>
                    {/* 添加到清单按钮 - 独立区域 */}
                    <View
                      className={`add-to-list-btn ${inList ? 'in-list' : ''}`}
                      onClick={() => handleAddClick(recipe)}
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

      {/* 悬浮清单按钮 - 仅在有菜谱时显示 */}
      {cookingList.length > 0 && (
        <View
          className="floating-cart-btn"
          onClick={() => setShowCookingList(true)}
        >
          <AtBadge value={cookingList.length}>
            <View className="cart-icon-wrapper">
              <Image src={checklistIcon} className="cart-icon" />
            </View>
          </AtBadge>
        </View>
      )}

      {/* 今日菜单浮层 */}
      <AtFloatLayout
        isOpened={showCookingList}
        onClose={() => setShowCookingList(false)}
      >
        <View className="cooking-list">
          <View className="cooking-header-bar">
            <View className="cooking-header-left">
              <Text className="cooking-title">
                共 {cookingList.length} 道菜
              </Text>
              <View className="cooking-categories">
                {[...new Set(cookingList.map(item => item.category))].map(
                  (cat, idx) => (
                    <Text key={idx} className="cooking-category-tag">
                      {getCategoryLabel(cat)}
                    </Text>
                  )
                )}
              </View>
            </View>
            {cookingList.length > 0 && (
              <View className="cooking-header-actions">
                <View
                  className="action-btn shopping-btn"
                  onClick={() => {
                    setShowCookingList(false);
                    Taro.navigateTo({ url: '/pages/recipe/shopping' });
                  }}
                >
                  <Text className="action-btn-text">🛒 购物清单</Text>
                </View>
                <View
                  className="action-btn clear-btn"
                  onClick={clearCookingList}
                >
                  <AtIcon value="trash" size="16" color="#ff4d4f" />
                </View>
              </View>
            )}
          </View>
          {cookingList.length === 0 ? (
            <View className="cooking-empty">
              <View className="cooking-empty-icon">🛒</View>
              <Text className="cooking-empty-text">菜单是空的</Text>
              <Text className="cooking-empty-hint">
                点击菜品卡片右下角的 + 添加到菜单
              </Text>
            </View>
          ) : (
            <>
              <ScrollView className="cooking-scroll" scrollY>
                {cookingList.map(item => (
                  <View key={item.id} className="cooking-item">
                    <View
                      className="cooking-item-main"
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
                        {item.tags && flattenTags(item.tags).length > 0 && (
                          <View className="cooking-item-tags">
                            {flattenTags(item.tags)
                              .slice(0, 2)
                              .map((tag, idx) => (
                                <Text key={idx} className="cooking-item-tag">
                                  {tag}
                                </Text>
                              ))}
                          </View>
                        )}
                      </View>
                    </View>
                    <View className="cooking-item-stepper">
                      <View
                        className={`stepper-btn minus ${item.servings <= 1 ? 'disabled' : ''}`}
                        onClick={e => {
                          e.stopPropagation();
                          if (item.servings <= 1) {
                            removeFromList(item.id);
                          } else {
                            updateServings(item.id, -1);
                          }
                        }}
                      >
                        <Text className="stepper-btn-text">
                          {item.servings <= 1 ? '×' : '−'}
                        </Text>
                      </View>
                      <View className="stepper-value">
                        <Text className="stepper-num">{item.servings}</Text>
                      </View>
                      <View
                        className="stepper-btn plus"
                        onClick={e => {
                          e.stopPropagation();
                          updateServings(item.id, 1);
                        }}
                      >
                        <Text className="stepper-btn-text">+</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </AtFloatLayout>

      {/* 份数选择弹窗 */}
      {showServingsModal && selectedRecipe && (
        <View
          className="servings-modal-mask"
          onClick={() => setShowServingsModal(false)}
        >
          <View className="servings-modal" onClick={e => e.stopPropagation()}>
            <View className="servings-modal-header">
              <Text className="servings-modal-title">
                {formatRecipeName(selectedRecipe.name)}
              </Text>
            </View>
            <View className="servings-modal-body">
              <Text className="servings-hint">选择份数</Text>
              <View className="servings-selector">
                <View
                  className={`servings-btn ${selectedServings <= 1 ? 'disabled' : ''}`}
                  onClick={() =>
                    selectedServings > 1 && setSelectedServings(s => s - 1)
                  }
                >
                  <Text className="servings-btn-text">−</Text>
                </View>
                <View className="servings-value">
                  <Text className="servings-num">{selectedServings}</Text>
                  <Text className="servings-unit">人份</Text>
                </View>
                <View
                  className="servings-btn"
                  onClick={() => setSelectedServings(s => s + 1)}
                >
                  <Text className="servings-btn-text">+</Text>
                </View>
              </View>
            </View>
            <View className="servings-modal-footer">
              {isInCookingList(selectedRecipe.id) && (
                <View
                  className="servings-modal-btn remove"
                  onClick={() => {
                    removeFromList(selectedRecipe.id);
                    setShowServingsModal(false);
                  }}
                >
                  <Text>移除</Text>
                </View>
              )}
              <View
                className="servings-modal-btn confirm"
                onClick={confirmAddToList}
              >
                <Text>
                  {isInCookingList(selectedRecipe.id) ? '更新' : '添加到菜单'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default Recipe;
