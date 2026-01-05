/**
 * AI 推荐全局缓存
 * 用于在页面切换时保持请求连接，切回来时恢复结果
 */
import Taro from '@tarojs/taro';
import {
  getRecommendations,
  RecommendResponse,
  LocationInfo,
} from './recommend';

// 缓存状态
interface CacheState {
  loading: boolean;
  result: RecommendResponse | null;
  error: string | null;
  locationKey: string | null; // 位置标识，用于判断缓存是否有效
  promise: Promise<RecommendResponse> | null;
  timestamp: number; // 缓存时间戳
}

// 缓存过期时间：10 分钟
const CACHE_TTL = 10 * 60 * 1000;

// 事件名称
export const AI_RECOMMEND_EVENTS = {
  START: 'ai_recommend_start',
  SUCCESS: 'ai_recommend_success',
  ERROR: 'ai_recommend_error',
};

// 全局缓存状态
let cacheState: CacheState = {
  loading: false,
  result: null,
  error: null,
  locationKey: null,
  promise: null,
  timestamp: 0,
};

// 生成位置 key
function getLocationKey(location: LocationInfo): string {
  return `${location.latitude.toFixed(2)}_${location.longitude.toFixed(2)}`;
}

// 检查缓存是否有效
function isCacheValid(location: LocationInfo): boolean {
  if (!cacheState.result) return false;
  if (!cacheState.locationKey) return false;
  if (cacheState.locationKey !== getLocationKey(location)) return false;
  if (Date.now() - cacheState.timestamp > CACHE_TTL) return false;
  return true;
}

/**
 * 获取当前缓存状态
 */
export function getCacheState(): {
  loading: boolean;
  result: RecommendResponse | null;
  error: string | null;
} {
  return {
    loading: cacheState.loading,
    result: cacheState.result,
    error: cacheState.error,
  };
}

/**
 * 检查是否有进行中的请求
 */
export function isRequestPending(): boolean {
  return cacheState.loading && cacheState.promise !== null;
}

/**
 * 获取缓存的推荐结果（如果有效）
 */
export function getCachedResult(
  location: LocationInfo
): RecommendResponse | null {
  if (isCacheValid(location)) {
    return cacheState.result;
  }
  return null;
}

/**
 * 发起 AI 推荐请求（带缓存）
 * 如果已有进行中的请求，返回该 Promise
 * 如果有有效缓存，直接返回缓存结果
 * @param excludeIds 排除的菜谱 ID（换一批时传入）
 */
export async function fetchAiRecommendations(
  location: LocationInfo,
  limit: number = 6,
  excludeIds?: string[]
): Promise<RecommendResponse> {
  // 如果没有 excludeIds，检查缓存
  if (!excludeIds || excludeIds.length === 0) {
    if (isCacheValid(location)) {
      return cacheState.result!;
    }

    // 如果有进行中的请求且位置相同，返回该 Promise
    if (
      cacheState.loading &&
      cacheState.promise &&
      cacheState.locationKey === getLocationKey(location)
    ) {
      return cacheState.promise;
    }
  }

  // 重置状态并发起新请求
  cacheState = {
    loading: true,
    result: null,
    error: null,
    locationKey: getLocationKey(location),
    promise: null,
    timestamp: Date.now(),
  };

  // 发送开始事件
  Taro.eventCenter.trigger(AI_RECOMMEND_EVENTS.START);

  // 创建请求 Promise
  const promise = getRecommendations(location, limit, excludeIds)
    .then(result => {
      cacheState.loading = false;
      cacheState.result = result;
      cacheState.error = null;
      cacheState.timestamp = Date.now();

      // 发送成功事件
      Taro.eventCenter.trigger(AI_RECOMMEND_EVENTS.SUCCESS, result);

      return result;
    })
    .catch(err => {
      cacheState.loading = false;
      cacheState.error = err.message || '推荐生成失败';
      cacheState.promise = null;

      // 发送错误事件
      Taro.eventCenter.trigger(AI_RECOMMEND_EVENTS.ERROR, cacheState.error);

      throw err;
    });

  cacheState.promise = promise;
  return promise;
}

/**
 * 清除缓存
 */
export function clearCache(): void {
  cacheState = {
    loading: false,
    result: null,
    error: null,
    locationKey: null,
    promise: null,
    timestamp: 0,
  };
}

/**
 * 订阅推荐事件
 */
export function subscribeEvents(handlers: {
  onStart?: () => void;
  onSuccess?: (result: RecommendResponse) => void;
  onError?: (error: string) => void;
}): () => void {
  const { onStart, onSuccess, onError } = handlers;

  if (onStart) {
    Taro.eventCenter.on(AI_RECOMMEND_EVENTS.START, onStart);
  }
  if (onSuccess) {
    Taro.eventCenter.on(AI_RECOMMEND_EVENTS.SUCCESS, onSuccess);
  }
  if (onError) {
    Taro.eventCenter.on(AI_RECOMMEND_EVENTS.ERROR, onError);
  }

  // 返回取消订阅函数
  return () => {
    if (onStart) {
      Taro.eventCenter.off(AI_RECOMMEND_EVENTS.START, onStart);
    }
    if (onSuccess) {
      Taro.eventCenter.off(AI_RECOMMEND_EVENTS.SUCCESS, onSuccess);
    }
    if (onError) {
      Taro.eventCenter.off(AI_RECOMMEND_EVENTS.ERROR, onError);
    }
  };
}
