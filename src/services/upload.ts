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
 * @param openid 用户 openid，用于生成固定路径 avatars/{openid}.jpg
 */
export async function uploadAvatar(
  filePath: string,
  openid: string
): Promise<string> {
  try {
    const objectKey = `avatars/${openid}.jpg`;

    // 使用 Taro.uploadFile 上传文件到后端
    // 后端会立即返回 OSS URL，然后异步上传到 OSS（使用 STS 凭证）
    const uploadRes = await Taro.uploadFile({
      url: `${apiConfig.API_BASE_URL}/api/upload/image`,
      filePath: filePath,
      name: 'file',
      formData: {
        'object-key': objectKey,
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
