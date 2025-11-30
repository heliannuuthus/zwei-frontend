import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Image, RichText } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AtMessage, AtLoadMore, AtTag } from 'taro-ui';
import { getRecipeDetail, RecipeDetail } from '../../services/recipe';
// 组件样式通过 babel-plugin-import 自动按需导入
import './detail.scss';

const RecipeDetailPage = () => {
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 获取难度配置
  const getDifficultyConfig = useCallback((difficulty: number) => {
    const configs = [
      { text: '简单', color: '#52c41a' },
      { text: '中等', color: '#faad14' },
      { text: '困难', color: '#ff4d4f' },
    ];
    return configs[difficulty - 1] || null;
  }, []);

  // 加载菜谱详情
  const loadRecipeDetail = useCallback(async (recipeId: string) => {
    setLoading(true);
    try {
      const recipeData = await getRecipeDetail(recipeId);
      setRecipe(recipeData);
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
    return (
      <View className="recipe-detail-page">
        <AtLoadMore status="loading" />
      </View>
    );
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
        {/* 菜谱图片 */}
        {recipe.image_path && (
          <Image
            src={recipe.image_path}
            className="recipe-header-image"
            mode="aspectFill"
          />
        )}

        {/* 基本信息 */}
        <View className="recipe-header">
          <Text className="recipe-title">{recipe.name}</Text>
          
          {recipe.description && (
            <RichText
              className="recipe-description"
              nodes={recipe.description}
            />
          )}

          {/* 基本信息标签 */}
          <View className="info-tags">
            {getDifficultyConfig(recipe.difficulty) && (
              <AtTag
                size="small"
                circle
                customStyle={{
                  backgroundColor: getDifficultyConfig(recipe.difficulty)!.color,
                  color: '#fff',
                  borderColor: getDifficultyConfig(recipe.difficulty)!.color,
                }}
              >
                {getDifficultyConfig(recipe.difficulty)!.text}
              </AtTag>
            )}
            <AtTag size="small" circle>
              {recipe.servings}人份
            </AtTag>
          </View>

          {/* 标签 */}
          {recipe.tags.length > 0 && (
            <View className="recipe-tags">
              {recipe.tags.map((tag, index) => (
                <Text key={index} className="tag">
                  {tag}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* 食材清单 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">📋 食材清单</Text>
            <Text className="section-subtitle">{recipe.servings}人份</Text>
          </View>
          <View className="ingredients-list">
            {recipe.ingredients.map((ingredient, index) => (
              <View key={index} className="ingredient-item">
                <Text className="ingredient-name">{ingredient.name}</Text>
                <Text className="ingredient-quantity">
                  {ingredient.text_quantity}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 制作步骤 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">👨‍🍳 制作步骤</Text>
          </View>
          <View className="steps-list">
            {recipe.steps.map(step => (
              <View key={step.step} className="step-item">
                <View className="step-number">{step.step}</View>
                <Text className="step-description">{step.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 底部间距 */}
        <View className="bottom-spacer" />
      </ScrollView>
    </View>
  );
};

export default RecipeDetailPage;
