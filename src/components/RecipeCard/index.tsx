import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AtRate } from 'taro-ui';
import { getCategoryColor, getCategoryLabel } from '../../utils/category';
import './index.scss';

// 使用正确的 tags 类型（支持两种格式）
interface RecipeTag {
  cuisines?: string[];
  flavors?: string[];
  scenes?: string[];
  [key: string]: string[] | undefined;  // 支持动态 key
}

interface Recipe {
  id: string;
  name: string;
  description?: string;              // 后端是 *string，可能为 null
  image_path?: string;               // 后端是 *string，可能为 null
  category?: string;                 // 必填，但前端标记为可选更安全
  tags?: RecipeTag | Record<string, string[]>;
  total_time_minutes?: number;       // 后端是 *int，可能为 null
  difficulty?: number;               // 必填，但前端标记为可选更安全
}

interface RecipeCardProps {
  recipe: Recipe;
  layout?: 'grid' | 'list';     // 网格布局或列表布局
  rightSlot?: React.ReactNode;  // 右侧插槽（用于添加到菜单等操作）
  onClick?: () => void;
}

// 格式化菜谱名称（去掉"的做法"后缀）
const formatRecipeName = (name: string) => {
  return name.replace(/的做法$/, '');
};

// 安全获取标签数据（兼容两种格式）
const getTags = (tags: RecipeTag | Record<string, string[]> | undefined) => {
  if (!tags) return { cuisines: [], flavors: [], scenes: [] };
  
  // 如果是 Record<string, string[]> 格式，直接返回
  if ('cuisines' in tags || 'flavors' in tags || 'scenes' in tags) {
    return {
      cuisines: tags.cuisines || [],
      flavors: tags.flavors || [],
      scenes: tags.scenes || [],
    };
  }
  
  // 兼容其他可能的格式
  return {
    cuisines: (tags as any).cuisines || [],
    flavors: (tags as any).flavors || [],
    scenes: (tags as any).scenes || [],
  };
};

const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  layout = 'grid',
  rightSlot,
  onClick,
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      Taro.navigateTo({
        url: `/pages/recipe/detail?id=${recipe.id}`,
      });
    }
  };

  // 确保数据完整性
  const safeRecipe = {
    ...recipe,
    category: recipe.category || '',
    difficulty: recipe.difficulty || 1,
    total_time_minutes: recipe.total_time_minutes,
  };

  // 网格布局（用于首页、推荐页）
  if (layout === 'grid') {
    const tags = getTags(safeRecipe.tags);
    const hasTags = tags.cuisines.length > 0 || tags.flavors.length > 0 || tags.scenes.length > 0;
    
    return (
      <View className="recipe-card-grid" onClick={handleClick}>
        <View className="card-image-wrapper">
          {safeRecipe.image_path ? (
            <Image
              src={safeRecipe.image_path}
              className="card-image"
              mode="aspectFill"
              lazyLoad
            />
          ) : (
            <View className="card-placeholder">
              <Text className="placeholder-icon">🍳</Text>
            </View>
          )}
          {/* 分类标签 - 始终显示 */}
          <View
            className="card-category"
            style={{
              backgroundColor: getCategoryColor(safeRecipe.category),
            }}
          >
            {getCategoryLabel(safeRecipe.category)}
          </View>
        </View>
        <View className="card-content">
          <Text className="card-name">{formatRecipeName(safeRecipe.name)}</Text>
          
          {/* 难度和时间 */}
          <View className="card-info-row">
            <View className="card-difficulty">
              <AtRate value={safeRecipe.difficulty} max={5} size={10} />
            </View>
            {safeRecipe.total_time_minutes && (
              <View className="card-time">
                <Text className="time-icon">⏱</Text>
                <Text className="time-text">{safeRecipe.total_time_minutes}分钟</Text>
              </View>
            )}
          </View>

          {/* 标签 - 可滚动显示所有 */}
          {hasTags && (
            <ScrollView
              className="card-tags-scroll"
              scrollX
              enhanced
              showScrollbar={false}
            >
              <View className="tags-inner">
                {tags.cuisines.map((tag, idx) => (
                  <Text key={`c-${idx}`} className="card-tag cuisine">
                    {tag}
                  </Text>
                ))}
                {tags.flavors.map((tag, idx) => (
                  <Text key={`f-${idx}`} className="card-tag flavor">
                    {tag}
                  </Text>
                ))}
                {tags.scenes.map((tag, idx) => (
                  <Text key={`s-${idx}`} className="card-tag scene">
                    {tag}
                  </Text>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    );
  }

  // 列表布局（用于菜谱列表页）
  const tags = getTags(safeRecipe.tags);
  
  return (
    <View className="recipe-card-list">
      <View className="card-clickable" onClick={handleClick}>
        <View className="card-image-wrapper">
          {safeRecipe.image_path ? (
            <Image
              src={safeRecipe.image_path}
              className="card-image"
              mode="aspectFill"
              lazyLoad
            />
          ) : (
            <View className="card-placeholder">
              <Text className="placeholder-icon">🍳</Text>
              <Text className="placeholder-text">暂无图片</Text>
            </View>
          )}
          {/* 分类标签 - 始终显示 */}
          <View
            className="card-category"
            style={{
              backgroundColor: getCategoryColor(safeRecipe.category),
            }}
          >
            {getCategoryLabel(safeRecipe.category)}
          </View>
        </View>
        <View className="card-content">
          <Text className="card-name">{formatRecipeName(safeRecipe.name)}</Text>
          
          {/* 时间 - 有值才显示 */}
          {safeRecipe.total_time_minutes && (
            <View className="card-meta-item">
              <Text className="meta-label">时间：</Text>
              <Text className="meta-text">{safeRecipe.total_time_minutes}分钟</Text>
            </View>
          )}

          {/* 难度 - 始终显示 */}
          <View className="card-meta-item">
            <Text className="meta-label">难度：</Text>
            <AtRate value={safeRecipe.difficulty} max={5} size={8} />
          </View>

          {/* 标签 - 可滚动显示所有 */}
          {(tags.cuisines.length > 0 || tags.flavors.length > 0 || tags.scenes.length > 0) && (
            <ScrollView
              className="card-tags-scroll"
              scrollX
              enhanced
              showScrollbar={false}
            >
              <View className="tags-inner">
                {tags.cuisines.map((tag, idx) => (
                  <Text key={`c-${idx}`} className="card-tag cuisine">
                    {tag}
                  </Text>
                ))}
                {tags.flavors.map((tag, idx) => (
                  <Text key={`f-${idx}`} className="card-tag flavor">
                    {tag}
                  </Text>
                ))}
                {tags.scenes.map((tag, idx) => (
                  <Text key={`s-${idx}`} className="card-tag scene">
                    {tag}
                  </Text>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
      
      {/* 右侧操作区域 */}
      {rightSlot && (
        <View className="card-right-slot">
          {rightSlot}
        </View>
      )}
    </View>
  );
};

export default RecipeCard;