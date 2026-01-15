// DelishAfrica – Courier (Home)
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, SafeAreaView, FlatList } from "react-native";

const API = process.env.EXPO_PUBLIC_API_URL!;

export default function Home(){
  const [health,setHealth] = useState("no");
  const [data,setData] = useState<any[]>([]);
  const [loading,setLoading] = useState(false);
  useEffect(()=>{ fetch(`${API}/api/health`).then(r=>r.json()).then(()=>setHealth("ok")).catch(()=>setHealth("nok")); },[]);
  useEffect(()=>{ (async()=>{ setLoading(true); try{ const r=await fetch(`${API}/api/courier/jobs?limit=5`); const j=await r.json(); setData(j.items??[]);}catch{} finally{setLoading(false);} })(); },[]);

  return (
    <SafeAreaView style={{flex:1,padding:16}}>
      <Text style={{fontSize:22,fontWeight:"700"}}>DelishAfrica – Courier</Text>
      <Text style={{marginTop:8}}>API: {API}</Text>
      <Text>Health: {health}</Text>
      {loading && <ActivityIndicator style={{marginTop:16}}/>}
      <FlatList data={data} keyExtractor={(x)=>String(x.id)}
        contentContainerStyle={{paddingVertical:12}}
        renderItem={({item})=> (<View style={{padding:10,borderWidth:1,borderColor:'#eee',borderRadius:12,marginBottom:12}}>
          <Text style={{fontWeight:"600"}}>{String(item.id).slice(0,8)}</Text>
          <Text style={{color:'#6b7280'}}>{item.status ?? '-'}</Text>
        </View>)}
        ListEmptyComponent={<Text style={{padding:10}}>Aucune mission pour l’instant.</Text>}
      />
    </SafeAreaView>
  );
}
