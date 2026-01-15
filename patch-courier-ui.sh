#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/compose"
APP_DIR="$ROOT/apps/courier"
APP_APP_DIR="$APP_DIR/app"
APP_COMPONENTS_DIR="$APP_DIR/components"

HOME_FILE="$APP_APP_DIR/home.tsx"
CONFETTI_FILE="$APP_COMPONENTS_DIR/ConfettiBurst.tsx"
DEV_REFRESH_FILE="$ROOT/dev-refresh-courier.sh"

echo "[1/5] Prépare les dossiers…"
mkdir -p "$APP_APP_DIR" "$APP_COMPONENTS_DIR"

echo "[2/5] Écrit: $CONFETTI_FILE"
cat > "$CONFETTI_FILE" <<'EOF'
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

export type ConfettiBurstRef = {
  burst: () => void;
};

type Particle = {
  id: string;
  dx: number;
  dy: number;
  size: number;
  delay: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

const ConfettiBurst = forwardRef<ConfettiBurstRef, { x?: number; y?: number }>(function ConfettiBurst(
  { x, y },
  ref,
) {
  const [runId, setRunId] = useState<number>(0);
  const [visible, setVisible] = useState(false);

  const particles = useMemo<Particle[]>(() => {
    // 5 particules “ultra-light”
    const base = [
      { dx: -70, dy: -140 },
      { dx: -30, dy: -170 },
      { dx: 0,   dy: -190 },
      { dx: 30,  dy: -170 },
      { dx: 70,  dy: -140 },
    ];
    return base.map((p, i) => ({
      id: String(i),
      dx: p.dx + (Math.random() * 18 - 9),
      dy: p.dy + (Math.random() * 18 - 9),
      size: clamp(10 + Math.random() * 10, 10, 18),
      delay: i * 35,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const anims = useRef(
    Array.from({ length: 5 }, () => ({
      tx: new Animated.Value(0),
      ty: new Animated.Value(0),
      s: new Animated.Value(0.6),
      o: new Animated.Value(0),
    })),
  ).current;

  const burst = () => {
    setRunId(Date.now());
    setVisible(true);
  };

  useImperativeHandle(ref, () => ({ burst }), []);

  useEffect(() => {
    if (!visible) return;

    // reset
    anims.forEach((a) => {
      a.tx.setValue(0);
      a.ty.setValue(0);
      a.s.setValue(0.6);
      a.o.setValue(0);
    });

    const animations: Animated.CompositeAnimation[] = [];

    particles.forEach((p, i) => {
      const a = anims[i];
      animations.push(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.parallel([
            Animated.timing(a.o, {
              toValue: 1,
              duration: 120,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(a.tx, {
              toValue: p.dx,
              duration: 650,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(a.ty, {
              toValue: p.dy,
              duration: 650,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(a.s, {
              toValue: 1.15,
              duration: 650,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(a.o, {
            toValue: 0,
            duration: 220,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
    });

    Animated.parallel(animations).start(() => {
      setVisible(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, visible]);

  if (!visible) return null;

  // Position par défaut: centre haut (feel “🎉 livré”)
  const left = typeof x === 'number' ? x : undefined;
  const top = typeof y === 'number' ? y : undefined;

  return (
    <View pointerEvents="none" style={[styles.wrap, left !== undefined ? { left } : null, top !== undefined ? { top } : null]}>
      {particles.map((p, i) => {
        const a = anims[i];
        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                opacity: a.o,
                transform: [
                  { translateX: a.tx },
                  { translateY: a.ty },
                  { scale: a.s },
                  { rotate: `${(i - 2) * 12}deg` },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: '50%',
    top: 90,
    marginLeft: -8,
    width: 16,
    height: 16,
    zIndex: 9999,
  },
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
    // couleurs “confetti” soft (évite d’imposer une charte)
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
});

export default ConfettiBurst;
EOF

echo "[3/5] Écrit: $HOME_FILE"
cat > "$HOME_FILE" <<'EOF'
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, SafeAreaView, Pressable, Alert } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import FadeIn from '../components/FadeIn';
import ConfettiBurst, { ConfettiBurstRef } from '../components/ConfettiBurst';
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

const Btn = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => ({
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderRadius: 10,
      marginRight: 8,
      marginBottom: 8,
      opacity: pressed ? 0.65 : 1,
      backgroundColor: 'rgba(255,255,255,0.78)',
    })}
  >
    <Text style={{ fontWeight: '600' }}>{label}</Text>
  </Pressable>
);

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
  const confettiRef = useRef<ConfettiBurstRef | null>(null);

  const EXTRA = (Constants.expoConfig as any)?.extra || {};
  const API_RAW =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    EXTRA.API_BASE_URL ||
    'https://api.delishafrica.me';
  const API = useMemo(() => String(API_RAW).replace(/\/+$/, ''), [API_RAW]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);

  // Toast/bannière d’état légère
  const [banner, setBanner] = useState<string | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBanner = (msg: string) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner(msg);
    bannerTimer.current = setTimeout(() => setBanner(null), 2200);
  };

  const inFlight = useRef(false);

  const fetchMy = async (): Promise<Job[]> => {
    try {
      const data = await jfetch<{ items?: Job[] }>(`${API}/api/couriers/my`, { method: 'GET' });
      return data.items ?? [];
    } catch {
      return [];
    }
  };

  const load = async (silent = false) => {
    if (inFlight.current) return;
    inFlight.current = true;

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
      inFlight.current = false;
    }
  };

  const call = async (path: string, okMsg: string) => {
    try {
      await jfetch(`${API}${path}`, { method: 'POST' });

      const delivered = path.endsWith('/delivered');
      if (delivered) {
        showBanner('Livré 🎉');
        confettiRef.current?.burst();
      } else {
        showBanner(okMsg);
      }

      await load(true);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Action échouée');
    }
  };

  const devReset = async () => {
    try {
      await jfetch(`${API}/api/couriers/reset`, { method: 'POST' });
      showBanner('Reset effectué ✅');
      await load(true);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Reset échoué');
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
    load(false);

    // Polling 5s (silencieux)
    const itv = setInterval(() => {
      load(true);
    }, 5000);

    return () => {
      clearInterval(itv);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppBackground variant="routes" opacity={0.12} gradient>
      {/* Confetti overlay (ultra light) */}
      <ConfettiBurst ref={confettiRef} />

      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        {/* Toast premium soft */}
        {banner && (
          <View
            style={{
              backgroundColor: 'rgba(230,255,230,0.92)',
              borderColor: 'rgba(60,160,60,0.35)',
              borderWidth: 1,
              padding: 10,
              borderRadius: 12,
              marginBottom: 10,
            }}
          >
            <Text style={{ color: '#1f6b1f', fontWeight: '700' }}>{banner}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
          <Btn label="Rafraîchir" onPress={() => load(false)} />
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
              borderColor: 'rgba(0,0,0,0.12)',
              backgroundColor: 'rgba(255,255,255,0.70)',
              marginBottom: 10,
            }}
          >
            <Text style={{ fontWeight: '800' }}>DEV MODE</Text>
          </View>
        )}

        {loading && <ActivityIndicator />}
        {error && <Text style={{ color: 'red', marginBottom: 8 }}>Erreur: {error}</Text>}

        <FlatList
          data={jobs}
          keyExtractor={(j) => j.id}
          renderItem={({ item, index }) => {
            const acts = actionsFor(item);

            return (
              <FadeIn delay={index * 60}>
                <View
                  style={{
                    padding: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.10)',
                    borderRadius: 16,
                    marginBottom: 12,
                    backgroundColor: 'rgba(255,255,255,0.80)',
                  }}
                >
                  <Text style={{ fontWeight: '900', marginBottom: 6, fontSize: 16 }}>{item.merchant}</Text>

                  <Text style={{ opacity: 0.9 }}>📍 Pickup: {item.pickup.address}</Text>
                  <Text style={{ opacity: 0.9 }}>🏁 Dropoff: {item.dropoff.address}</Text>

                  <Text style={{ marginVertical: 8, fontWeight: '700' }}>
                    {item.distanceKm} km · {item.etaMin} min · {item.payout}€
                  </Text>

                  <Text style={{ marginBottom: 8, opacity: 0.85 }}>Statut: {item.status}</Text>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {acts.map((a, i) => (
                      <FadeIn key={a.lbl} delay={index * 60 + 100 + i * 40}>
                        <Pressable
                          onPress={() => call(a.path, `${a.lbl} OK`)}
                          style={({ pressed }) => ({
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderWidth: 1,
                            borderRadius: 12,
                            marginRight: 8,
                            marginBottom: 8,
                            opacity: pressed ? 0.62 : 1,
                            backgroundColor: a.lbl === 'Livré' ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.78)',
                          })}
                        >
                          <Text style={{ fontWeight: '800' }}>{a.lbl}</Text>
                        </Pressable>
                      </FadeIn>
                    ))}
                  </View>
                </View>
              </FadeIn>
            );
          }}
          ListEmptyComponent={!loading ? <Text style={{ opacity: 0.8 }}>Aucune course disponible</Text> : null}
        />
      </SafeAreaView>
    </AppBackground>
  );
}
EOF

echo "[4/5] Patch: pm2 restart --update-env dans $DEV_REFRESH_FILE (si présent)"
if [ -f "$DEV_REFRESH_FILE" ]; then
  if grep -q "pm2 restart delish-api" "$DEV_REFRESH_FILE" && ! grep -q -- "--update-env" "$DEV_REFRESH_FILE"; then
    # remplace juste la ligne, sans tout réécrire
    sed -i 's/pm2 restart delish-api/pm2 restart delish-api --update-env/' "$DEV_REFRESH_FILE"
    echo "  OK: --update-env ajouté"
  else
    echo "  Rien à patcher (ou déjà OK)"
  fi
else
  echo "  (skip) dev-refresh-courier.sh introuvable"
fi

echo "[5/5] Terminé ✅"
echo "Ensuite relance:"
echo "  $ROOT/dev-refresh-courier.sh http://127.0.0.1:3010"
echo "ou"
echo "  $ROOT/dev-refresh-courier.sh https://api.delishafrica.me"
EOF

chmod +x /opt/delishafrica/compose/patch-courier-ui.sh
