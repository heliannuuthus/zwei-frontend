import request from './api';
import { RecipeListItem } from './recipe';

// 浏览历史响应
export interface HistoryResponse {
  recipe_id: string;
  viewed_at: string;
}

// 浏览历史列表项
export interface HistoryListItem {
  recipe_id: string;
  viewed_at: string;
  recipe?: RecipeListItem;
}

// 浏览历史列表响应
export interface HistoryListResponse {
  items: HistoryListItem[];
  total: number;
}

// 添加浏览记录
export async function addViewHistory(
  recipeId: string
): Promise<HistoryResponse> {
  return request<HistoryResponse>('/api/history', {
    method: 'POST',
    body: JSON.stringify({ recipe_id: recipeId }),
  });
}

// 删除浏览记录
export async function removeViewHistory(recipeId: string): Promise<void> {
  await request<void>(`/api/history/${recipeId}`, {
    method: 'DELETE',
  });
}

// 清空浏览历史
export async function clearViewHistory(): Promise<void> {
  await request<void>('/api/history', {
    method: 'DELETE',
  });
}

// 获取浏览历史列表
export async function getViewHistory(params?: {
  limit?: number;
  offset?: number;
}): Promise<HistoryListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/history${queryString ? `?${queryString}` : ''}`;

  return request<HistoryListResponse>(url);
}
