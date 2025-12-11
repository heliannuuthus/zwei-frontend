import { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, OpenData } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AtIcon } from 'taro-ui';
import { wxLogin, logout, isLoggedIn } from '../../services/user';
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
  const [stats, setStats] = useState({
    favorites: 0,
    history: 0,
    cookingList: 0,
  });

  // 加载统计数据
  const loadStats = useCallback(() => {
    setStats({
      favorites: getStorageLength(FAVORITES_KEY),
      history: getStorageLength(HISTORY_KEY),
      cookingList: getStorageLength(COOKING_LIST_KEY),
    });
  }, []);

  // 检查登录状态
  const checkLoginStatus = useCallback(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  useEffect(() => {
    loadStats();
    checkLoginStatus();
  }, [loadStats, checkLoginStatus]);

  Taro.useDidShow(() => {
    loadStats();
    checkLoginStatus();
  });

  // 处理登录（需要手机号授权）
  const handleGetPhoneNumber = useCallback(
    async (e: any) => {
      console.log('[Login] getPhoneNumber 回调:', e.detail);
      if (e.detail.errMsg !== 'getPhoneNumber:ok') {
        // 用户拒绝授权
        Taro.showToast({ title: '需要授权手机号才能登录', icon: 'none' });
        return;
      }

      if (isLoading) return;

      setIsLoading(true);
      try {
        await wxLogin(e.detail.code);
        setLoggedIn(true);
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
    },
    [isLoading]
  );

  // 处理退出登录
  const handleLogout = useCallback(() => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          logout();
          setLoggedIn(false);
          Taro.showToast({ title: '已退出登录', icon: 'none' });
        }
      },
    });
  }, []);

  // 菜单项配置
  const menuItems: MenuItem[] = [
    {
      icon: 'heart',
      title: '我的收藏',
      subtitle: '收藏的菜谱',
      badge: stats.favorites,
      onClick: () => {
        Taro.showToast({ title: '功能开发中', icon: 'none' });
      },
    },
    {
      icon: 'clock',
      title: '浏览历史',
      subtitle: '最近看过的菜谱',
      badge: stats.history,
      onClick: () => {
        Taro.showToast({ title: '功能开发中', icon: 'none' });
      },
    },
    {
      icon: 'shopping-bag',
      title: '做饭清单',
      subtitle: '待做的菜品',
      badge: stats.cookingList,
      onClick: () => {
        Taro.switchTab({ url: '/pages/recipe/index' });
      },
    },
  ];

  const settingsItems: MenuItem[] = [
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

  if (loggedIn) {
    settingsItems.push({
      icon: 'log-out',
      title: '退出登录',
      onClick: handleLogout,
    });
  }

  return (
    <View className="profile-page">
      {/* 顶部用户信息区域 */}
      <View className="user-section">
        <View className="user-bg-pattern" />
        <View className="user-content">
          {loggedIn ? (
            <>
              <View className="user-avatar">
                <OpenData type="userAvatarUrl" />
              </View>
              <View className="user-name">
                <OpenData type="userNickName" />
              </View>
            </>
          ) : (
            <>
              <Button
                className="user-avatar-placeholder"
                openType="getPhoneNumber"
                onGetPhoneNumber={handleGetPhoneNumber}
              >
                {isLoading ? (
                  <Text className="loading-text">...</Text>
                ) : (
                  <AtIcon value="user" size="40" color="#ccc" />
                )}
              </Button>
              <Button
                className="login-btn"
                openType="getPhoneNumber"
                onGetPhoneNumber={handleGetPhoneNumber}
              >
                {isLoading ? '登录中...' : '手机号快捷登录'}
              </Button>
              <Text className="user-slogan">授权手机号即可登录</Text>
            </>
          )}
        </View>

        {/* 统计卡片 */}
        <View className="stats-card">
          <View className="stat-item" onClick={menuItems[0].onClick}>
            <Text className="stat-number">{stats.favorites}</Text>
            <Text className="stat-label">收藏</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item" onClick={menuItems[1].onClick}>
            <Text className="stat-number">{stats.history}</Text>
            <Text className="stat-label">浏览</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item" onClick={menuItems[2].onClick}>
            <Text className="stat-number">{stats.cookingList}</Text>
            <Text className="stat-label">清单</Text>
          </View>
        </View>
      </View>

      {/* 功能菜单 */}
      <View className="menu-section">
        <View className="menu-group">
          <Text className="menu-group-title">我的内容</Text>
          {menuItems.map((item, index) => (
            <View key={index} className="menu-item" onClick={item.onClick}>
              <View className="menu-item-left">
                <View className="menu-icon-wrapper">
                  <AtIcon value={item.icon} size="20" color="#E8503A" />
                </View>
                <View className="menu-text">
                  <Text className="menu-title">{item.title}</Text>
                  {item.subtitle && (
                    <Text className="menu-subtitle">{item.subtitle}</Text>
                  )}
                </View>
              </View>
              <View className="menu-item-right">
                {item.badge !== undefined && item.badge > 0 && (
                  <Text className="menu-badge">{item.badge}</Text>
                )}
                <AtIcon value="chevron-right" size="18" color="#ccc" />
              </View>
            </View>
          ))}
        </View>

        <View className="menu-group">
          <Text className="menu-group-title">更多</Text>
          {settingsItems.map((item, index) => (
            <View key={index} className="menu-item" onClick={item.onClick}>
              <View className="menu-item-left">
                <View
                  className={`menu-icon-wrapper ${item.icon === 'log-out' ? 'danger' : 'secondary'}`}
                >
                  <AtIcon
                    value={item.icon}
                    size="20"
                    color={item.icon === 'log-out' ? '#ff4d4f' : '#D35400'}
                  />
                </View>
                <View className="menu-text">
                  <Text
                    className={`menu-title ${item.icon === 'log-out' ? 'danger' : ''}`}
                  >
                    {item.title}
                  </Text>
                </View>
              </View>
              <View className="menu-item-right">
                <AtIcon value="chevron-right" size="18" color="#ccc" />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 底部信息 */}
      <View className="footer-section">
        <Text className="footer-text">Choosy · 让每一餐都值得期待</Text>
        <Text className="footer-version">Version 1.0.0</Text>
      </View>
    </View>
  );
};

export default Profile;
