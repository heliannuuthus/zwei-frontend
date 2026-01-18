/**
 * 用户服务
 *
 * Token 机制：
 * - access_token: 2小时有效，用于 API 认证
 * - refresh_token: 7天有效，用于刷新 access_token
 */
import Taro from '@tarojs/taro';
import request from './api';
import apiConfig from '../config/api.config';

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

// 用户信息类型（匹配后端 /api/user/profile 返回）
export interface UserInfo {
  openid: string; // 系统生成的唯一标识（对外 ID）
  nickname?: string;
  avatar?: string;
  phone?: string; // 脱敏后的手机号，如 138****8000
  gender?: 0 | 1 | 2; // 性别 0未知 1男 2女
}

// Token 请求参数
interface TokenRequestParams {
  grant_type: 'authorization_code' | 'refresh_token';
  code?: string; // grant_type=authorization_code 时使用
  refresh_token?: string; // grant_type=refresh_token 时使用
  idp?: string; // 身份提供方：wechat:mp, tt:mp, alipay:mp
  nickname?: string; // 用户昵称（可选）
  avatar?: string; // 用户头像 URL（可选）
}

/**
 * 请求 token 端点（OAuth2.1 风格，form-urlencoded）
 */
async function requestToken(
  params: TokenRequestParams
): Promise<TokenResponse> {
  const formData = new URLSearchParams();
  formData.append('grant_type', params.grant_type);
  if (params.code) formData.append('code', params.code);
  if (params.refresh_token)
    formData.append('refresh_token', params.refresh_token);
  if (params.nickname) formData.append('nickname', params.nickname);
  if (params.avatar) formData.append('avatar', params.avatar);

  const response = await Taro.request({
    url: `${apiConfig.API_BASE_URL}/api/token`,
    method: 'POST',
    header: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: formData.toString(),
    timeout: apiConfig.API_TIMEOUT,
  });

  if (response.statusCode >= 200 && response.statusCode < 300) {
    return response.data as TokenResponse;
  }

  // OAuth2 错误格式
  const error = response.data as { error?: string; error_description?: string };
  throw new Error(error.error_description || error.error || '请求失败');
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
 * 刷新 token（OAuth2.1 风格，form-urlencoded）
 */
export async function refreshToken(): Promise<TokenResponse | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  try {
    const response = await requestToken({
      grant_type: 'refresh_token',
      refresh_token: refresh,
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
 * 获取当前平台对应的 idp
 */
export function getCurrentPlatformIdP(): string {
  // Taro.getEnv() 返回 'WEAPP' | 'SWAN' | 'ALIPAY' | 'TT' | 'QQ' | 'JD' | 'H5' | 'RN'
  const env = Taro.getEnv();

  // 添加调试日志
  console.log('[Auth] 当前环境:', env);

  let idp: string;
  switch (env) {
    case Taro.ENV_TYPE.WEAPP:
      idp = 'wechat:mp';
      break;
    case Taro.ENV_TYPE.TT:
      idp = 'tt:mp';
      break;
    case Taro.ENV_TYPE.ALIPAY:
      idp = 'alipay:mp';
      break;
    default:
      // 默认使用微信（兼容旧代码或未知环境）
      console.warn('[Auth] 未知环境，默认使用微信 idp:', env);
      idp = 'wechat:mp';
  }

  console.log('[Auth] 检测到的 idp:', idp);
  return idp;
}

/**
 * 获取用户信息（抖音小程序）
 * 抖音小程序需要使用 getUserProfile API 获取用户头像和昵称
 */
export async function getUserProfileForTT(): Promise<{
  nickname: string;
  avatar: string;
  gender?: 0 | 1 | 2;
} | null> {
  try {
    if (!Taro.canIUse('getUserProfile')) {
      console.log('[Auth] 当前环境不支持 getUserProfile');
      return null;
    }

    const env = Taro.getEnv();
    if (env !== Taro.ENV_TYPE.TT) {
      return null;
    }

    const res = await new Promise<any>((resolve, reject) => {
      // @ts-ignore
      Taro.getUserProfile({
        desc: '用于完善用户资料',
        success: resolve,
        fail: reject,
      });
    });

    if (res && res.userInfo) {
      // 抖音小程序的 gender: 0-未知, 1-男, 2-女
      const gender =
        res.userInfo.gender !== undefined
          ? (res.userInfo.gender as 0 | 1 | 2)
          : undefined;

      return {
        nickname: res.userInfo.nickName || '',
        avatar: res.userInfo.avatarUrl || '',
        gender,
      };
    }

    return null;
  } catch (error) {
    console.log('[Auth] 获取用户信息失败（用户可能拒绝授权）:', error);
    return null;
  }
}

/**
 * 获取用户信息（支付宝小程序）
 * 支付宝小程序使用 getOpenUserInfo API 获取用户头像和昵称
 */
export async function getUserProfileForAlipay(): Promise<{
  nickname: string;
  avatar: string;
  gender?: 0 | 1 | 2;
} | null> {
  try {
    const env = Taro.getEnv();
    if (env !== Taro.ENV_TYPE.ALIPAY) {
      return null;
    }

    const res = await new Promise<any>((resolve, reject) => {
      // @ts-ignore
      Taro.getOpenUserInfo({
        success: resolve,
        fail: reject,
      });
    });

    if (res && res.response) {
      try {
        const parsed = JSON.parse(res.response);
        const userInfo = parsed.response || parsed;

        // 支付宝小程序的 gender: "m"-男, "f"-女
        let gender: 0 | 1 | 2 | undefined = undefined;
        if (userInfo.gender === 'm') {
          gender = 1;
        } else if (userInfo.gender === 'f') {
          gender = 2;
        }

        return {
          nickname: userInfo.nickName || '',
          avatar: userInfo.avatar || '',
          gender,
        };
      } catch (parseErr) {
        console.error('[Auth] 解析支付宝用户信息失败:', parseErr);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.log('[Auth] 获取用户信息失败（用户可能拒绝授权）:', error);
    return null;
  }
}

/**
 * 登录（自动检测平台）
 * 使用 OAuth2.1 风格的 /token 端点
 * code 格式：idp:actual_code，如 wechat:mp:xxx, tt:mp:xxx, alipay:mp:xxx
 */
export async function wxLogin(): Promise<TokenResponse> {
  // 获取 login code
  const loginRes = await Taro.login();
  if (!loginRes.code) {
    throw new Error('获取登录凭证失败');
  }

  // 自动检测平台并组合 code
  const idp = getCurrentPlatformIdP();
  const combinedCode = `${idp}:${loginRes.code}`;

  console.log(
    '[Auth] 登录请求 - IDP:',
    idp,
    'Code 长度:',
    loginRes.code.length
  );

  // 不再在登录时获取用户信息，改为在设置页面主动获取
  const response = await requestToken({
    grant_type: 'authorization_code',
    code: combinedCode,
  });

  // 保存 tokens
  saveTokens(response);

  console.log('[Auth] 登录成功');

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

/**
 * 获取用户 profile（带 token 校验和刷新）
 * 进入"我的"页面时调用，有 token 才请求，没有就跳过
 */
export async function fetchProfile(): Promise<UserInfo | null> {
  // 没有 token 直接返回
  const token = getAccessToken();
  if (!token) {
    return null;
  }

  // 检查 token 是否过期，过期则刷新
  if (isTokenExpiringSoon()) {
    const refreshed = await refreshToken();
    if (!refreshed) {
      // 刷新失败，返回 null
      return null;
    }
  }

  // 请求 profile 接口
  try {
    const profile = await request<UserInfo>('/api/user/profile');
    saveUserInfo(profile);
    return profile;
  } catch (error) {
    console.error('[User] 获取 profile 失败:', error);
    return null;
  }
}

/**
 * 更新用户 profile
 */
export async function updateProfile(data: {
  nickname?: string;
  avatar?: string;
  gender?: 0 | 1 | 2;
}): Promise<UserInfo | null> {
  // 没有 token 直接返回
  const token = getAccessToken();
  if (!token) {
    return null;
  }

  // 检查 token 是否过期，过期则刷新
  if (isTokenExpiringSoon()) {
    const refreshed = await refreshToken();
    if (!refreshed) {
      return null;
    }
  }

  try {
    const profile = await request<UserInfo>('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    saveUserInfo(profile);
    return profile;
  } catch (error) {
    console.error('[User] 更新 profile 失败:', error);
    throw error;
  }
}

/**
 * 更新平台相关用户信息（根据不同的 idp 做不同的数据处理）
 * @param idp 身份提供方：wechat:mp, tt:mp, alipay:mp
 * @param phoneCode 小程序授权码（手机号）；传空字符串表示解绑
 */
export async function updateIdpProfile(
  idp: string,
  phoneCode: string
): Promise<UserInfo | null> {
  // 没有 token 直接返回
  const token = getAccessToken();
  if (!token) {
    return null;
  }

  // 检查 token 是否过期，过期则刷新
  if (isTokenExpiringSoon()) {
    const refreshed = await refreshToken();
    if (!refreshed) {
      return null;
    }
  }

  try {
    const profile = await request<UserInfo>(`/api/${idp}/profile`, {
      method: 'POST',
      body: JSON.stringify({ phone_code: phoneCode }),
    });
    saveUserInfo(profile);
    return profile;
  } catch (error) {
    console.error('[User] 绑定手机号失败:', error);
    throw error;
  }
}

/**
 * 统计数据响应类型
 */
export interface StatsResponse {
  favorites: number; // 收藏数
  history: number; // 浏览历史数
}

/**
 * 获取用户统计数据（收藏数、浏览历史数）
 */
export async function fetchStats(): Promise<StatsResponse | null> {
  // 没有 token 直接返回
  const token = getAccessToken();
  if (!token) {
    return null;
  }

  // 检查 token 是否过期，过期则刷新
  if (isTokenExpiringSoon()) {
    const refreshed = await refreshToken();
    if (!refreshed) {
      return null;
    }
  }

  try {
    const stats = await request<StatsResponse>('/api/stats');
    return stats;
  } catch (error) {
    console.error('[User] 获取统计数据失败:', error);
    return null;
  }
}
