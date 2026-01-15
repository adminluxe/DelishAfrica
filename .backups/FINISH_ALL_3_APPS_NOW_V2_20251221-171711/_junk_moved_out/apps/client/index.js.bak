import { registerRootComponent } from 'expo';
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL; // <- injecté au bundle (prefix EXPO_PUBLIC_)
console.log('Delish Runtime API_URL =', API_URL);
globalThis.__DELISH_API_URL__ = API_URL;

function App(){
  const [health,setHealth] = useState('…');
  useEffect(()=>{
    fetch(`${API_URL}/api/health`)
      .then(r=>r.json()).then(j=>setHealth(JSON.stringify(j)))
      .catch(()=>setHealth('unreachable'));
  },[]);
  return (
    <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}>
      <Text style={{fontSize:22,fontWeight:'700'}}>DelishAfrica — Client (Rescue)</Text>
      <Text style={{marginTop:6}}>API: {API_URL}</Text>
      <Text style={{marginTop:6}}>Health: {health}</Text>
    </View>
  );
}
registerRootComponent(App);
