# RecipeCard 组件

统一的菜品卡片组件，用于在各个页面显示菜谱信息。参考菜谱列表页面的实现进行了增强。

## 特性

- 支持两种布局：网格布局（grid）和列表布局（list）
- 统一的样式设计
- 默认显示分类标签
- 列表布局默认显示难度星级（AtRate）
- 列表布局支持可滚动的所有标签
- 支持右侧插槽（用于添加到菜单等操作）
- 自动处理图片占位符
- 支持自定义点击事件
- 自动格式化菜谱名称（去掉"的做法"）

## Props

```typescript
interface RecipeCardProps {
  recipe: Recipe;               // 菜谱数据
  layout?: 'grid' | 'list';     // 布局方式，默认 'grid'
  rightSlot?: React.ReactNode;  // 右侧插槽内容（仅列表布局）
  onClick?: () => void;         // 自定义点击事件，默认跳转到详情页
}
```

## 使用示例

### 网格布局（用于首页、推荐页）

```tsx
import RecipeCard from '../../components/RecipeCard/index';

<View className="recipe-grid">
  {recipes.map(recipe => (
    <RecipeCard
      key={recipe.id}
      recipe={recipe}
      layout="grid"
    />
  ))}
</View>
```

### 列表布局（用于菜谱列表页）

```tsx
import RecipeCard from '../../components/RecipeCard/index';

<View className="recipe-list">
  {recipes.map(recipe => (
    <RecipeCard
      key={recipe.id}
      recipe={recipe}
      layout="list"
    />
  ))}
</View>
```

### 带右侧操作按钮（菜谱列表页）

```tsx
import RecipeCard from '../../components/RecipeCard/index';

<RecipeCard
  recipe={recipe}
  layout="list"
  rightSlot={
    <View className="stepper">
      <View className="stepper-btn" onClick={handleMinus}>−</View>
      <Text className="stepper-num">{count}</Text>
      <View className="stepper-btn" onClick={handlePlus}>+</View>
    </View>
  }
/>
```

### 自定义点击事件

```tsx
<RecipeCard
  recipe={recipe}
  layout="grid"
  onClick={() => {
    console.log('Custom click handler');
    Taro.navigateTo({
      url: `/pages/recipe/detail?id=${recipe.id}`,
    });
  }}
/>
```

## 样式

组件已包含完整的样式，包括：
- 卡片阴影和圆角
- 响应式图片
- 标签样式（菜系、口味、场景）
- 难度星级显示（列表布局）
- 可滚动标签容器（列表布局）
- 右侧插槽区域（列表布局）
- 悬停和点击效果

## 布局差异

### Grid 布局特点
- 2列网格展示
- 图片高度 240rpx（正方形）
- 显示分类标签
- 显示前2个标签（菜系、口味）
- 显示烹饪时间
- 适合快速浏览

### List 布局特点
- 横向排列
- 图片 160x160rpx
- 显示分类标签
- 显示所有标签（可滚动）
- 显示烹饪时间
- 显示难度星级
- 支持右侧操作区域
- 更详细的元信息展示

## 已应用的页面

- ✅ 首页（`/pages/index/index.tsx`）- 网格布局
- ✅ 推荐页（`/pages/recommend/index.tsx`）- 网格布局
- ⏸️ 菜谱列表页（`/pages/recipe/index.tsx`）- 待集成（保留现有复杂交互）

## 设计规范

- 网格布局：2列，图片高度240rpx，适合展示菜谱概览
- 列表布局：横向排列，图片160x160rpx，适合详细浏览
- 统一的配色方案和间距
- Material Design 风格的交互反馈
- 参考菜谱列表页的样式和交互

## 功能说明（参考菜谱列表页）

1. **分类标签**：默认显示，自动匹配颜色
2. **难度星级**：列表布局自动显示
3. **可滚动标签**：列表布局支持横向滚动查看所有标签（菜系、口味、场景）
4. **右侧插槽**：列表布局支持，用于添加自定义操作（如添加到菜单的步进器）
5. **菜谱名称格式化**：自动去掉"的做法"后缀
6. **标签分类样式**：
   - 菜系（cuisines）- 红色 `#FF6B6B`
   - 口味（flavors）- 青色 `#4ECDC4`
   - 场景（scenes）- 紫色 `#6C5CE7`



