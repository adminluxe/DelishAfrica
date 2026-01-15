// apps/courier/components/RippleBtn.tsx
import { useRef } from 'react';
import { Pressable, Text, View, Animated, Easing, GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { palette } from '../theme';

export default function RippleBtn({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const radius = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const trigger = (e: GestureResponderEvent) => {
    Haptics.selectionAsync().catch(() => {});
    radius.setValue(0);
    opacity.setValue(0.18);
    Animated.parallel([
      Animated.timing(radius, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={trigger}
      disabled={disabled}
      style={{
        overflow: 'hidden',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 10,
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: disabled ? '#F2F2F2' : '#FFF',
      }}
    >
      <View>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: 10,
            backgroundColor: palette.brand,
            opacity,
            transform: [{ scale: radius.interpolate({ inputRange: [0, 1], outputRange: [0.01, 1] }) }],
          }}
        />
        <Text style={{ color: palette.text, fontWeight: '600' }}>{label}</Text>
      </View>
    </Pressable>
  );
}
