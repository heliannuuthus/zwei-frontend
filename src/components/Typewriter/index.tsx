import { useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface TypewriterProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

const Typewriter = ({
  text,
  speed = 30,
  className = '',
  onComplete,
}: TypewriterProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);

      return () => clearTimeout(timer);
    } else if (currentIndex === text.length && onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete]);

  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  return (
    <View className={`typewriter ${className}`}>
      <Text className="typewriter-text">{displayedText}</Text>
      {currentIndex < text.length && (
        <Text className="typewriter-cursor">|</Text>
      )}
    </View>
  );
};

export default Typewriter;
