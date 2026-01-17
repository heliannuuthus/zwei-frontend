/**
 * 图片上传服务
 */
import Taro from '@tarojs/taro';
import apiConfig from '../config/api.config';

export interface UploadImageResponse {
  url: string;
}

/**
 * 上传头像（使用固定的路径格式，支持覆盖）
 * @param filePath 本地文件路径（微信小程序 chooseAvatar 返回的路径）
 *
 * 注意：不再需要传入 openid，后端会从认证 token 中获取，确保安全性
 */
export async function uploadAvatar(filePath: string): Promise<string> {
  try {
    // 使用 prefix 告诉后端这是头像上传，后端会自动使用认证用户的 openid 生成路径
    // 这样可以防止前端传入错误的 openid 导致安全风险
    const uploadRes = await Taro.uploadFile({
      url: `${apiConfig.API_BASE_URL}/api/upload/image`,
      filePath: filePath,
      name: 'file',
      formData: {
        prefix: 'avatars', // 告诉后端这是头像上传
      },
      header: {
        Authorization: `Bearer ${Taro.getStorageSync('access_token')}`,
      },
    });

    if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
      const data = JSON.parse(uploadRes.data) as UploadImageResponse;
      return data.url;
    }

    throw new Error(`上传失败: ${uploadRes.statusCode}`);
  } catch (error: any) {
    console.error('[Upload] 上传头像失败:', error);
    throw new Error(error?.message || '上传失败');
  }
}
