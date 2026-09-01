import React, { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { certifyHf16RealIdentity, hf16ExpectedIdentity, type Hf16IdentityResult } from '../auth/daHf16RealOidc';

const LABEL = 'Courier';
const EXPECTED = hf16ExpectedIdentity();

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#174b43' }}>
      <Text style={{ color: '#d7e3dc', fontSize: 16, flex: 1 }}>{label}</Text>
      <Text style={{ color: '#76ebc7', fontSize: 16, fontWeight: '800', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export default function Hf16IdentityScreen() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Hf16IdentityResult | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try { setResult(await certifyHf16RealIdentity()); } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#002f2a' }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 56 }}>
        <Text style={{ color: '#e5b45f', letterSpacing: 5, fontSize: 16, fontWeight: '900' }}>DELISHAFRICA®</Text>
        <Text style={{ color: '#fff7e8', fontSize: 42, lineHeight: 46, fontWeight: '900', marginTop: 18 }}>HF16 · Identité {LABEL}</Text>
        <Text style={{ color: '#a9c4bb', fontSize: 18, lineHeight: 27, marginTop: 16 }}>
          Authorization Code + PKCE S256 via navigateur système. Le login est forcé vers le compte d’acceptance dédié. Aucun token n’est affiché ni exporté.
        </Text>

        <View style={{ marginTop: 20, borderWidth: 1, borderColor: '#2a685d', borderRadius: 22, padding: 16 }}>
          <Text style={{ color: '#e5b45f', fontSize: 14, fontWeight: '900', letterSpacing: 2 }}>COMPTE ATTENDU</Text>
          <Text selectable style={{ color: '#fff7e8', fontSize: 19, fontWeight: '900', marginTop: 8 }}>{EXPECTED.username}</Text>
          <Text style={{ color: '#a9c4bb', fontSize: 14, lineHeight: 21, marginTop: 6 }}>Le mot de passe est fourni uniquement dans le fichier privé Toshiba généré par la salve HF16 S3.</Text>
        </View>

        <Pressable onPress={run} disabled={busy} style={{ marginTop: 28, borderRadius: 28, backgroundColor: '#55c8dc', paddingVertical: 22, paddingHorizontal: 20, opacity: busy ? 0.65 : 1 }}>
          {busy ? <ActivityIndicator /> : <Text style={{ textAlign: 'center', color: '#022923', fontSize: 20, fontWeight: '900' }}>Certifier l’identité {LABEL}</Text>}
        </Pressable>

        {result && (
          <View style={{ marginTop: 28, borderWidth: 1, borderColor: result.ok ? '#33d3aa' : '#e5b45f', borderRadius: 28, padding: 20 }}>
            <Text style={{ color: result.ok ? '#76ebc7' : '#e5b45f', fontSize: 24, fontWeight: '900' }}>{result.ok ? 'IDENTITÉ VALIDÉE' : 'STOP SAFE'}</Text>
            <Row label="API rôle" value={String(result.apiMe)} />
            <Row label="Frontière Client" value={String(result.clientBoundary)} />
            <Row label="Frontière rôle croisé" value={String(result.crossRoleBoundary)} />
            <Row label="Rôle Keycloak" value={result.realmRole ? 'PASS' : 'FAIL'} />
            <Row label="Audience application" value={result.audienceMatch ? 'PASS' : 'FAIL'} />
            <Row label="Authorized party" value={result.authorizedParty ? 'PASS' : 'FAIL'} />
            <Row label="Compte acceptance" value={result.expectedUser ? 'PASS' : 'FAIL'} />
            <Row label="Subject" value={result.subjectPresent ? 'PASS' : 'FAIL'} />
            {!!result.username && <Row label="Compte reçu" value={result.username} />}
            {!!result.apiReason && result.apiMe !== 200 && <Row label="Code API" value={result.apiReason} />}
            {!!result.proof && <Text selectable style={{ color: '#76ebc7', fontSize: 16, lineHeight: 24, fontWeight: '900', marginTop: 18 }}>{result.proof}</Text>}
            {!!result.reason && <Text selectable style={{ color: '#e5b45f', fontSize: 15, lineHeight: 22, marginTop: 14 }}>{result.reason}</Text>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
