/**
 * 用户服务
 * 
 * Token 机制：
 * - access_token: 2小时有效，用于 API 认证
 * - refresh_token: 7天有效，用于刷新 access_token
 */
import Taro from '@tarojs/taro';
import request from './api';

// 存储 key
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRES_AT_KEY = 'token_expires_at';
const USER_INFO_KEY = 'user_info';

// Token 响应类型
interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// 用户信息类型
export interface UserInfo {
  userid: string;      // wx-xxxxx
  mobile?: string;     // 手机号
  nickname?: string;
  picture?: string;
}

/**
 * 获取 access token
 */
export function getAccessToken(): string | null {
  try {
    return Taro.getStorageSync(ACCESS_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * 获取 refresh token
 */
export function getRefreshToken(): string | null {
  try {
    return Taro.getStorageSync(REFRESH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * 保存 token
 */
export function saveTokens(tokens: TokenResponse): void {
  Taro.setStorageSync(ACCESS_TOKEN_KEY, tokens.access_token);
  Taro.setStorageSync(REFRESH_TOKEN_KEY, tokens.refresh_token);
  // 保存过期时间（提前 5 分钟）
  const expiresAt = Date.now() + (tokens.expires_in - 300) * 1000;
  Taro.setStorageSync(TOKEN_EXPIRES_AT_KEY, expiresAt);
}

/**
 * 清除所有凭证和用户信息
 */
export function clearAll(): void {
  Taro.removeStorageSync(ACCESS_TOKEN_KEY);
  Taro.removeStorageSync(REFRESH_TOKEN_KEY);
  Taro.removeStorageSync(TOKEN_EXPIRES_AT_KEY);
  Taro.removeStorageSync(USER_INFO_KEY);
}

/**
 * 获取缓存的用户信息
 */
export function getUserInfo(): UserInfo | null {
  try {
    const info = Taro.getStorageSync(USER_INFO_KEY);
    return info || null;
  } catch {
    return null;
  }
}

/**
 * 保存用户信息到缓存
 */
export function saveUserInfo(info: UserInfo): void {
  Taro.setStorageSync(USER_INFO_KEY, info);
}

/**
 * 检查 token 是否需要刷新（过期前 5 分钟）
 */
export function isTokenExpiringSoon(): boolean {
  try {
    const expiresAt = Taro.getStorageSync(TOKEN_EXPIRES_AT_KEY);
    if (!expiresAt) return true;
    return Date.now() >= expiresAt;
  } catch {
    return true;
  }
}

/**
 * 刷新 token
 */
export async function refreshToken(): Promise<TokenResponse | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  try {
    const response = await request<TokenResponse>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refresh }),
    });

    saveTokens(response);
    return response;
  } catch (error) {
    console.error('[User] Token 刷新失败:', error);
    // 刷新失败，清除所有凭证
    clearAll();
    return null;
  }
}

/**
 * 确保 token 有效（自动刷新）
 */
export async function ensureValidToken(): Promise<string | null> {
  const token = getAccessToken();
  if (!token) return null;

  // 如果 token 快过期，尝试刷新
  if (isTokenExpiringSoon()) {
    const result = await refreshToken();
    return result?.access_token || null;
  }

  return token;
}

/**
 * 微信登录（需要手机号授权）
 * 
 * @param phoneCode wx.getPhoneNumber() 返回的 code
 */
export async function wxLogin(phoneCode: string): Promise<TokenResponse> {
  // 获取 login code
  const loginRes = await Taro.login();
  if (!loginRes.code) {
    throw new Error('获取登录凭证失败');
  }

  const response = await request<TokenResponse>('/api/auth/wx-login', {
    method: 'POST',
    body: JSON.stringify({
      login_code: loginRes.code,
      phone_code: phoneCode,
    }),
  });

  // 保存 tokens
  saveTokens(response);

  return response;
}

/**
 * 退出登录
 */
export function logout(): void {
  clearAll();
}

/**
 * 检查是否已登录
 */
export function isLoggedIn(): boolean {
  return !!getAccessToken();
}
