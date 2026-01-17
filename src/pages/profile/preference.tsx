import { useState, useEffect, useCallback } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AtIcon } from 'taro-ui';
import {
  getOptions,
  getUserPreferences,
  updateUserPreferences,
  OptionsResponse,
  UserPreferencesResponse,
  OptionItemWithSelected,
} from '../../services/preference';
import { isLoggedIn } from '../../services/user';
import './preference.scss';

const Preference = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [preferences, setPreferences] =
    useState<UserPreferencesResponse | null>(null);

  // 加载选项和用户偏好
  const loadData = useCallback(async () => {
    if (!isLoggedIn()) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      Taro.navigateBack();
      return;
    }

    setLoading(true);
    try {
      // 并行加载选项和用户偏好
      const [optionsData, preferencesData] = await Promise.all([
        getOptions(),
        getUserPreferences(),
      ]);

      setOptions(optionsData);
      setPreferences(preferencesData);
    } catch (err) {
      console.error('加载偏好数据失败:', err);
      Taro.showToast({
        title: err instanceof Error ? err.message : '加载失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 切换选项选中状态
  const toggleOption = useCallback(
    (type: 'flavors' | 'taboos' | 'allergies', value: string) => {
      if (!preferences) return;

      const updated = { ...preferences };
      const items = updated[type];

      const index = items.findIndex(item => item.value === value);
      if (index >= 0) {
        // 切换选中状态
        items[index] = {
          ...items[index],
          selected: !items[index].selected,
        };
      }

      setPreferences(updated);
    },
    [preferences]
  );

  // 保存偏好设置
  const handleSave = useCallback(async () => {
    if (!preferences) return;

    setSaving(true);
    try {
      // 提取选中的选项值
      const selectedFlavors = preferences.flavors
        .filter(item => item.selected)
        .map(item => item.value);

      const selectedTaboos = preferences.taboos
        .filter(item => item.selected)
        .map(item => item.value);

      const selectedAllergies = preferences.allergies
        .filter(item => item.selected)
        .map(item => item.value);

      await updateUserPreferences({
        flavors: selectedFlavors,
        taboos: selectedTaboos,
        allergies: selectedAllergies,
      });

      Taro.showToast({ title: '保存成功', icon: 'success' });
      // 延迟返回，让用户看到成功提示
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    } catch (err) {
      console.error('保存偏好失败:', err);
      Taro.showToast({
        title: err instanceof Error ? err.message : '保存失败',
        icon: 'none',
      });
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  // 渲染选项列表
  const renderOptions = useCallback(
    (
      items: OptionItemWithSelected[],
      type: 'flavors' | 'taboos' | 'allergies',
      title: string,
      icon: string
    ) => {
      if (!items || items.length === 0) {
        return null;
      }

      return (
        <View className="preference-section">
          <View className="section-header">
            <View className="section-title-wrapper">
              <AtIcon value={icon} size="18" color="#E8503A" />
              <Text className="section-title">{title}</Text>
            </View>
            <Text className="section-count">
              已选 {items.filter(item => item.selected).length} / {items.length}
            </Text>
          </View>
          <View className="options-grid">
            {items.map(item => (
              <View
                key={item.value}
                className={`option-item ${item.selected ? 'selected' : ''}`}
                onClick={() => toggleOption(type, item.value)}
              >
                <Text className="option-label">{item.label}</Text>
                {item.selected && (
                  <AtIcon value="check" size="14" color="#E8503A" />
                )}
              </View>
            ))}
          </View>
        </View>
      );
    },
    [toggleOption]
  );

  if (loading) {
    return (
      <View className="preference-page">
        <View className="loading-container">
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    );
  }

  if (!options || !preferences) {
    return (
      <View className="preference-page">
        <View className="error-container">
          <Text className="error-text">加载失败，请重试</Text>
          <Button
            className="retry-btn"
            onClick={loadData}
            size="mini"
            type="primary"
          >
            重试
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="preference-page">
      <View className="preference-content">
        {/* 口味偏好 */}
        {renderOptions(preferences.flavors, 'flavors', '口味偏好', 'heart')}

        {/* 忌口偏好 */}
        {renderOptions(preferences.taboos, 'taboos', '忌口偏好', 'alert')}

        {/* 过敏偏好 */}
        {renderOptions(
          preferences.allergies,
          'allergies',
          '过敏信息',
          'warning'
        )}
      </View>

      {/* 底部保存按钮 */}
      <View className="preference-footer">
        <Button
          className="save-btn"
          onClick={handleSave}
          loading={saving}
          disabled={saving}
          type="primary"
        >
          {saving ? '保存中...' : '保存设置'}
        </Button>
      </View>
    </View>
  );
};

export default Preference;
