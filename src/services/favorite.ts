import request from './api';
import { RecipeListItem } from './recipe';

// 收藏响应
export interface FavoriteResponse {
  id: string;
  recipe_id: string;
  created_at: string;
}

// 收藏列表项
export interface FavoriteListItem {
  id: string;
  recipe_id: string;
  created_at: string;
  recipe?: RecipeListItem;
}

// 收藏列表响应
export interface FavoriteListResponse {
  items: FavoriteListItem[];
  total: number;
}

// 检查收藏状态响应
export interface CheckFavoriteResponse {
  is_favorite: boolean;
}

// 批量检查响应
export interface BatchCheckResponse {
  favorited_ids: string[];
}

// 添加收藏
export async function addFavorite(recipeId: string): Promise<FavoriteResponse> {
  return request<FavoriteResponse>('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ recipe_id: recipeId }),
  });
}

// 取消收藏
export async function removeFavorite(recipeId: string): Promise<void> {
  await request<void>(`/api/favorites/${recipeId}`, {
    method: 'DELETE',
  });
}

// 检查是否已收藏
export async function checkFavorite(recipeId: string): Promise<boolean> {
  const res = await request<CheckFavoriteResponse>(
    `/api/favorites/${recipeId}/check`
  );
  return res.is_favorite;
}

// 获取收藏列表
export async function getFavorites(params?: {
  limit?: number;
  offset?: number;
}): Promise<FavoriteListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/favorites${queryString ? `?${queryString}` : ''}`;

  return request<FavoriteListResponse>(url);
}

// 批量检查收藏状态
export async function batchCheckFavorites(
  recipeIds: string[]
): Promise<string[]> {
  const res = await request<BatchCheckResponse>('/api/favorites/batch-check', {
    method: 'POST',
    body: JSON.stringify({ recipe_ids: recipeIds }),
  });
  return res.favorited_ids;
}

// 切换收藏状态
export async function toggleFavorite(
  recipeId: string,
  currentStatus: boolean
): Promise<boolean> {
  if (currentStatus) {
    await removeFavorite(recipeId);
    return false;
  } else {
    await addFavorite(recipeId);
    return true;
  }
}
