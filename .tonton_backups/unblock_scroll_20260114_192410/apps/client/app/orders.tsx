import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function Orders() {
  return (
    <View style={styles.screen}>
      <View style={styles.safe}>
        <Text style={styles.kicker}>THIEYP • COMMANDE</Text>
        <Text style={styles.h1}>Commande créée.</Text>
        <Text style={styles.sub}>Flux UI prêt. Backend sera branché ensuite.</Text>

        <View style={styles.card}>
          <Text style={styles.title}>État</Text>
          <Text style={styles.line}>✔ Commande créée</Text>
          <Text style={styles.line}>⏳ En préparation</Text>
        </View>

        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => router.back()}>
            <Text style={styles.btnText}>Retour</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => { /* next step later */ }}>
            <Text style={[styles.btnText, styles.btnTextDark]}>Suivre la livraison</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{ flex:1, backgroundColor:"#070A10" },
  safe:{ flex:1, paddingHorizontal:18, paddingTop:64, paddingBottom:24 },
  kicker:{ color:"#2ED06E", letterSpacing:4, fontSize:12, fontWeight:"900" },
  h1:{ color:"#F4F7FF", fontSize:40, fontWeight:"900", marginTop:10 },
  sub:{ color:"#9AA6C5", fontSize:18, fontWeight:"700", marginTop:8 },

  card:{
    backgroundColor:"rgba(255,255,255,0.04)",
    borderColor:"rgba(255,255,255,0.10)",
    borderWidth:1,
    borderRadius:22,
    padding:16,
    marginTop:18
  },
  title:{ color:"rgba(255,255,255,0.75)", fontWeight:"900", fontSize:16 },
  line:{ color:"#F4F7FF", fontWeight:"800", fontSize:18, marginTop:10 },

  row:{ flexDirection:"row", gap:12, marginTop:18 },
  btn:{ flex:1, height:56, borderRadius:18, alignItems:"center", justifyContent:"center" },
  btnPrimary:{ backgroundColor:"#2ED06E" },
  btnGhost:{ borderWidth:1, borderColor:"rgba(255,255,255,0.18)", backgroundColor:"rgba(0,0,0,0.15)" },
  btnText:{ color:"#F4F7FF", fontSize:16, fontWeight:"900" },
  btnTextDark:{ color:"#07110A" },
});
