import Taro from '@tarojs/taro';
import type { Category } from '../services/recipe';

/**
 * 菜谱分类颜色配置
 * 使用英文 key 作为映射键，支持 API 返回的分类标识
 */
export const CATEGORY_COLORS: Record<string, string> = {
  vegetable_dish: '#2ecc71', // 翡翠绿 - 素菜
  meat_dish: '#e74c3c', // 石榴红 - 肉类
  staple: '#d35400', // 南瓜橙 - 主食
  soup: '#e67e22', // 胡萝卜橙 - 汤类
  aquatic: '#3498db', // 海洋蓝 - 水产
  drink: '#00bcd4', // 青碧色 - 饮品
  breakfast: '#ff9800', // 日出橙 - 早餐
  condiment: '#795548', // 咖啡棕 - 调味品
  'semi-finished': '#607d8b', // 青灰色 - 半成品
};

/** 默认分类颜色 */
export const DEFAULT_CATEGORY_COLOR = '#9b59b6'; // 紫色

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
