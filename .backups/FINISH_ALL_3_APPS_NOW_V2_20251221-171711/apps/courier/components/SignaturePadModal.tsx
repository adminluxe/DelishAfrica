import React from 'react';
import { Modal, View, Pressable, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const HTML = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" />
<style>html,body{margin:0;height:100%;}#c{border:1px solid #e5e7eb;border-radius:8px;touch-action:none}</style>
</head><body>
<canvas id="c"></canvas>
<div style="display:flex;gap:8px;margin-top:8px;">
  <button id="clear">Effacer</button>
  <button id="ok">Valider</button>
</div>
<script>
const c=document.getElementById('c'), ctx=c.getContext('2d');
function resize(){ c.width=window.innerWidth-24; c.height=260; ctx.lineWidth=2; ctx.lineCap='round'; }
resize(); window.onresize=resize;
let d=false, lx=0, ly=0;
function pos(e){ const t=c.getBoundingClientRect(); const x=(e.touches?e.touches[0].clientX:e.clientX)-t.left; const y=(e.touches?e.touches[0].clientY:e.clientY)-t.top; return {x,y}; }
c.addEventListener('mousedown',e=>{d=true; const p=pos(e); lx=p.x; ly=p.y;});
c.addEventListener('mousemove',e=>{ if(!d) return; const p=pos(e); ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(p.x,p.y); ctx.stroke(); lx=p.x; ly=p.y;});
c.addEventListener('mouseup',()=>d=false);
c.addEventListener('mouseleave',()=>d=false);
c.addEventListener('touchstart',e=>{d=true; const p=pos(e); lx=p.x; ly=p.y;}, {passive:false});
c.addEventListener('touchmove',e=>{ if(!d) return; e.preventDefault(); const p=pos(e); ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(p.x,p.y); ctx.stroke(); lx=p.x; ly=p.y;}, {passive:false});
c.addEventListener('touchend',()=>d=false);

document.getElementById('clear').onclick=()=>{ ctx.clearRect(0,0,c.width,c.height); };
document.getElementById('ok').onclick=()=>{ const dataUrl=c.toDataURL('image/png'); window.ReactNativeWebView.postMessage(JSON.stringify({dataUrl})); };
</script></body></html>`;

export default function SignaturePadModal({
  visible, onOK, onCancel
}: { visible: boolean; onOK: (dataUrl: string) => void; onCancel: () => void; }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={S.backdrop}>
        <View style={S.card}>
          <Text style={S.title}>Signature du client</Text>
          <WebView
            originWhitelist={['*']}
            source={{ html: HTML }}
            style={{ height: 320, borderRadius: 10 }}
            onMessage={(e) => {
              try {
                const { dataUrl } = JSON.parse(e.nativeEvent.data || '{}');
                if (dataUrl) onOK(dataUrl);
              } catch {}
            }}
          />
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
