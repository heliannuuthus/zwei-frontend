import request from './api';
import { RecipeListItem } from './recipe';

// 海报项类型
export interface BannerItem {
  id: string;
  image_url: string;
  title?: string;
  link?: string;
  link_type?: 'recipe' | 'url' | 'none';
}

// 获取首页 Banner
export async function getBanners(): Promise<BannerItem[]> {
  return request<BannerItem[]>('/api/home/banners');
}

// 获取推荐菜谱
export async function getRecommendRecipes(
  limit = 4
): Promise<RecipeListItem[]> {
  return request<RecipeListItem[]>(`/api/home/recommend?limit=${limit}`);
}

// 获取热门菜谱
export async function getHotRecipes(limit = 6): Promise<RecipeListItem[]> {
  return request<RecipeListItem[]>(`/api/home/hot?limit=${limit}`);
}
