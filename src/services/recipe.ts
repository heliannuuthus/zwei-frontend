import request from './api';

// 标签分组
export interface TagsGrouped {
  cuisines: string[];
  flavors: string[];
  scenes: string[];
}

// 菜谱类型定义
export interface RecipeListItem {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: number;
  tags: TagsGrouped;
  image_path?: string;
  total_time_minutes?: number;
}

export interface RecipeIngredient {
  name: string;
  quantity?: number;
  unit?: string;
  text_quantity: string;
  notes?: string;
}

export interface RecipeStep {
  step: number;
  description: string;
}

export interface RecipeDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: number;
  tags: TagsGrouped;
  servings: number;
  image_path?: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes?: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  additional_notes: string[];
}

// 获取菜谱列表
export async function getRecipes(params?: {
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<RecipeListItem[]> {
  const queryParams = new URLSearchParams();
  if (params?.category) queryParams.append('category', params.category);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/recipes${queryString ? `?${queryString}` : ''}`;

  return request<RecipeListItem[]>(url);
}

// 分类响应类型
export interface Category {
  key: string; // 分类标识符，如 "meat_dish"
  label: string; // 中文名称，如 "肉类"
}

// 获取所有分类（含中文名称和数量）
export async function getCategories(): Promise<Category[]> {
  return request<Category[]>('/api/recipes/categories/list');
}

// 获取菜谱详情
export async function getRecipeDetail(recipeId: string): Promise<RecipeDetail> {
  return request<RecipeDetail>(`/api/recipes/${recipeId}`);
}
