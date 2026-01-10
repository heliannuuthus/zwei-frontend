import { useState, useEffect, useCallback } from 'react';
import { View, Text, OpenData, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AtIcon } from 'taro-ui';
import {
  wxLogin,
  logout,
  isLoggedIn,
  fetchProfile,
  fetchStats,
  UserInfo,
} from '../../services/user';
import footprintIcon from '../../assets/icons/footprint.svg';
import cartIcon from '../../assets/icons/cart.svg';
import starIcon from '../../assets/icons/star-outline.svg';
import './index.scss';

// 菜单项类型
interface MenuItem {
  icon: string;
  title: string;
  subtitle?: string;
  badge?: number;
  onClick: () => void;
}

interface Stats {
  favorites: number;
  history: number;
  cookingList: number;
}

const Profile = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<Stats>({
    favorites: 0,
    history: 0,
    cookingList: 0,
  });

  // 自动静默登录
  const autoSilentLogin = useCallback(async () => {
    if (isLoggedIn()) {
      const profile = await fetchProfile();
      if (profile) {
        setLoggedIn(true);
        setUserInfo(profile);
        return;
      }
      logout();
    }

    setIsLoggingIn(true);
    try {
      await wxLogin();
      const profile = await fetchProfile();
      if (profile) {
        setLoggedIn(true);
        setUserInfo(profile);
      }
    } catch (err) {
      console.error('静默登录失败:', err);
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    if (!loggedIn) {
      setStats({ favorites: 0, history: 0, cookingList: 0 });
      return;
    }

    // 获取收藏和浏览历史数（从后端）
    const backendStats = await fetchStats();
    if (backendStats) {
      setStats(prev => ({
        ...prev,
        favorites: backendStats.favorites,
        history: backendStats.history,
      }));
    }

    // 获取购物清单数（从本地存储）
    try {
      const cookingListData = Taro.getStorageSync('cooking_list');
      const cookingList = cookingListData ? JSON.parse(cookingListData) : [];
      setStats(prev => ({
        ...prev,
        cookingList: Array.isArray(cookingList) ? cookingList.length : 0,
      }));
    } catch {
      setStats(prev => ({ ...prev, cookingList: 0 }));
    }
  }, [loggedIn]);

  useEffect(() => {
    autoSilentLogin();
  }, [autoSilentLogin]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // 当页面显示时刷新数据，确保从个人中心返回后更新头像和昵称
  Taro.useDidShow(() => {
    if (loggedIn) {
      fetchProfile().then(profile => {
        if (profile) setUserInfo(profile);
      });
      loadStats();
    } else {
      setStats({ favorites: 0, history: 0, cookingList: 0 });
    }
  });

  const handleLogin = useCallback(async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await wxLogin();
      const profile = await fetchProfile();
      if (profile) {
        setLoggedIn(true);
        setUserInfo(profile);
      }
    } catch (err) {
      console.error('登录失败:', err);
    } finally {
      setIsLoggingIn(false);
    }
  }, [isLoggingIn]);

  const handleLogout = useCallback(() => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          logout();
          setLoggedIn(false);
          setUserInfo(null);
        }
      },
    });
  }, []);

  const navigateToSettings = () => {
    Taro.navigateTo({ url: '/pages/profile/settings' });
  };

  // 预览头像
  const handlePreviewAvatar = useCallback(
    (e: any) => {
      e.stopPropagation(); // 阻止冒泡，避免触发进入个人中心
      if (userInfo?.avatar) {
        Taro.previewImage({
          urls: [userInfo.avatar],
          current: userInfo.avatar,
        });
      }
    },
    [userInfo?.avatar]
  );

  // 菜单项配置
  const menuItems: MenuItem[] = [
    {
      icon: 'help',
      title: '帮助与反馈',
      onClick: () => Taro.navigateTo({ url: '/pages/profile/help' }),
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
      <View className="user-section">
        <View className="user-bg-pattern" />
        <View className="user-content">
          {loggedIn ? (
            <View className="user-card" onClick={navigateToSettings}>
              <View className="user-info-row">
                <View className="user-avatar" onClick={handlePreviewAvatar}>
                  {userInfo?.avatar ? (
                    <Image src={userInfo.avatar} mode="aspectFill" />
                  ) : (
                    <OpenData type="userAvatarUrl" />
                  )}
                </View>
                <View className="user-info-detail">
                  <View className="user-name-row">
                    <Text className="nickname-text">
                      {userInfo?.nickname || 'Hi, 美食家'}
                    </Text>
                  </View>
                  <Text className="user-greeting">点击查看并编辑个人资料</Text>
                </View>
                <AtIcon
                  value="chevron-right"
                  size="20"
                  color="rgba(255,255,255,0.6)"
                />
              </View>
            </View>
          ) : (
            <View className="user-login-row" onClick={handleLogin}>
              <View className="user-avatar-placeholder">
                <AtIcon value="user" size="36" color="#ccc" />
              </View>
              <View className="login-info">
                <Text className="login-title">点击登录账户</Text>
                <Text className="login-subtitle">开启你的私人定制美食之旅</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View className="stats-container">
        <View className="stats-card">
          <View
            className="stat-item"
            onClick={() => Taro.navigateTo({ url: '/pages/profile/favorites' })}
          >
            <View className="stat-icon-wrapper">
              <Image src={starIcon} className="stat-icon" />
              {stats.favorites > 0 && (
                <View className="stat-badge">
                  {stats.favorites > 99 ? '99+' : stats.favorites}
                </View>
              )}
            </View>
            <Text className="stat-label">收藏</Text>
          </View>
          <View className="stat-line" />
          <View
            className="stat-item"
            onClick={() => Taro.navigateTo({ url: '/pages/profile/history' })}
          >
            <View className="stat-icon-wrapper">
              <Image src={footprintIcon} className="stat-icon" />
              {stats.history > 0 && (
                <View className="stat-badge">
                  {stats.history > 99 ? '99+' : stats.history}
                </View>
              )}
            </View>
            <Text className="stat-label">足迹</Text>
          </View>
          <View className="stat-line" />
          <View
            className="stat-item"
            onClick={() => Taro.navigateTo({ url: '/pages/recipe/shopping' })}
          >
            <View className="stat-icon-wrapper">
              <Image src={cartIcon} className="stat-icon" />
              {stats.cookingList > 0 && (
                <View className="stat-badge">
                  {stats.cookingList > 99 ? '99+' : stats.cookingList}
                </View>
              )}
            </View>
            <Text className="stat-label">清单</Text>
          </View>
        </View>
      </View>

      <View className="menu-section">
        <View className="menu-group">
          {menuItems.map((item, index) => (
            <View key={index} className="menu-item" onClick={item.onClick}>
              <View className="menu-item-left">
                <View className="menu-icon-wrapper">
                  <AtIcon value={item.icon} size="20" color="#E8503A" />
                </View>
                <Text className="menu-title">{item.title}</Text>
              </View>
              <AtIcon value="chevron-right" size="16" color="#ccc" />
            </View>
          ))}
        </View>
      </View>

      {loggedIn && (
        <View className="logout-container">
          <View className="logout-btn" onClick={handleLogout}>
            <Text className="logout-text">退出当前账号</Text>
          </View>
        </View>
      )}

      <View className="footer">
        <Text className="footer-text">Choosy · 懂你的美食助手</Text>
        <Text className="footer-version">v1.0.0</Text>
      </View>
    </View>
  );
};

export default Profile;
