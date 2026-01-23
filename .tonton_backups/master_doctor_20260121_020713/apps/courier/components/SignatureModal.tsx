import React from 'react';
import { Modal, View, Pressable, Text, StyleSheet } from 'react-native';
import Signature from 'react-native-signature-canvas';

export default function SignatureModal({
  visible, onOK, onCancel
}: { visible:boolean; onOK:(dataUrl:string)=>void; onCancel:()=>void; }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={S.backdrop}>
        <View style={S.card}>
          <Text style={S.title}>Signature du client</Text>
          <View style={{height:260}}>
            <Signature
              onOK={onOK}
              onEmpty={() => {}}
              descriptionText="Signez ci-dessous"
              clearText="Effacer"
              confirmText="Valider"
              webStyle={`
                .m-signature-pad--footer { display:flex; gap:8px; }
              `}
            />
          </View>
          <Pressable style={S.btn} onPress={onCancel}><Text style={S.btnText}>Fermer</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
const S = StyleSheet.create({
  backdrop:{flex:1, backgroundColor:'rgba(0,0,0,0.5)', alignItems:'center', justifyContent:'center', padding:16},
  card:{ backgroundColor:'#fff', borderRadius:12, padding:12, width:'100%' },
  title:{ fontWeight:'800', fontSize:16, marginBottom:8, textAlign:'center'},
  btn:{ backgroundColor:'#111827', borderRadius:8, alignItems:'center', paddingVertical:10, marginTop:10 },
  btnText:{ color:'#fff', fontWeight:'700' }
});
