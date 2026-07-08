// apps/courier/components/Toast.tsx
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { palette } from '../theme';

type Kind = 'success' | 'error' | 'info';
type ToastMsg = { text: string; kind?: Kind; duration?: number };

const ToastCtx = createContext<{ show: (m: ToastMsg) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const y = useRef(new Animated.Value(-50)).current;
  const show = useCallback((m: ToastMsg) => {
    setMsg(m);
    const d = m.duration ?? 2200;
    if (m.kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
    if (m.kind === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(()=>{});
    Animated.timing(y, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      setTimeout(() => {
        Animated.timing(y, { toValue: -50, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setMsg(null));
      }, d);
    });
  }, [y]);

  const value = useMemo(() => ({ show }), [show]);

  const bg =
    msg?.kind === 'error' ? palette.errorBg :
    msg?.kind === 'success' ? palette.successBg :
    '#F6F6F6';
  const fg =
    msg?.kind === 'error' ? palette.errorText :
    msg?.kind === 'success' ? palette.successText :
    palette.text;

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 14,
          left: 12,
          right: 12,
          transform: [{ translateY: y }],
        }}
      >
        {!!msg && (
          <View style={{ backgroundColor: bg, borderColor: palette.border, borderWidth: 1, padding: 12, borderRadius: 12, shadowOpacity: 0.1, shadowRadius: 6 }}>
            <Text style={{ color: fg, fontWeight: '600' }}>{msg.text}</Text>
          </View>
        )}
      </Animated.View>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider/>');
  return ctx;
}
