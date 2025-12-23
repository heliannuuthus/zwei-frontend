import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  RichText,
  Swiper,
  SwiperItem,
} from '@tarojs/components';
import Taro from '@tarojs/taro';
import {
  AtMessage,
  AtTag,
  AtRate,
  AtTimeline,
  AtFloatLayout,
  AtIcon,
} from 'taro-ui';
import { getRecipeDetail, RecipeDetail } from '../../services/recipe';
import { checkFavorite, toggleFavorite } from '../../services/favorite';
import { isLoggedIn } from '../../services/user';
import { getCategoryColor, getCategoryLabel } from '../../utils/category';
import starFilledIcon from '../../assets/icons/star-filled.svg';
import starOutlineIcon from '../../assets/icons/star-outline.svg';
// 组件样式通过 babel-plugin-import 自动按需导入
import './detail.scss';

// 步骤颜色配置 - AtTimeline 支持的颜色
const STEP_COLORS: Array<'blue' | 'green' | 'red' | 'yellow'> = [
  'blue',
  'green',
  'red',
  'yellow',
];

// 骨架屏组件
const DetailSkeleton = () => (
  <View className="recipe-detail-page skeleton">
    <View className="skeleton-image" />
    <View className="skeleton-content">
      <View className="skeleton-title" />
      <View className="skeleton-desc" />
      <View className="skeleton-tags">
        <View className="skeleton-tag" />
        <View className="skeleton-tag" />
      </View>
      <View className="skeleton-section">
        <View className="skeleton-section-title" />
        <View className="skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <View key={i} className="skeleton-card" />
          ))}
        </View>
      </View>
      <View className="skeleton-section">
        <View className="skeleton-section-title" />
        {[1, 2, 3].map(i => (
          <View key={i} className="skeleton-step" />
        ))}
      </View>
    </View>
  </View>
);

// 解析步骤描述，分离主要内容和提示
const parseStepDescription = (description: string) => {
  const tipIndex = description.indexOf('\n\n💡');
  if (tipIndex !== -1) {
    const content = description.substring(0, tipIndex).trim();
    const tipPart = description.substring(tipIndex + 2).trim();
    // 移除 "💡 提示：" 或 "💡提示:" 前缀
    const tip = tipPart.replace(/^💡\s*提示[：:]\s*/, '').trim();
    return { content, tip };
  }
  return { content: description, tip: null };
};

const RecipeDetailPage = () => {
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showTips, setShowTips] = useState<boolean>(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [favoriteLoading, setFavoriteLoading] = useState<boolean>(false);

  // 将步骤转换为 Timeline 格式
  const timelineItems = useMemo(() => {
    if (!recipe) return [];

    return recipe.steps.map((step, index) => {
      const { content, tip } = parseStepDescription(step.description);
      const color = STEP_COLORS[index % STEP_COLORS.length];

      // content 需要是 ReactNode[] 数组，提示以行内标签形式展示
      const contentNodes = [
        <View key="content" className="timeline-step-content">
          <Text className="step-main-text">{content}</Text>
          {tip && <Text className="step-inline-tip">💡 {tip}</Text>}
        </View>,
      ];

      return {
        title: '', // 移除标题
        content: contentNodes,
        color,
      };
    });
  }, [recipe]);

  // 加载菜谱详情（并行请求详情和收藏状态）
  const loadRecipeDetail = useCallback(async (recipeId: string) => {
    setLoading(true);

    // 并行发起请求
    const recipePromise = getRecipeDetail(recipeId);
    const favoritePromise = isLoggedIn()
      ? checkFavorite(recipeId).catch(() => false)
      : Promise.resolve(false);

    try {
      const [recipeData, favorited] = await Promise.all([
        recipePromise,
        favoritePromise,
      ]);

      setRecipe(recipeData);
      setIsFavorite(favorited);
      setLoading(false);

      // 设置页面标题
      Taro.setNavigationBarTitle({
        title: recipeData.name,
      });
    } catch (error) {
      console.error('加载菜谱详情失败:', error);
      setLoading(false);
      Taro.atMessage({
        message: '加载菜谱详情失败',
        type: 'error',
      });
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    }
  }, []);

  // 处理收藏
  const handleToggleFavorite = useCallback(async () => {
    if (!recipe) return;

    if (!isLoggedIn()) {
      Taro.showToast({
        title: '请先登录',
        icon: 'none',
      });
      return;
    }

    if (favoriteLoading) return;

    setFavoriteLoading(true);
    try {
      const newStatus = await toggleFavorite(recipe.id, isFavorite);
      setIsFavorite(newStatus);
      Taro.showToast({
        title: newStatus ? '已收藏' : '已取消收藏',
        icon: 'none',
        duration: 1500,
      });
    } catch (error) {
      console.error('收藏操作失败:', error);
      Taro.showToast({
        title: '操作失败',
        icon: 'none',
      });
    } finally {
      setFavoriteLoading(false);
    }
  }, [recipe, isFavorite, favoriteLoading]);

  useEffect(() => {
    const { id } = Taro.getCurrentInstance().router?.params || {};
    if (id) {
      loadRecipeDetail(id);
    } else {
      Taro.showToast({
        title: '菜谱ID不存在',
        icon: 'none',
      });
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    }
  }, [loadRecipeDetail]);

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!recipe) {
    return (
      <View className="recipe-detail-page">
        <View className="empty-state">
          <Text className="empty-text">菜谱不存在</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="recipe-detail-page">
      <AtMessage />
      <ScrollView className="detail-scroll" scrollY>
        {/* 菜谱轮播图 */}
        {recipe.images && recipe.images.length > 0 ? (
          <Swiper
            className="recipe-swiper"
            indicatorDots
            indicatorColor="rgba(255,255,255,0.5)"
            indicatorActiveColor="#fff"
            autoplay
            circular
          >
            {recipe.images.map((img, idx) => (
              <SwiperItem key={idx}>
                <Image
                  src={img}
                  className="recipe-swiper-image"
                  mode="aspectFill"
                />
              </SwiperItem>
            ))}
          </Swiper>
        ) : (
          <View className="recipe-image-placeholder">
            <Text className="placeholder-icon">📷</Text>
            <Text className="placeholder-text">暂无图片</Text>
          </View>
        )}

        {/* 基本信息 */}
        <View className="recipe-header">
          {/* 标题行：标题 + 分类 | 难度 + 份数 */}
          <View className="title-row">
            <View className="title-left">
              <Text className="recipe-title">{recipe.name}</Text>
              <View
                className="title-category"
                style={{ backgroundColor: getCategoryColor(recipe.category) }}
              >
                {getCategoryLabel(recipe.category)}
              </View>
            </View>
            <View className="title-right">
              <View className="meta-item">
                <Text className="meta-label">难度：</Text>
                <AtRate value={recipe.difficulty} max={5} size={12} />
              </View>
              <View className="meta-item">
                <Text className="meta-label">分量：</Text>
                <Text className="meta-value">{recipe.servings}人份</Text>
              </View>
            </View>
          </View>

          {/* Tags 标签 */}
          {recipe.tags && (
            <ScrollView
              className="recipe-detail-tags"
              scrollX
              enhanced
              showScrollbar={false}
            >
              <View className="tags-inner">
                {recipe.tags.cuisines?.map((tag, idx) => (
                  <Text key={`c-${idx}`} className="tag tag-cuisine">
                    {tag}
                  </Text>
                ))}
                {recipe.tags.flavors?.map((tag, idx) => (
                  <Text key={`f-${idx}`} className="tag tag-flavor">
                    {tag}
                  </Text>
                ))}
                {recipe.tags.scenes?.map((tag, idx) => (
                  <Text key={`s-${idx}`} className="tag tag-scene">
                    {tag}
                  </Text>
                ))}
              </View>
            </ScrollView>
          )}

          {recipe.description && (
            <RichText
              className="recipe-description"
              nodes={recipe.description}
            />
          )}
        </View>

        {/* 食材清单 */}
        <View className="section ingredients-section">
          <View className="section-header">
            <Text className="section-title">📋 食材清单</Text>
            <Text className="section-subtitle">
              {recipe.ingredients.length} 种食材 · {recipe.servings}人份
            </Text>
          </View>
          <View className="ingredients-grid">
            {recipe.ingredients.map((ingredient, index) => {
              // 内容过长时单独占一行
              const isWide =
                ingredient.name.length + ingredient.text_quantity.length > 12 ||
                (ingredient.notes && ingredient.notes.length > 10);
              return (
                <View
                  key={index}
                  className={`ingredient-card ${isWide ? 'wide' : ''}`}
                >
                  <View className="ingredient-header">
                    <Text className="ingredient-name">{ingredient.name}</Text>
                    <Text className="ingredient-quantity">
                      {ingredient.text_quantity}
                    </Text>
                  </View>
                  {ingredient.notes && (
                    <Text className="ingredient-notes">{ingredient.notes}</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* 制作步骤 */}
        <View className="section steps-section">
          <View className="section-header">
            <View className="section-title-row">
              <Text className="section-title">👨‍🍳 制作步骤</Text>
              <Text className="section-subtitle">
                共 {recipe.steps.length} 步
              </Text>
            </View>
            {recipe.additional_notes && recipe.additional_notes.length > 0 && (
              <View className="tips-btn" onClick={() => setShowTips(true)}>
                <Text className="tips-btn-icon">💡</Text>
                <Text className="tips-btn-text">小贴士</Text>
              </View>
            )}
          </View>
          <View className="steps-timeline">
            <AtTimeline items={timelineItems} />
          </View>
        </View>

        {/* 小贴士浮层 */}
        <AtFloatLayout
          isOpened={showTips}
          title="📝 烹饪小贴士"
          onClose={() => setShowTips(false)}
        >
          <View className="tips-float-content">
            {recipe.additional_notes?.map((note, index) => (
              <View key={index} className="tips-float-item">
                <View className="tips-float-number">{index + 1}</View>
                <Text className="tips-float-text">{note}</Text>
              </View>
            ))}
          </View>
        </AtFloatLayout>

        {/* 底部间距 */}
        <View className="bottom-spacer" />
      </ScrollView>

      {/* 收藏按钮 */}
      <View
        className={`favorite-fab ${isFavorite ? 'favorited' : ''} ${favoriteLoading ? 'loading' : ''}`}
        onClick={handleToggleFavorite}
      >
        <Image
          src={isFavorite ? starFilledIcon : starOutlineIcon}
          className="favorite-icon"
        />
      </View>
    </View>
  );
};

export default RecipeDetailPage;
