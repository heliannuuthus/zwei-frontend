import request from './api';

// 选项项
export interface OptionItem {
  value: string; // 标签值
  label: string; // 显示名称
}

// 带选中状态的选项项
export interface OptionItemWithSelected extends OptionItem {
  selected: boolean; // 是否已选择
}

// 偏好选项响应
export interface OptionsResponse {
  flavors: OptionItem[]; // 口味选项
  taboos: OptionItem[]; // 忌口选项
  allergies: OptionItem[]; // 过敏选项
}

// 用户偏好响应（包含选中状态）
export interface UserPreferencesResponse {
  flavors: OptionItemWithSelected[]; // 口味偏好
  taboos: OptionItemWithSelected[]; // 忌口偏好
  allergies: OptionItemWithSelected[]; // 过敏偏好
}

// 更新偏好请求
export interface UpdatePreferencesRequest {
  flavors: string[]; // 口味选项值列表
  taboos: string[]; // 忌口选项值列表
  allergies: string[]; // 过敏选项值列表
}

// 获取所有偏好选项（无需登录）
export async function getOptions(): Promise<OptionsResponse> {
  return request<OptionsResponse>('/api/preferences');
}

// 获取用户偏好（需登录）
export async function getUserPreferences(): Promise<UserPreferencesResponse> {
  return request<UserPreferencesResponse>('/api/user/preference');
}

// 更新用户偏好（需登录）
export async function updateUserPreferences(
  preferences: UpdatePreferencesRequest
): Promise<void> {
  await request<void>('/api/user/preference', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
}
