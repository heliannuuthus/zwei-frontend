import { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { ButtonProps, InputProps } from '@tarojs/components';
import { AtIcon } from 'taro-ui';
import {
  fetchProfile,
  updateProfile,
  updateIdpProfile,
  getUserProfileForTT,
  UserInfo,
  isLoggedIn,
  getCurrentPlatformIdP,
} from '../../services/user';
import { uploadAvatar } from '../../services/upload';
import './settings.scss';

// 性别选项
const GENDER_OPTIONS = [
  { value: 0, label: '保密' },
  { value: 1, label: '男' },
  { value: 2, label: '女' },
];

const Settings = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [genderPickerVisible, setGenderPickerVisible] = useState(false);

  // 加载用户信息
  const loadUserInfo = useCallback(async () => {
    if (!isLoggedIn()) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      Taro.navigateBack();
      return;
    }

    setLoading(true);
    try {
      const profile = await fetchProfile();
      if (profile) {
        setUserInfo(profile);
      } else {
        Taro.showToast({ title: '获取用户信息失败', icon: 'none' });
        Taro.navigateBack();
      }
    } catch (err) {
      console.error('获取用户信息失败:', err);
      Taro.showToast({ title: '获取用户信息失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserInfo();
  }, [loadUserInfo]);

  // 处理选择头像（微信/支付宝小程序）
  // 支付宝小程序从基础库 2.9.29 开始也支持 chooseAvatar
  const handleChooseAvatar: ButtonProps['onChooseAvatar'] = useCallback(
    async e => {
      const avatarUrl = e.detail.avatarUrl;
      if (!avatarUrl) return;

      // 检查是否已登录（上传需要 token）
      if (!userInfo?.openid) {
        Taro.showToast({ title: '请先登录', icon: 'none' });
        return;
      }

      try {
        Taro.showLoading({ title: '上传中...' });

        // 使用 Taro.uploadFile 上传文件到后端
        // 后端会从认证 token 中获取 openid，自动生成正确的路径，确保安全性
        const ossUrl = await uploadAvatar(avatarUrl);

        // 更新用户信息
        const profile = await updateProfile({ avatar: ossUrl });
        if (profile) {
          setUserInfo(profile);
        }

        Taro.hideLoading();
        Taro.showToast({ title: '头像上传成功', icon: 'success' });
      } catch (err) {
        Taro.hideLoading();
        console.error('修改头像失败:', err);
        const errorMsg = err instanceof Error ? err.message : '修改失败';
        Taro.showToast({ title: errorMsg, icon: 'none' });
      }
    },
    [userInfo?.openid]
  );

  // 处理获取用户信息（抖音小程序）
  const handleGetUserProfile = useCallback(async () => {
    if (!isLoggedIn()) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    try {
      Taro.showLoading({ title: '获取中...' });

      const env = Taro.getEnv();
      let profileData: {
        nickname: string;
        avatar: string;
        gender?: 0 | 1 | 2;
      } | null = null;

      if (env === Taro.ENV_TYPE.TT) {
        // 抖音小程序
        profileData = await getUserProfileForTT();
      } else {
        Taro.hideLoading();
        Taro.showToast({ title: '当前平台不支持', icon: 'none' });
        return;
      }

      if (!profileData) {
        Taro.hideLoading();
        Taro.showToast({ title: '获取用户信息失败', icon: 'none' });
        return;
      }

      // 如果有头像，需要先上传
      let avatarUrl = profileData.avatar;
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        // 本地路径，需要上传
        avatarUrl = await uploadAvatar(avatarUrl);
      }

      // 更新用户信息
      const updateData: {
        nickname: string;
        avatar: string;
        gender?: 0 | 1 | 2;
      } = {
        nickname: profileData.nickname,
        avatar: avatarUrl,
      };
      if (profileData.gender !== undefined) {
        updateData.gender = profileData.gender;
      }

      const profile = await updateProfile(updateData);

      if (profile) {
        setUserInfo(profile);
        Taro.showToast({ title: '更新成功', icon: 'success' });
      }

      Taro.hideLoading();
    } catch (err) {
      Taro.hideLoading();
      console.error('获取用户信息失败:', err);
      const errorMsg = err instanceof Error ? err.message : '获取失败';
      Taro.showToast({ title: errorMsg, icon: 'none' });
    }
  }, []);

  // 页面显示时刷新用户信息
  Taro.useDidShow(async () => {
    if (isLoggedIn() && !loading) {
      const profile = await fetchProfile();
      if (profile) {
        setUserInfo(profile);
      }
    }
  });

  // 打开昵称编辑弹窗
  const handleOpenNicknameModal = useCallback(() => {
    setNicknameInput(userInfo?.nickname || '');
    setNicknameModalVisible(true);
  }, [userInfo?.nickname]);

  // 处理昵称输入
  const handleNicknameInput: InputProps['onInput'] = useCallback(e => {
    setNicknameInput(e.detail.value || '');
  }, []);

  // 确认修改昵称
  const handleConfirmNickname = useCallback(async () => {
    const newNickname = nicknameInput.trim();
    if (!newNickname) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if (newNickname === userInfo?.nickname) {
      setNicknameModalVisible(false);
      return;
    }

    try {
      Taro.showLoading({ title: '更新中...' });
      const profile = await updateProfile({ nickname: newNickname });
      if (profile) {
        setUserInfo(profile);
        setNicknameModalVisible(false);
        Taro.showToast({ title: '昵称已更新', icon: 'success' });
      }
      Taro.hideLoading();
    } catch (err) {
      Taro.hideLoading();
      console.error('修改昵称失败:', err);
      Taro.showToast({ title: '修改失败', icon: 'none' });
    }
  }, [nicknameInput, userInfo?.nickname]);

  // 处理绑定手机号（微信/抖音小程序）
  const handleBindPhone: ButtonProps['onGetPhoneNumber'] = useCallback(
    async e => {
      const env = Taro.getEnv();
      let phoneCode: string = '';

      if (env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT) {
        // 微信/抖音小程序
        if (e.detail.errMsg !== 'getPhoneNumber:ok' || !e.detail.code) {
          // 用户取消授权手机号，静默处理
          return;
        }
        phoneCode = e.detail.code;
      } else {
        Taro.showToast({ title: '当前平台不支持', icon: 'none' });
        return;
      }

      try {
        Taro.showLoading({ title: '绑定中...' });
        const idp = getCurrentPlatformIdP();
        const profile = await updateIdpProfile(idp, phoneCode);
        if (profile) {
          setUserInfo(profile);
        }
        Taro.hideLoading();
        Taro.showToast({ title: '绑定成功', icon: 'success' });
      } catch (err: any) {
        Taro.hideLoading();
        console.error('绑定手机号失败:', err);
        // 优先使用错误信息，如果没有则根据关键词判断
        const errorMsg = err?.message || '';
        let msg = '绑定失败，请重试';
        if (errorMsg.includes('已绑定') || errorMsg.includes('phone_bound')) {
          msg = '该手机号已绑定其他账号';
        } else if (errorMsg.includes('already_bound')) {
          msg = '您已绑定手机号';
        } else if (errorMsg && errorMsg !== '请求失败') {
          msg = errorMsg;
        }
        Taro.showToast({ title: msg, icon: 'none' });
      }
    },
    []
  );

  // 处理支付宝小程序手机号授权（两步流程）
  const handleAlipayPhoneAuth = useCallback(async (e: any) => {
    // 第一步：授权成功，调用 getPhoneNumber
    if (!e.detail.authCode) {
      // 用户取消授权，静默处理
      return;
    }

    try {
      Taro.showLoading({ title: '获取中...' });
      // 支付宝小程序：授权后调用 getPhoneNumber
      const phoneRes = await new Promise<any>((resolve, reject) => {
        // @ts-ignore - Taro 可能没有完整的类型定义
        Taro.getPhoneNumber({
          success: resolve,
          fail: reject,
        });
      });

      if (!phoneRes || !phoneRes.response) {
        Taro.hideLoading();
        Taro.showToast({ title: '获取手机号失败', icon: 'none' });
        return;
      }

      // 支付宝返回的是加密数据（response 字符串），需要传给后端解密
      // 注意：支付宝的 response 是加密字符串，不是 code
      const idp = getCurrentPlatformIdP();
      const profile = await updateIdpProfile(idp, phoneRes.response);
      if (profile) {
        setUserInfo(profile);
      }
      Taro.hideLoading();
      Taro.showToast({ title: '绑定成功', icon: 'success' });
    } catch (err: any) {
      Taro.hideLoading();
      console.error('绑定手机号失败:', err);
      const errorMsg = err?.message || '';
      let msg = '绑定失败，请重试';
      if (errorMsg.includes('已绑定') || errorMsg.includes('phone_bound')) {
        msg = '该手机号已绑定其他账号';
      } else if (errorMsg && errorMsg !== '请求失败') {
        msg = errorMsg;
      }
      Taro.showToast({ title: msg, icon: 'none' });
    }
  }, []);

  // 处理解绑手机号
  const handleUnbindPhone = useCallback(async () => {
    try {
      const res = await Taro.showActionSheet({
        itemList: ['解绑手机号'],
        itemColor: '#E8503A',
      });

      if (res.tapIndex !== 0) {
        return;
      }

      Taro.showLoading({ title: '解绑中...' });
      const idp = getCurrentPlatformIdP();
      const profile = await updateIdpProfile(idp, '');
      if (profile) {
        setUserInfo(profile);
      }
      Taro.hideLoading();
      Taro.showToast({ title: '解绑成功', icon: 'success' });
    } catch (err: any) {
      // 用户取消操作（点击取消或蒙层）
      if (err.errMsg?.includes('cancel')) {
        return;
      }
      Taro.hideLoading();
      console.error('解绑手机号失败:', err);
      const errorMsg = err?.message || '解绑失败，请重试';
      Taro.showToast({ title: errorMsg, icon: 'none' });
    }
  }, []);

  // 处理选择性别
  const handleSelectGender = useCallback(
    async (gender: 0 | 1 | 2) => {
      if (gender === userInfo?.gender) {
        setGenderPickerVisible(false);
        return;
      }

      try {
        Taro.showLoading({ title: '更新中...' });
        const profile = await updateProfile({ gender });
        if (profile) {
          setUserInfo(profile);
          Taro.showToast({ title: '性别已更新', icon: 'success' });
        }
        Taro.hideLoading();
      } catch (err) {
        Taro.hideLoading();
        console.error('修改性别失败:', err);
        Taro.showToast({ title: '修改失败', icon: 'none' });
      }
      setGenderPickerVisible(false);
    },
    [userInfo?.gender]
  );

  // 获取性别显示文本
  const getGenderLabel = (gender?: 0 | 1 | 2) => {
    return GENDER_OPTIONS.find(opt => opt.value === gender)?.label || '未设置';
  };

  if (loading) {
    return (
      <View className="settings-page">
        <View className="loading-container">
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="settings-page">
      {/* 头像区域 */}
      <View className="settings-section">
        <View className="section-item">
          <Text className="item-label">头像</Text>
          {Taro.getEnv() === Taro.ENV_TYPE.WEAPP ||
          Taro.getEnv() === Taro.ENV_TYPE.ALIPAY ? (
            // 微信/支付宝小程序：使用 chooseAvatar（支付宝从基础库 2.9.29 开始支持）
            <Button
              className="avatar-btn"
              openType="chooseAvatar"
              onChooseAvatar={handleChooseAvatar}
            >
              <View className="avatar-wrapper">
                {userInfo?.avatar ? (
                  <Image
                    src={userInfo.avatar}
                    mode="aspectFill"
                    className="avatar-image"
                  />
                ) : (
                  <View className="avatar-placeholder">
                    <AtIcon value="user" size="24" color="#ccc" />
                  </View>
                )}
                <AtIcon
                  value="chevron-right"
                  size="18"
                  color="#ccc"
                  className="arrow-icon"
                />
              </View>
            </Button>
          ) : (
            // 抖音小程序：点击获取用户信息
            <View
              className="avatar-wrapper"
              onClick={handleGetUserProfile}
              style={{ cursor: 'pointer' }}
            >
              {userInfo?.avatar ? (
                <Image
                  src={userInfo.avatar}
                  mode="aspectFill"
                  className="avatar-image"
                />
              ) : (
                <View className="avatar-placeholder">
                  <AtIcon value="user" size="24" color="#ccc" />
                </View>
              )}
              <AtIcon
                value="chevron-right"
                size="18"
                color="#ccc"
                className="arrow-icon"
              />
            </View>
          )}
        </View>
      </View>

      {/* 基本信息 */}
      <View className="settings-section">
        {Taro.getEnv() === Taro.ENV_TYPE.WEAPP ||
        Taro.getEnv() === Taro.ENV_TYPE.ALIPAY ? (
          // 微信/支付宝小程序：点击打开编辑弹窗（支付宝从基础库 2.9.29 开始支持 type="nickname"）
          <View className="section-item" onClick={handleOpenNicknameModal}>
            <Text className="item-label">昵称</Text>
            <View className="item-value-wrapper">
              <Text className="item-value">
                {userInfo?.nickname || '未设置'}
              </Text>
              <AtIcon value="chevron-right" size="18" color="#ccc" />
            </View>
          </View>
        ) : (
          // 抖音小程序：点击获取用户信息
          <View className="section-item" onClick={handleGetUserProfile}>
            <Text className="item-label">昵称</Text>
            <View className="item-value-wrapper">
              <Text className="item-value">
                {userInfo?.nickname || '未设置'}
              </Text>
              <AtIcon value="chevron-right" size="18" color="#ccc" />
            </View>
          </View>
        )}

        <View
          className="section-item"
          onClick={() => setGenderPickerVisible(true)}
        >
          <Text className="item-label">性别</Text>
          <View className="item-value-wrapper">
            <Text className="item-value">
              {getGenderLabel(userInfo?.gender)}
            </Text>
            <AtIcon value="chevron-right" size="18" color="#ccc" />
          </View>
        </View>

        <View className="section-item phone-item">
          <Text className="item-label">手机号</Text>
          {userInfo?.phone ? (
            <View className="item-value-wrapper" onClick={handleUnbindPhone}>
              <Text className="item-value phone-value">{userInfo.phone}</Text>
              <View className="phone-bound-tag">
                <Text className="tag-text">已绑定</Text>
              </View>
              <AtIcon value="chevron-right" size="18" color="#ccc" />
            </View>
          ) : Taro.getEnv() === Taro.ENV_TYPE.ALIPAY ? (
            // 支付宝小程序：两步流程
            <Button
              className="bind-phone-btn"
              openType="getAuthorize"
              scope="phoneNumber"
              onGetAuthorize={handleAlipayPhoneAuth}
            >
              <Text className="bind-text">绑定手机号</Text>
              <AtIcon value="chevron-right" size="18" color="#E8503A" />
            </Button>
          ) : (
            // 微信/抖音小程序：直接获取
            <Button
              className="bind-phone-btn"
              openType="getPhoneNumber"
              onGetPhoneNumber={handleBindPhone}
            >
              <Text className="bind-text">绑定手机号</Text>
              <AtIcon value="chevron-right" size="18" color="#E8503A" />
            </Button>
          )}
        </View>
      </View>

      {/* 偏好设置 */}
      <View className="settings-section">
        <View
          className="section-item"
          onClick={() => Taro.navigateTo({ url: '/pages/profile/preference' })}
        >
          <Text className="item-label">偏好设置</Text>
          <View className="item-value-wrapper">
            <Text className="item-value">口味、忌口、过敏</Text>
            <AtIcon value="chevron-right" size="18" color="#ccc" />
          </View>
        </View>
      </View>

      {/* 昵称编辑弹窗（微信/支付宝小程序） */}
      {nicknameModalVisible && (
        <View
          className="modal-mask"
          onClick={() => setNicknameModalVisible(false)}
        >
          <View className="modal-content" onClick={e => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title">修改昵称</Text>
            </View>
            <View className="modal-body">
              <Input
                type="nickname"
                className="modal-input"
                placeholder="请输入昵称"
                value={nicknameInput}
                onInput={handleNicknameInput}
                focus={nicknameModalVisible}
              />
              <Text className="modal-hint">
                {Taro.getEnv() === Taro.ENV_TYPE.WEAPP
                  ? '💡 点击输入框后选择「使用微信昵称」可快速填入'
                  : Taro.getEnv() === Taro.ENV_TYPE.ALIPAY
                    ? '💡 点击输入框后键盘上方会展示支付宝昵称，可直接选择'
                    : '💡 请输入您的昵称'}
              </Text>
            </View>
            <View className="modal-footer">
              <View
                className="modal-btn cancel"
                onClick={() => setNicknameModalVisible(false)}
              >
                <Text>取消</Text>
              </View>
              <View
                className="modal-btn confirm"
                onClick={handleConfirmNickname}
              >
                <Text>确定</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 性别选择弹窗 */}
      {genderPickerVisible && (
        <View
          className="modal-mask"
          onClick={() => setGenderPickerVisible(false)}
        >
          <View className="action-sheet" onClick={e => e.stopPropagation()}>
            <View className="action-sheet-header">
              <Text className="action-sheet-title">选择性别</Text>
            </View>
            {GENDER_OPTIONS.map(opt => (
              <View
                key={opt.value}
                className={`action-sheet-item ${
                  userInfo?.gender === opt.value ? 'active' : ''
                }`}
                onClick={() => handleSelectGender(opt.value as 0 | 1 | 2)}
              >
                <Text className="action-sheet-text">{opt.label}</Text>
                {userInfo?.gender === opt.value && (
                  <AtIcon value="check" size="18" color="#E8503A" />
                )}
              </View>
            ))}
            <View
              className="action-sheet-cancel"
              onClick={() => setGenderPickerVisible(false)}
            >
              <Text className="cancel-text">取消</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default Settings;
