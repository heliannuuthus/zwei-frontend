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

// 首页配置响应
export interface HomeConfigResponse {
  banners: BannerItem[];
  recommend_recipes: RecipeListItem[];
  hot_recipes: RecipeListItem[];
}

// 获取首页配置
export async function getHomeConfig(): Promise<HomeConfigResponse> {
  return request<HomeConfigResponse>('/api/home/config');
}

