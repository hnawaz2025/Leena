import { useEffect, useRef } from "react";
import { Animated } from "react-native";

interface FadeInItemProps {
  index: number;
  children: React.ReactNode;
}

// Staggered entrance for list items -- runs once per mount, capped so a long
// list doesn't take forever to finish animating in.
export function FadeInItem({ index, children }: FadeInItemProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index * 40, 240),
      useNativeDriver: true,
    }).start();
  }, [progress, index]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
