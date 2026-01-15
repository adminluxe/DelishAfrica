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
    <AppBackground app="courier">
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
    </AppBackground>
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

          <FlatList keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
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
