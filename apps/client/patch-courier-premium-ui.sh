
#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/compose"
APP_DIR="$ROOT/apps/courier"

HOME_TSX="$APP_DIR/app/home.tsx"
BG_TSX="$APP_DIR/components/AppBackground.tsx"
CONFETTI_TSX="$APP_DIR/components/ConfettiBurst.tsx"
FADEIN_TSX="$APP_DIR/components/FadeIn.tsx"

echo "[1/6] Prépare les dossiers…"
mkdir -p "$APP_DIR/app" "$APP_DIR/components"

echo "[2/6] Écrit: $FADEIN_TSX"
cat > "$FADEIN_TSX" <<'EOF'
// apps/courier/components/FadeIn.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

export default function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: 320,
        delay,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delay, opacity, translate]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY: translate }] }, style]}>
      {children}
    </Animated.View>
  );
}
EOF

echo "[3/6] Écrit: $CONFETTI_TSX"
cat > "$CONFETTI_TSX" <<'EOF'
// apps/courier/components/ConfettiBurst.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

type Props = {
  /** Incrémente ce nombre pour déclencher une nouvelle explosion */
  runKey: number;
  /** 0..1 */
  intensity?: number;
};

const { width: W, height: H } = Dimensions.get('window');

export default function ConfettiBurst({ runKey, intensity = 1 }: Props) {
  const seeded = useMemo(() => {
    // 5 particules ultra-light (cercles), positions & vitesses stables par run
    const baseX = W * 0.5;
    return Array.from({ length: 5 }).map((_, i) => {
      const sign = i % 2 === 0 ? -1 : 1;
      const spread = (W * 0.22 + i * 10) * sign;
      const dx = spread * (0.7 + Math.random() * 0.6);
      const dy = -(H * 0.18 + Math.random() * H * 0.12);
      const size = 8 + i * 3;
      const delay = i * 40;
      // palette “luxe” (neutre + un accent)
      const colors = ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0.55)', 'rgba(240,230,200,0.85)'];
      const color = colors[(i + Math.floor(Math.random() * colors.length)) % colors.length];
      return { baseX, dx, dy, size, delay, color };
    });
  }, [runKey]);

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // reset + run
    progress.setValue(0);
    const a = Animated.timing(progress, {
      toValue: 1,
      duration: Math.floor(650 + 250 * intensity),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [runKey, intensity, progress]);

  // Styles animés dérivés
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {seeded.map((p, idx) => {
        const t = progress;
        const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
        const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] });
        const opacity = t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.95, 0] });
        const scale = t.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.9, 1.05, 1] });
        const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(idx % 2 ? 1 : -1) * (120 + idx * 25)}deg`] });

        return (
          <Animated.View
            key={idx}
            style={[
              styles.dot,
              {
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: p.color,
                left: p.baseX - p.size / 2,
                top: H * 0.18,
                opacity,
                transform: [{ translateX }, { translateY }, { scale }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
  },
});
EOF

echo "[4/6] Écrit: $BG_TSX (fond d’écran clair + dark, dégradé + texture)"
cat > "$BG_TSX" <<'EOF'
// apps/courier/components/AppBackground.tsx
import React, { useMemo } from 'react';
import { ImageBackground, View, useColorScheme } from 'react-native';

type Props = {
  children: React.ReactNode;
  /**
   * "routes" = vibe livraison/pins, "textures" = vibe textile/africain discret
   */
  variant?: 'routes' | 'textures';
  /** opacité de la texture 0..1 */
  opacity?: number;
  /** active un gradient (safe fallback si expo-linear-gradient absent) */
  gradient?: boolean;
};

/**
 * Tiles base64 ultra-légères (8x8) – répétées, très cheap GPU.
 * - ROUTES_PINS : micro-motif "routes & pins"
 * - TEXTURES    : micro-motif "africain géométrique subtil"
 *
 * NB: tu peux remplacer ces strings par tes tiles existantes si tu veux.
 */
const TILE_ROUTES_PINS =
  'iVBORw0KGgoAAAANSUhEUgAAAAAIAAAACAYAAADEUlfTAAAAI0lEQVQYV2NkYGD4oABYBxgAEjQH4ZgMEDMMb0gkEwAABLTcCA7M3k1sAAAAAASUVORK5CYII=';
const TILE_TEXTURES =
  'iVBORw0KGgoAAAANSUhEUgAAAAAIAAAACAYAAADEUlfTAAAAI0lEQVQYV2NkIAIwEQwM0gYhYHAgAE8QwABuKcL6qU4b2wAAAASUVORK5CYII=';

export default function AppBackground({
  children,
  variant = 'routes',
  opacity = 0.12,
  gradient = true,
}: Props) {
  const scheme = useColorScheme(); // 'light' | 'dark' | null
  const isDark = scheme === 'dark';

  const source = useMemo(() => {
    const b64 = variant === 'routes' ? TILE_ROUTES_PINS : TILE_TEXTURES;
    return { uri: `data:image/png;base64,${b64}` };
  }, [variant]);

  // Chargement "safe" du gradient : si la lib n’est pas installée => fallback View
  let LinearGradient: any = null;
  if (gradient) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      LinearGradient = require('expo-linear-gradient').LinearGradient;
    } catch {
      LinearGradient = null;
    }
  }

  const Wrapper: React.ComponentType<any> = LinearGradient || View;

  const wrapperProps = LinearGradient
    ? {
        colors: isDark
          ? ['#070709', '#0B0B10', '#10101A'] // dark “minimal luxe”
          : ['#F8FFFC', '#F3FBFF', '#F8F3FF'], // light “minimal luxe”
        start: { x: 0.1, y: 0 },
        end: { x: 0.9, y: 1 },
        style: { flex: 1 },
      }
    : { style: { flex: 1, backgroundColor: isDark ? '#070709' : '#F8FFFC' } };

  return (
    <ImageBackground source={source} resizeMode="repeat" style={{ flex: 1 }} imageStyle={{ opacity }}>
      <Wrapper {...wrapperProps}>
        {/* voile très léger pour profondeur */}
        <View pointerEvents="none"
          style={{
            ...{
              position: 'absolute',
              inset: 0,
              backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.10)',
            },
          }}
        />
        <View style={{ flex: 1 }}>{children}</View>
      </Wrapper>
    </ImageBackground>
  );
}
EOF

echo "[5/6] Écrit: $HOME_TSX (COMPLET) – background + fade + confetti + polling + toast"
cat > "$HOME_TSX" <<'EOF'
// apps/courier/app/home.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, SafeAreaView, Pressable, Alert, useColorScheme } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import FadeIn from '../components/FadeIn';
import ConfettiBurst from '../components/ConfettiBurst';
import AppBackground from '../components/AppBackground';

type Status = 'available' | 'accepted' | 'assigned' | 'picked_up' | 'en_route' | 'delivered' | 'canceled';

type Job = {
  id: string;
  merchant: string;
  pickup: { address: string };
  dropoff: { address: string };
  distanceKm: number;
  etaMin: number;
  payout: number;
  status: Status;
};

const Btn = ({ label, onPress }: { label: string; onPress: () => void }) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderRadius: 12,
        marginRight: 8,
        marginBottom: 8,
        borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)',
      }}
    >
      <Text style={{ fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)' }}>{label}</Text>
    </Pressable>
  );
};

// fetch JSON avec gestion d'erreur HTTP + ok:false
async function jfetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || (typeof (data as any)?.ok !== 'undefined' && (data as any).ok === false)) {
    const msg = (data as any)?.message || (data as any)?.status || `HTTP ${r.status}`;
    throw new Error(String(msg));
  }
  return data as T;
}

export default function CourierHome() {
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const EXTRA = (Constants.expoConfig as any)?.extra || {};
  const API_RAW = process.env.EXPO_PUBLIC_API_BASE_URL || EXTRA.API_BASE_URL || 'https://api.delishafrica.me';
  const API = useMemo(() => String(API_RAW).replace(/\/+$/, ''), [API_RAW]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);

  // Toast/bannière premium light (sans lib)
  const [banner, setBanner] = useState<{ msg: string; kind: 'ok' | 'info' | 'err' } | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBanner = (msg: string, kind: 'ok' | 'info' | 'err' = 'info') => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner({ msg, kind });
    bannerTimer.current = setTimeout(() => setBanner(null), 2200);
  };

  // Confetti “Livré 🎉”
  const [confettiKey, setConfettiKey] = useState(0);
  const fireConfetti = () => setConfettiKey((k) => k + 1);

  const fetchMy = async (): Promise<Job[]> => {
    try {
      const data = await jfetch<{ items?: Job[] }>(`${API}/api/couriers/my`, { method: 'GET' });
      return data.items ?? [];
    } catch {
      return [];
    }
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const mine = await fetchMy();
      if (mine.length) {
        setJobs(mine);
      } else {
        const data = await jfetch<{ items?: Job[] }>(`${API}/api/couriers/jobs/available`, { method: 'GET' });
        setJobs(data.items ?? []);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erreur réseau');
      setJobs([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const call = async (path: string, okMsg: string) => {
    try {
      await jfetch(`${API}${path}`, { method: 'POST' });

      const isDelivered = okMsg.toLowerCase().includes('livré') || path.endsWith('/delivered');
      if (isDelivered) {
        fireConfetti();
        showBanner('Livraison validée 🎉', 'ok');
      } else {
        showBanner(okMsg, 'ok');
      }

      await load(true);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Action échouée');
      showBanner(e?.message ?? 'Action échouée', 'err');
    }
  };

  const devReset = async () => {
    try {
      await jfetch(`${API}/api/couriers/reset`, { method: 'POST' });
      showBanner('Reset effectué', 'ok');
      await load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Reset échoué');
      showBanner(e?.message ?? 'Reset échoué', 'err');
    }
  };

  const actionsFor = (j: Job): { lbl: string; path: string }[] => {
    switch (j.status) {
      case 'available':
        return [{ lbl: 'Accepter', path: `/api/couriers/jobs/${j.id}/accept` }];
      case 'accepted':
        return [{ lbl: 'Assigner', path: `/api/couriers/jobs/${j.id}/assign` }];
      case 'assigned':
        return [{ lbl: 'Pickup', path: `/api/couriers/jobs/${j.id}/pickup` }];
      case 'picked_up':
        return [{ lbl: 'Démarrer', path: `/api/couriers/jobs/${j.id}/start` }];
      case 'en_route':
        return [{ lbl: 'Livré', path: `/api/couriers/jobs/${j.id}/delivered` }];
      default:
        return [];
    }
  };

  useEffect(() => {
    load();
    // Polling 5s (soft) : ne fait pas spinner, juste refresh silencieux
    const itv = setInterval(() => {
      load(true).catch(() => {});
    }, 5000);

    return () => {
      clearInterval(itv);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bannerStyle = (() => {
    const base = {
      borderWidth: 1,
      padding: 12,
      borderRadius: 14,
      marginBottom: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.78)',
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
    };
    if (!banner) return base;
    if (banner.kind === 'ok') return { ...base, borderColor: 'rgba(60,180,120,0.35)' };
    if (banner.kind === 'err') return { ...base, borderColor: 'rgba(220,80,80,0.35)' };
    return base;
  })();

  const textMain = { color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.86)' };
  const textMuted = { color: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.60)' };

  return (
    <AppBackground variant="routes" opacity={0.13} gradient>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Confetti overlay */}
        <ConfettiBurst runKey={confettiKey} />

        <View style={{ flex: 1, padding: 16 }}>
          {/* Toast */}
          {banner && (
            <FadeIn>
              <View style={bannerStyle}>
                <Text style={[{ fontWeight: '700' }, textMain]}>
                  {banner.kind === 'ok' ? '✅ ' : banner.kind === 'err' ? '⚠️ ' : '✨ '}
                  {banner.msg}
                </Text>
              </View>
            </FadeIn>
          )}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
            <Btn label="Rafraîchir" onPress={() => load()} />
            {__DEV__ && <Btn label="Reset (dev)" onPress={devReset} />}
            {__DEV__ && <Btn label="Debug" onPress={() => router.push('/debug')} />}
            {__DEV__ && <Btn label="Carte" onPress={() => router.push('/map')} />}
          </View>

          {__DEV__ && (
            <View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)',
                marginBottom: 10,
              }}
            >
              <Text style={[{ fontWeight: '700' }, textMuted]}>DEV MODE</Text>
            </View>
          )}

          {loading && <ActivityIndicator />}
          {error && <Text style={{ color: isDark ? 'rgba(255,120,120,0.95)' : 'rgba(180,40,40,0.95)', marginBottom: 8 }}>Erreur: {error}</Text>}

          <FlatList
            data={jobs}
            keyExtractor={(j) => j.id}
            contentContainerStyle={{ paddingBottom: 18 }}
            renderItem={({ item, index }) => {
              const acts = actionsFor(item);
              return (
                <FadeIn delay={index * 60}>
                  <View
                    style={{
                      padding: 14,
                      borderWidth: 1,
                      borderRadius: 18,
                      marginBottom: 12,
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
                    }}
                  >
                    <Text style={[{ fontWeight: '800', marginBottom: 6, fontSize: 16 }, textMain]}>{item.merchant}</Text>

                    <Text style={[{ marginBottom: 2 }, textMuted]}>Pickup: {item.pickup.address}</Text>
                    <Text style={[{ marginBottom: 8 }, textMuted]}>Dropoff: {item.dropoff.address}</Text>

                    <Text style={[{ marginBottom: 8, fontWeight: '700' }, textMain]}>
                      {item.distanceKm} km · {item.etaMin} min · {item.payout}€
                    </Text>

                    <Text style={[{ marginBottom: 10 }, textMuted]}>Statut: {item.status}</Text>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {acts.map((a, i) => (
                        <FadeIn key={a.lbl} delay={index * 60 + 80 + i * 40}>
                          <Pressable
                            onPress={() => call(a.path, `${a.lbl} OK`)}
                            style={{
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderWidth: 1,
                              borderRadius: 12,
                              marginRight: 8,
                              marginBottom: 8,
                              borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
                              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)',
                            }}
                          >
                            <Text style={{ fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)' }}>{a.lbl}</Text>
                          </Pressable>
                        </FadeIn>
                      ))}
                    </View>
                  </View>
                </FadeIn>
              );
            }}
            ListEmptyComponent={!loading ? <Text style={[{ paddingVertical: 10 }, textMuted]}>Aucune course disponible</Text> : null}
          />
        </View>
      </SafeAreaView>
    </AppBackground>
  );
}
EOF

echo "[6/6] Terminé ✅"
echo
echo "Fichiers écrits:"
echo " - $HOME_TSX"
echo " - $BG_TSX"
echo " - $CONFETTI_TSX"
echo " - $FADEIN_TSX"
echo
echo "Relance:"
if [ -x "$ROOT/dev-refresh-courier.sh" ]; then
  echo " - $ROOT/dev-refresh-courier.sh http://127.0.0.1:3010"
else
  echo " - (script absent) Lance manuellement:"
  echo "   cd $APP_DIR && npx expo start --clear"
fi
