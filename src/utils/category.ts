import Taro from '@tarojs/taro';
import type { Category } from '../services/recipe';

/**
 * 菜谱分类颜色配置
 * 使用英文 key 作为映射键，支持 API 返回的分类标识
 */
export const CATEGORY_COLORS: Record<string, string> = {
  vegetable_dish: '#27ae60', // 青翠绿 - 素菜
  meat_dish: '#e8503a', // 番茄红 - 肉类
  staple: '#d35400', // 南瓜橙 - 主食
  soup: '#f4a261', // 沙滩橙 - 汤类
  aquatic: '#2980b9', // 深海蓝 - 水产
  drink: '#16a085', // 薄荷绿 - 饮品
  breakfast: '#f39c12', // 芥末黄 - 早餐
  condiment: '#8d6e63', // 可可棕 - 调味品
  'semi-finished': '#78909c', // 青灰色 - 半成品
};

/** 默认分类颜色 */
export const DEFAULT_CATEGORY_COLOR = '#e8503a'; // 番茄红

/** 缓存 key */
const CATEGORIES_CACHE_KEY = 'categories_cache';

/**
 * 获取分类对应的颜色
 * @param categoryKey 分类标识符 (如 "meat_dish")
 * @returns 颜色值
 */
export function getCategoryColor(categoryKey: string): string {
  return CATEGORY_COLORS[categoryKey] || DEFAULT_CATEGORY_COLOR;
}

/**
 * 从缓存获取分类列表
 * @returns 分类列表
 */
export function getCategoriesFromCache(): Category[] {
  try {
    const cached = Taro.getStorageSync(CATEGORIES_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

/**
 * 根据分类 key 获取中文名称
 * @param categoryKey 分类标识符 (如 "meat_dish")
 * @returns 中文名称 (如 "肉类")
 */
export function getCategoryLabel(categoryKey: string): string {
  const categories = getCategoriesFromCache();
  const cat = categories.find(c => c.key === categoryKey);
  return cat?.label || categoryKey;
}
