import { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, OpenData, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { ButtonProps, InputProps } from '@tarojs/components';
import { AtIcon } from 'taro-ui';
import { wxLogin, logout, isLoggedIn, fetchProfile, getUserInfo, updateProfile, UserInfo } from '../../services/user';
import './index.scss';

// 存储 key
const COOKING_LIST_KEY = 'cooking_list';
const FAVORITES_KEY = 'favorites';
const HISTORY_KEY = 'view_history';

// 获取本地存储数据长度
const getStorageLength = (key: string): number => {
  try {
    const data = Taro.getStorageSync(key);
    if (!data) return 0;
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};

// 菜单项类型
interface MenuItem {
  icon: string;
  title: string;
  subtitle?: string;
  badge?: number;
  onClick: () => void;
}

const Profile = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState({
    favorites: 0,
    history: 0,
    cookingList: 0,
  });
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

  // 加载统计数据
  const loadStats = useCallback(() => {
    setStats({
      favorites: getStorageLength(FAVORITES_KEY),
      history: getStorageLength(HISTORY_KEY),
      cookingList: getStorageLength(COOKING_LIST_KEY),
    });
  }, []);

  // 检查登录状态并加载用户信息
  const checkLoginStatus = useCallback(async () => {
    const logged = isLoggedIn();
    setLoggedIn(logged);

    if (logged) {
      // 先尝试从缓存读取
      const cached = getUserInfo();
      if (cached) {
        setUserInfo(cached);
      }
      // 请求最新 profile（会自动处理 token 刷新）
      const profile = await fetchProfile();
      if (profile) {
        setUserInfo(profile);
      }
    } else {
      setUserInfo(null);
    }
  }, []);

  useEffect(() => {
    loadStats();
    checkLoginStatus();
  }, [loadStats, checkLoginStatus]);

  // useDidShow 只刷新统计数据（可能在其他页面变化）
  // 用户信息在 useEffect 首次加载，修改后在对应 handler 更新
  Taro.useDidShow(() => {
    loadStats();
  });

  // 处理登录（静默登录）
  const handleLogin = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await wxLogin();
      setLoggedIn(true);
      // 登录成功后立即获取用户信息
      const profile = await fetchProfile();
      if (profile) {
        setUserInfo(profile);
      }
      Taro.showToast({ title: '登录成功', icon: 'success' });
    } catch (err) {
      console.error('登录失败:', err);
      Taro.showToast({
        title: err instanceof Error ? err.message : '登录失败',
        icon: 'none',
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // 处理退出登录
  const handleLogout = useCallback(() => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          logout();
          setLoggedIn(false);
          setUserInfo(null);
          Taro.showToast({ title: '已退出登录', icon: 'none' });
        }
      },
    });
  }, []);

  // 处理选择微信头像
  const handleChooseAvatar: ButtonProps['onChooseAvatar'] = useCallback(async (e) => {
    const avatarUrl = e.detail.avatarUrl;
    if (!avatarUrl) return;
    
    try {
      Taro.showLoading({ title: '更新中...' });
      
      // TODO: 上传图片到服务器获取永久 URL
      // 目前直接使用微信返回的临时路径
      const profile = await updateProfile({ avatar: avatarUrl });
      if (profile) {
        setUserInfo(profile);
        Taro.showToast({ title: '头像已更新', icon: 'success' });
      }
      Taro.hideLoading();
    } catch (err) {
      Taro.hideLoading();
      console.error('修改头像失败:', err);
      Taro.showToast({ title: '修改失败', icon: 'none' });
    }
  }, []);

  // 打开昵称编辑弹窗
  const handleOpenNicknameModal = useCallback(() => {
    setNicknameInput(userInfo?.nickname || '');
    setNicknameModalVisible(true);
  }, [userInfo?.nickname]);

  // 处理昵称输入（微信昵称类型的 input）
  const handleNicknameInput: InputProps['onInput'] = useCallback((e) => {
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

  // 菜单项配置
  const menuItems: MenuItem[] = [
    {
      icon: 'settings',
      title: '设置',
      onClick: () => {
        Taro.showToast({ title: '功能开发中', icon: 'none' });
      },
    },
    {
      icon: 'help',
      title: '帮助与反馈',
      onClick: () => {
        Taro.showToast({ title: '功能开发中', icon: 'none' });
      },
    },
    {
      icon: 'alert-circle',
      title: '关于我们',
      onClick: () => {
        Taro.showModal({
          title: 'Choosy',
          content: '让每一餐都值得期待 ✨\n\n版本：1.0.0',
          showCancel: false,
          confirmText: '知道了',
        });
      },
    },
  ];


  return (
    <View className="profile-page">
      {/* 顶部用户信息区域 */}
      <View className="user-section">
        <View className="user-bg-pattern" />
        <View className="user-content">
          {loggedIn ? (
            <View className="user-info-row">
              <Button 
                className="user-avatar-btn" 
                openType="chooseAvatar" 
                onChooseAvatar={handleChooseAvatar}
              >
                <View className="user-avatar">
                  {userInfo?.avatar ? (
                    <Image src={userInfo.avatar} mode="aspectFill" />
                  ) : (
                    <OpenData type="userAvatarUrl" />
                  )}
                  <View className="avatar-edit-hint">
                    <AtIcon value="camera" size="10" color="#fff" />
                  </View>
                </View>
              </Button>
              <View className="user-info-detail">
                <View className="user-name" onClick={handleOpenNicknameModal}>
                  <Text className="nickname-text">
                    {userInfo?.nickname || '点击设置昵称'}
                  </Text>
                  <AtIcon value="edit" size="14" color="rgba(255,255,255,0.7)" />
                </View>
                <Text className="user-greeting">今天想吃点什么？</Text>
              </View>
            </View>
          ) : (
            <View className="user-login-row">
              <View className="user-avatar-placeholder" onClick={handleLogin}>
                {isLoading ? (
                  <Text className="loading-text">...</Text>
                ) : (
                  <AtIcon value="user" size="36" color="#ccc" />
                )}
              </View>
              <View className="login-info">
                <Button className="login-btn" onClick={handleLogin}>
                  {isLoading ? '登录中...' : '微信快捷登录'}
                </Button>
                <Text className="user-slogan">点击登录，开启美食之旅</Text>
              </View>
            </View>
          )}

          {/* 快捷入口 */}
          <View className="quick-actions">
            <View className="action-item" onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none' })}>
              <View className="action-icon">
                <AtIcon value="heart" size="22" color="#fff" />
              </View>
              <Text className="action-label">收藏</Text>
            </View>
            <View className="action-item" onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none' })}>
              <View className="action-icon">
                <AtIcon value="clock" size="22" color="#fff" />
              </View>
              <Text className="action-label">足迹</Text>
            </View>
            <View className="action-item" onClick={() => Taro.switchTab({ url: '/pages/recipe/index' })}>
              <View className="action-icon">
                <AtIcon value="bookmark" size="22" color="#fff" />
                {stats.cookingList > 0 && (
                  <View className="action-badge">
                    <Text className="badge-text">{stats.cookingList > 99 ? '99+' : stats.cookingList}</Text>
                  </View>
                )}
              </View>
              <Text className="action-label">清单</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 功能菜单 */}
      <View className="menu-section">
        <View className="menu-group">
          {menuItems.map((item, index) => (
            <View key={index} className="menu-item" onClick={item.onClick}>
              <View className="menu-item-left">
                <View className="menu-icon-wrapper">
                  <AtIcon value={item.icon} size="20" color="#E8503A" />
                </View>
                <View className="menu-text">
                  <Text className="menu-title">{item.title}</Text>
                </View>
              </View>
              <View className="menu-item-right">
                <AtIcon value="chevron-right" size="18" color="#ccc" />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 退出登录按钮 */}
      {loggedIn && (
        <View className="logout-section">
          <View className="logout-btn" onClick={handleLogout}>
            <Text className="logout-text">退出登录</Text>
          </View>
        </View>
      )}

      {/* 底部信息 */}
      <View className="footer-section">
        <Text className="footer-text">Choosy · 让每一餐都值得期待</Text>
        <Text className="footer-version">Version 1.0.0</Text>
      </View>

      {/* 昵称编辑弹窗 */}
      {nicknameModalVisible && (
        <View className="nickname-modal-mask" onClick={() => setNicknameModalVisible(false)}>
          <View className="nickname-modal" onClick={(e) => e.stopPropagation()}>
            <View className="nickname-modal-header">
              <Text className="nickname-modal-title">修改昵称</Text>
            </View>
            <View className="nickname-modal-body">
              <Input
                type="nickname"
                className="nickname-modal-input"
                placeholder="请输入昵称"
                value={nicknameInput}
                onInput={handleNicknameInput}
                focus={nicknameModalVisible}
              />
              <Text className="nickname-modal-hint">
                💡 点击输入框后选择「使用微信昵称」可快速填入
              </Text>
            </View>
            <View className="nickname-modal-footer">
              <View 
                className="nickname-modal-btn cancel" 
                onClick={() => setNicknameModalVisible(false)}
              >
                <Text>取消</Text>
              </View>
              <View 
                className="nickname-modal-btn confirm" 
                onClick={handleConfirmNickname}
              >
                <Text>确定</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default Profile;
