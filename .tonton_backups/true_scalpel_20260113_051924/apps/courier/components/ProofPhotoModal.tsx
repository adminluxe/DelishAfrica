import React, { useState } from 'react';
import { Modal, View, Text, Pressable, Image, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

type Props = {
  visible: boolean;
  onClose?: () => void;          // <- optionnel avec no-op
  jobId: string;
  onUploaded?: (url: string) => void;
  apiBase: string;
};

export default function ProofPhotoModal({ visible, onClose, jobId, onUploaded, apiBase }: Props) {
  const close = () => (onClose ? onClose() : undefined);
  const [uri, setUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const pick = async () => {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (cam.status !== 'granted') return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!r.canceled && r.assets?.[0]?.uri) setUri(r.assets[0].uri);
  };

  const send = async () => {
    if (!uri) return;
    try {
      setSending(true);
      const name = `proof_${jobId}.jpg`;
      const form = new FormData();
      form.append('file', {
        uri: uri,
        name,
        type: 'image/jpeg',
      } as any);

      // Ne PAS fixer Content-Type: laissez fetch mettre le boundary
      const res = await fetch(`${apiBase}/api/couriers/jobs/${jobId}/proof`, {
        method: 'POST',
        body: form,
      });

      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.url) {
        onUploaded?.(j.url);
        close();
      } else {
        alert(j?.message || 'Envoi impossible');
        close();
      }
    } catch (e) {
      console.error(e);
      alert('Réseau indisponible');
      close();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={close}>
      <View style={S.backdrop}>
        <View style={S.card}>
          <Text style={S.title}>Preuve de remise (Photo)</Text>
          {!uri ? (
            <Pressable style={S.btn} onPress={pick}><Text style={S.btnText}>Prendre une photo</Text></Pressable>
          ) : (
            <>
              <Image source={{ uri }} style={{ width: 240, height: 240, borderRadius: 12 }} />
              <Pressable style={[S.btn,{marginTop:12}]} onPress={send} disabled={sending}>
                {sending ? <ActivityIndicator/> : <Text style={S.btnText}>Envoyer</Text>}
              </Pressable>
            </>
          )}
          <Pressable style={[S.btnGhost,{marginTop:8}]} onPress={close}><Text>Annuler</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
const S = StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'center',alignItems:'center'},
  card:{backgroundColor:'#fff',padding:16,borderRadius:16,width:300,alignItems:'center'},
  title:{fontSize:18,fontWeight:'600',marginBottom:12},
  btn:{backgroundColor:'#111827',paddingVertical:10,paddingHorizontal:14,borderRadius:10},
  btnText:{color:'#fff',fontWeight:'600'},
  btnGhost:{paddingVertical:8,paddingHorizontal:10}
});
