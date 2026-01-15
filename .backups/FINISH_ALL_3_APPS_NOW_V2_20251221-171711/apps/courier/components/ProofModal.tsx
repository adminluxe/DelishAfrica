import React, { useRef, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Signature from 'react-native-signature-canvas'; // Expo OK (WebView)
type Props = { visible:boolean; onClose:()=>void; onSubmit:(b64:string)=>Promise<void>; jobId:string; };
export default function ProofModal({visible,onClose,onSubmit,jobId}:Props){
  const [busy,setBusy]=useState(false);
  const onOK = async (signatureB64:string) => {
    try { setBusy(true); await onSubmit(signatureB64); Alert.alert('Preuve envoyée ✅'); onClose(); }
    catch(e:any){ Alert.alert('Échec envoi', String(e?.message||e)); }
    finally{ setBusy(false); }
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={S.backdrop}>
        <View style={S.card}>
          <Text style={S.h1}>Signature de réception</Text>
          <View style={{height:260, borderRadius:12, overflow:'hidden', backgroundColor:'#fff'}}>
            <Signature
              onOK={onOK}
              onEmpty={()=>Alert.alert('Signature vide','Merci de signer.')}
              descriptionText="Signez ici"
              clearText="Effacer" confirmText="Valider"
              webStyle=".m-signature-pad--footer {display:flex; gap:12px;}"
            />
          </View>
          <View style={S.row}>
            <Pressable onPress={onClose} style={[S.btn,S.gray]}><Text style={S.btnt}>Annuler</Text></Pressable>
            <View style={{minWidth:100, alignItems:'center', justifyContent:'center'}}>
              {busy && <ActivityIndicator/>}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const S = StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.35)',alignItems:'center',justifyContent:'center',padding:16},
  card:{width:'100%',maxWidth:520,backgroundColor:'#F7F7F7',borderRadius:16,padding:16},
  h1:{fontSize:18,fontWeight:'700',marginBottom:12},
  row:{flexDirection:'row',justifyContent:'space-between',marginTop:12},
  btn:{paddingVertical:12,paddingHorizontal:16,borderRadius:10},
  gray:{backgroundColor:'#3F3F46'}, btnt:{color:'#fff',fontWeight:'700'}
});
