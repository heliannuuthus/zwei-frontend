import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Image, Canvas } from '@tarojs/components';
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

// 环形进度条组件 - 使用 Canvas 实现圆角端点
const ProgressRing = ({
  progress,
  size = 120,
  strokeWidth = 8,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) => {
  const canvasId = 'progress-ring-canvas';
  const progressPercent = Math.min(Math.max(progress, 0), 1);

  useEffect(() => {
    const drawProgress = () => {
      const query = Taro.createSelectorQuery();
      query
        .select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec(res => {
          if (!res[0]?.node) return;

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = Taro.getSystemInfoSync().pixelRatio;

          // 设置 canvas 实际像素尺寸
          canvas.width = size * dpr;
          canvas.height = size * dpr;
          ctx.scale(dpr, dpr);

          const centerX = size / 2;
          const centerY = size / 2;
          const radius = (size - strokeWidth) / 2;

          // 清除画布
          ctx.clearRect(0, 0, size, size);

          // 绘制背景轨道
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = strokeWidth;
          ctx.lineCap = 'round';
          ctx.stroke();

          // 绘制进度弧线
          if (progressPercent > 0) {
            const startAngle = -Math.PI / 2; // 从顶部开始
            const endAngle = startAngle + Math.PI * 2 * progressPercent;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = strokeWidth;
            ctx.lineCap = 'round'; // 圆角端点
            ctx.stroke();
          }
        });
    };

    // 延迟绘制确保 canvas 已挂载
    setTimeout(drawProgress, 100);
  }, [progressPercent, size, strokeWidth]);

  return (
    <View className="progress-ring" style={{ width: size, height: size }}>
      <Canvas
        type="2d"
        id={canvasId}
        className="progress-ring-canvas"
        style={{ width: size, height: size }}
      />
      <View className="progress-ring-center">
        <Text className="progress-percent">
          {Math.round(progressPercent * 100)}%
        </Text>
        <Text className="progress-label">完成度</Text>
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
  // 记录当前活跃的分类（用于高亮显示）
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // 记录正在执行动画的食材（用于淡出动画）
  const [animatingItem, setAnimatingItem] = useState<string | null>(null);
  // 记录刚完成移动的食材（用于淡入动画）
  const [movedItem, setMovedItem] = useState<string | null>(null);
  // 记录刚完成的分类（用于下沉动画）
  const [completingCategory, setCompletingCategory] = useState<string | null>(null);

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

  // 排序后的分类列表
  const sortedGroups = useMemo(() => {
    return [...groupedIngredients]
      .map(group => {
        // 计算分类完成状态
        const groupCheckedCount = group.items.filter(item =>
          checkedItems.has(item.name)
        ).length;
        const isAllChecked = groupCheckedCount === group.items.length;

        // 对分类内的食材排序：未完成的在前，已完成的在后
        const sortedItems = [...group.items].sort((a, b) => {
          const aChecked = checkedItems.has(a.name);
          const bChecked = checkedItems.has(b.name);
          if (aChecked === bChecked) return 0;
          return aChecked ? 1 : -1;
        });

        return {
          ...group,
          items: sortedItems,
          isAllChecked,
        };
      })
      .sort((a, b) => {
        // 全部完成的分类放到最后（保持其他分类原有顺序）
        if (a.isAllChecked && !b.isAllChecked) return 1;
        if (!a.isAllChecked && b.isAllChecked) return -1;
        return 0;
      });
  }, [groupedIngredients, checkedItems]);

  const toggleCheck = useCallback(
    (name: string, categoryKey: string) => {
      // 设置当前活跃分类（高亮效果）
      setActiveCategory(categoryKey);

      // 先播放淡出动画
      setAnimatingItem(name);

      // 动画结束后更新状态
      setTimeout(() => {
        setCheckedItems(prev => {
          const next = new Set(prev);
          const wasChecked = next.has(name);

          if (wasChecked) {
            next.delete(name);
          } else {
            next.add(name);
          }

          // 检查该分类是否即将全部完成
          const group = groupedIngredients.find(
            g => g.category.key === categoryKey
          );
          if (group && !wasChecked) {
            const willBeAllChecked = group.items.every(
              item => item.name === name || next.has(item.name)
            );
            if (willBeAllChecked) {
              // 触发分类完成动画
              setCompletingCategory(categoryKey);
              setTimeout(() => {
                setCompletingCategory(null);
              }, 600);
            }
          }

          return next;
        });

        // 清除淡出动画，设置淡入动画
        setAnimatingItem(null);
        setMovedItem(name);

        // 淡入动画结束后清除状态
        setTimeout(() => {
          setMovedItem(null);
        }, 300);
      }, 200);

      // 活跃状态在一段时间后自动清除
      setTimeout(() => {
        setActiveCategory(prev => (prev === categoryKey ? null : prev));
      }, 3000);
    },
    [groupedIngredients]
  );

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

      // 设置当前活跃分类
      setActiveCategory(group.category.key);

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

      // 如果是全选操作，触发分类完成动画
      if (!allChecked) {
        setCompletingCategory(group.category.key);
        setTimeout(() => {
          setCompletingCategory(null);
        }, 600);
      }

      // 活跃状态在一段时间后自动清除
      setTimeout(() => {
        setActiveCategory(prev =>
          prev === group.category.key ? null : prev
        );
      }, 3000);
    },
    [checkedItems]
  );

  if (loading) {
    return (
      <View className="shopping-page">
        <View className="loading-container">
          <AtActivityIndicator mode="center" content="正在整理购物清单..." />
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
          <Text className="empty-title">购物清单还是空的</Text>
          <Text className="empty-hint">
            先去添加一些想做的菜品，
            <Text className="empty-hint-highlight">一键生成</Text>购物清单
          </Text>
          <View className="back-btn" onClick={() => Taro.navigateBack()}>
            <Text className="back-btn-text">去添加菜品</Text>
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
            <Text className="header-title">我的购物清单</Text>
            <Text className="header-subtitle">
              {recipes.length} 道菜 · {totalCount} 种食材
            </Text>
            <View className="stats-row">
              <View className="stat-item">
                <Text className="stat-value">{totalCount - checkedCount}</Text>
                <Text className="stat-label">待购买</Text>
              </View>
              <View className="stat-divider" />
              <View className="stat-item">
                <Text className="stat-value checked">{checkedCount}</Text>
                <Text className="stat-label">已完成</Text>
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
        {sortedGroups.map(group => {
          const isCollapsed = collapsedGroups.has(group.category.key);
          const groupCheckedCount = group.items.filter(item =>
            checkedItems.has(item.name)
          ).length;
          const isAllChecked = groupCheckedCount === group.items.length;

          const isActive = activeCategory === group.category.key;
          const isCompleting = completingCategory === group.category.key;

          return (
            <View
              key={group.category.key}
              className={`ingredient-group ${isAllChecked ? 'completed' : ''} ${isActive ? 'active' : ''} ${isCompleting ? 'completing' : ''}`}
            >
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
                  {isAllChecked && (
                    <Text className="group-complete-tag">✓ 已完成</Text>
                  )}
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
                      {isAllChecked ? '取消' : '全选'}
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
                  {group.items.map(item => {
                    const isChecked = checkedItems.has(item.name);
                    const isAnimatingOut = animatingItem === item.name;
                    const isAnimatingIn = movedItem === item.name;
                    return (
                      <View
                        key={item.name}
                        className={`ingredient-card ${isChecked ? 'checked' : ''} ${isAnimatingOut ? 'slide-out-left' : ''} ${isAnimatingIn ? 'slide-in-right' : ''}`}
                        onClick={() => !isAnimatingOut && toggleCheck(item.name, group.category.key)}
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
                            <Text className="ingredient-name">{item.name}</Text>
                            <Text className="ingredient-total">
                              {item.totalQuantity}
                            </Text>
                          </View>
                          {item.sources.length > 1 && (
                            <View className="ingredient-sources">
                              {item.sources.map((src, idx) => (
                                <Text key={idx} className="source-item">
                                  {src.recipeName} 需要 {src.quantity}
                                </Text>
                              ))}
                            </View>
                          )}
                          {item.sources.length === 1 && (
                            <Text className="ingredient-recipe">
                              来自 {item.sources[0].recipeName}
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
            <Text className="section-icon">🍽️</Text>
            <Text className="section-title">本次要做的菜</Text>
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
                    <Text className="recipe-servings">{servings} 人量</Text>
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
