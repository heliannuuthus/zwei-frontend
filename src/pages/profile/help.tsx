import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AtIcon } from 'taro-ui';
import './help.scss';

const FEEDBACK_EMAIL = 'heliannuuthus@gmail.com';

const Help = () => {
  // 复制邮箱到剪贴板
  const handleCopyEmail = () => {
    Taro.setClipboardData({
      data: FEEDBACK_EMAIL,
      success: () => {
        Taro.showToast({
          title: '邮箱已复制',
          icon: 'success',
        });
      },
    });
  };

  return (
    <View className="help-page">
      {/* 顶部图形装饰 */}
      <View className="header-decoration">
        <View className="circle circle-1" />
        <View className="circle circle-2" />
        <View className="circle circle-3" />
      </View>

      {/* 主体内容 */}
      <View className="content">
        {/* 插图区域 */}
        <View className="illustration">
          <View className="icon-wrapper">
            <AtIcon value="mail" size="48" color="#E8503A" />
          </View>
        </View>

        {/* 标题 */}
        <View className="title-section">
          <Text className="title">需要帮助？</Text>
          <Text className="subtitle">我们很乐意听取您的反馈和建议</Text>
        </View>

        {/* 邮箱卡片 */}
        <View className="email-card" onClick={handleCopyEmail}>
          <View className="email-icon">
            <AtIcon value="mail" size="24" color="#E8503A" />
          </View>
          <View className="email-content">
            <Text className="email-label">发送邮件至</Text>
            <Text className="email-address">{FEEDBACK_EMAIL}</Text>
          </View>
          <View className="copy-btn">
            <AtIcon value="link" size="18" color="#999" />
            <Text className="copy-text">复制</Text>
          </View>
        </View>

        {/* 提示信息 */}
        <View className="tips-section">
          <Text className="tips-title">您可以反馈：</Text>
          <View className="tips-list">
            <View className="tip-item">
              <View className="tip-dot" />
              <Text className="tip-text">功能建议与需求</Text>
            </View>
            <View className="tip-item">
              <View className="tip-dot" />
              <Text className="tip-text">使用中遇到的问题</Text>
            </View>
            <View className="tip-item">
              <View className="tip-dot" />
              <Text className="tip-text">菜谱内容纠错</Text>
            </View>
            <View className="tip-item">
              <View className="tip-dot" />
              <Text className="tip-text">其他任何想法</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 底部 */}
      <View className="footer">
        <Text className="footer-text">感谢您帮助 Choosy 变得更好 💕</Text>
      </View>
    </View>
  );
};

export default Help;
