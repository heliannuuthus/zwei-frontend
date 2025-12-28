import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AtIcon, AtActivityIndicator } from 'taro-ui';
import { getRecipeDetail, RecipeDetail } from '../../services/recipe';
import {
  getIngredientCategory,
  mergeQuantities,
  INGREDIENT_CATEGORIES,
  type IngredientCategory,
} from '../../utils/ingredient';
import './shopping.scss';

const COOKING_LIST_KEY = 'cooking_list';

interface CookingListItem {
  id: string;
  name: string;
  servings: number;
}

interface IngredientSource {
  recipeName: string;
  quantity: string;
  servings: number;
}

interface MergedIngredient {
  name: string;
  category: IngredientCategory;
  sources: IngredientSource[];
  totalQuantity: string;
  checked: boolean;
}

interface GroupedIngredients {
  category: IngredientCategory;
  items: MergedIngredient[];
  allChecked: boolean;
}

const getCookingList = (): CookingListItem[] => {
  try {
    const data = Taro.getStorageSync(COOKING_LIST_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// 环形进度条组件
const ProgressRing = ({
  progress,
  size = 120,
  strokeWidth = 8,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) => {
  return (
    <View className="progress-ring" style={{ width: size, height: size }}>
      <View
        className="progress-ring-bg"
        style={{
          width: size,
          height: size,
          borderWidth: strokeWidth,
          borderRadius: size / 2,
        }}
      />
      <View
        className="progress-ring-fill"
        style={{
          width: size,
          height: size,
          borderWidth: strokeWidth,
          borderRadius: size / 2,
          // 使用 clip-path 模拟进度
          transform: `rotate(${-90 + progress * 360}deg)`,
        }}
      />
      <View className="progress-ring-center">
        <Text className="progress-percent">{Math.round(progress * 100)}%</Text>
        <Text className="progress-label">已购</Text>
      </View>
    </View>
  );
};

const ShoppingPage = () => {
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<
    Array<{ detail: RecipeDetail; servings: number }>
  >([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    const loadRecipeDetails = async () => {
      const cookingList = getCookingList();

      if (cookingList.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const details = await Promise.all(
          cookingList.map(async item => {
            const detail = await getRecipeDetail(item.id);
            return { detail, servings: item.servings };
          })
        );
        setRecipes(details);
      } catch (error) {
        console.error('加载菜谱详情失败:', error);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    };

    loadRecipeDetails();
  }, []);

  // 合并并分类食材
  const groupedIngredients = useMemo(() => {
    const ingredientMap = new Map<string, MergedIngredient>();

    recipes.forEach(({ detail, servings }) => {
      const ratio = servings / detail.servings;

      detail.ingredients.forEach(ing => {
        const key = ing.name;
        let quantityText = ing.text_quantity;

        if (ing.quantity && ratio !== 1) {
          const scaledQty = ing.quantity * ratio;
          quantityText = `${scaledQty % 1 === 0 ? scaledQty : scaledQty.toFixed(1)}${ing.unit || ''}`;
        }

        const source: IngredientSource = {
          recipeName: detail.name.replace(/的做法$/, ''),
          quantity: quantityText,
          servings,
        };

        const existing = ingredientMap.get(key);
        if (existing) {
          existing.sources.push(source);
          // 重新计算总量
          const merged = mergeQuantities(existing.sources);
          existing.totalQuantity = merged.total;
        } else {
          ingredientMap.set(key, {
            name: key,
            category: getIngredientCategory(ing.category),
            sources: [source],
            totalQuantity: quantityText,
            checked: false,
          });
        }
      });
    });

    // 按分类分组
    const groups: GroupedIngredients[] = [];
    const categoryMap = new Map<string, MergedIngredient[]>();

    ingredientMap.forEach(ing => {
      const catKey = ing.category.key;
      if (!categoryMap.has(catKey)) {
        categoryMap.set(catKey, []);
      }
      categoryMap.get(catKey)!.push(ing);
    });

    // 按预定义顺序排列分类
    INGREDIENT_CATEGORIES.forEach(cat => {
      const items = categoryMap.get(cat.key);
      if (items && items.length > 0) {
        // 按名称排序
        items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        groups.push({
          category: cat,
          items,
          allChecked: false,
        });
      }
    });

    return groups;
  }, [recipes]);

  // 计算进度
  const { totalCount, checkedCount, progress } = useMemo(() => {
    let total = 0;
    let checked = 0;

    groupedIngredients.forEach(group => {
      group.items.forEach(item => {
        total++;
        if (checkedItems.has(item.name)) {
          checked++;
        }
      });
    });

    return {
      totalCount: total,
      checkedCount: checked,
      progress: total > 0 ? checked / total : 0,
    };
  }, [groupedIngredients, checkedItems]);

  const toggleCheck = useCallback((name: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const toggleGroupCollapse = useCallback((categoryKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(categoryKey)) {
        next.delete(categoryKey);
      } else {
        next.add(categoryKey);
      }
      return next;
    });
  }, []);

  const toggleGroupCheck = useCallback(
    (group: GroupedIngredients) => {
      const allChecked = group.items.every(item => checkedItems.has(item.name));
      setCheckedItems(prev => {
        const next = new Set(prev);
        group.items.forEach(item => {
          if (allChecked) {
            next.delete(item.name);
          } else {
            next.add(item.name);
          }
        });
        return next;
      });
    },
    [checkedItems]
  );

  if (loading) {
    return (
      <View className="shopping-page">
        <View className="loading-container">
          <AtActivityIndicator mode="center" content="正在生成购物清单..." />
        </View>
      </View>
    );
  }

  if (recipes.length === 0) {
    return (
      <View className="shopping-page empty-page">
        <View className="empty-state">
          <View className="empty-icon-wrapper">
            <Text className="empty-icon">🛒</Text>
          </View>
          <Text className="empty-title">购物清单是空的</Text>
          <Text className="empty-hint">先去添加一些菜品到待做清单吧</Text>
          <View className="back-btn" onClick={() => Taro.navigateBack()}>
            <Text className="back-btn-text">返回选菜</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="shopping-page">
      {/* 头部统计区 */}
      <View className="shopping-header">
        <View className="header-bg" />
        <View className="header-content">
          <View className="header-left">
            <Text className="header-title">购物清单</Text>
            <Text className="header-subtitle">
              {recipes.length} 道菜 · {totalCount} 种食材
            </Text>
            <View className="stats-row">
              <View className="stat-item">
                <Text className="stat-value">{totalCount - checkedCount}</Text>
                <Text className="stat-label">待购</Text>
              </View>
              <View className="stat-divider" />
              <View className="stat-item">
                <Text className="stat-value checked">{checkedCount}</Text>
                <Text className="stat-label">已购</Text>
              </View>
            </View>
          </View>
          <View className="header-right">
            <ProgressRing progress={progress} size={100} strokeWidth={8} />
          </View>
        </View>
      </View>

      <ScrollView className="shopping-scroll" scrollY>
        {/* 分类食材列表 */}
        {groupedIngredients.map(group => {
          const isCollapsed = collapsedGroups.has(group.category.key);
          const groupCheckedCount = group.items.filter(item =>
            checkedItems.has(item.name)
          ).length;
          const isAllChecked = groupCheckedCount === group.items.length;

          return (
            <View key={group.category.key} className="ingredient-group">
              {/* 分组头部 */}
              <View
                className="group-header"
                onClick={() => toggleGroupCollapse(group.category.key)}
              >
                <View className="group-title-section">
                  <Text className="group-icon">{group.category.icon}</Text>
                  <Text className="group-title">{group.category.label}</Text>
                  <View
                    className="group-badge"
                    style={{ backgroundColor: group.category.color }}
                  >
                    <Text className="group-badge-text">
                      {groupCheckedCount}/{group.items.length}
                    </Text>
                  </View>
                </View>
                <View className="group-actions">
                  <View
                    className={`group-check-all ${isAllChecked ? 'checked' : ''}`}
                    onClick={e => {
                      e.stopPropagation();
                      toggleGroupCheck(group);
                    }}
                  >
                    <Text className="check-all-text">
                      {isAllChecked ? '取消全选' : '全选'}
                    </Text>
                  </View>
                  <View
                    className={`group-arrow ${isCollapsed ? '' : 'expanded'}`}
                  >
                    <AtIcon value="chevron-down" size="16" color="#999" />
                  </View>
                </View>
              </View>

              {/* 食材列表 */}
              {!isCollapsed && (
                <View className="group-items">
                  {[...group.items]
                    .sort((a, b) => {
                      const aChecked = checkedItems.has(a.name);
                      const bChecked = checkedItems.has(b.name);
                      if (aChecked === bChecked) return 0;
                      return aChecked ? 1 : -1;
                    })
                    .map(item => {
                      const isChecked = checkedItems.has(item.name);
                      return (
                        <View
                          key={item.name}
                          className={`ingredient-card ${isChecked ? 'checked' : ''}`}
                          onClick={() => toggleCheck(item.name)}
                        >
                          <View
                            className={`check-circle ${isChecked ? 'checked' : ''}`}
                            style={{
                              borderColor: isChecked
                                ? group.category.color
                                : '#ddd',
                              backgroundColor: isChecked
                                ? group.category.color
                                : 'transparent',
                            }}
                          >
                            {isChecked && (
                              <AtIcon value="check" size="14" color="#fff" />
                            )}
                          </View>
                          <View className="ingredient-info">
                            <View className="ingredient-main">
                              <Text className="ingredient-name">
                                {item.name}
                              </Text>
                              <Text className="ingredient-total">
                                {item.totalQuantity}
                              </Text>
                            </View>
                            {item.sources.length > 1 && (
                              <View className="ingredient-sources">
                                {item.sources.map((src, idx) => (
                                  <Text key={idx} className="source-item">
                                    {src.recipeName}: {src.quantity}
                                  </Text>
                                ))}
                              </View>
                            )}
                            {item.sources.length === 1 && (
                              <Text className="ingredient-recipe">
                                {item.sources[0].recipeName}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                </View>
              )}
            </View>
          );
        })}

        {/* 菜品清单 */}
        <View className="recipes-section">
          <View className="section-header">
            <Text className="section-icon">📋</Text>
            <Text className="section-title">本次菜品</Text>
          </View>
          <ScrollView
            className="recipes-scroll"
            scrollX
            enhanced
            showScrollbar={false}
          >
            <View className="recipes-list">
              {recipes.map(({ detail, servings }) => (
                <View key={detail.id} className="recipe-card">
                  {detail.image_path ? (
                    <Image
                      src={detail.image_path}
                      className="recipe-image"
                      mode="aspectFill"
                    />
                  ) : (
                    <View className="recipe-image-placeholder">
                      <Text className="placeholder-emoji">🍽️</Text>
                    </View>
                  )}
                  <View className="recipe-content">
                    <Text className="recipe-name">
                      {detail.name.replace(/的做法$/, '')}
                    </Text>
                    <Text className="recipe-servings">{servings} 人份</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <View className="bottom-spacer" />
      </ScrollView>
    </View>
  );
};

export default ShoppingPage;
