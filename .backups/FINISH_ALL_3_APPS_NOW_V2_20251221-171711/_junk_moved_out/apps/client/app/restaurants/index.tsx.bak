import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, Text, View } from "react-native";
const API = process.env.EXPO_PUBLIC_API_URL!;
type R = { id:string; name?:string; city?:string };
export default function Restaurants(){
  const [data,setData]=useState<R[]>([]), [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{try{
    const r=await fetch(`${API}/api/restaurants?limit=50`); const j=await r.json();
    setData(j?.items ?? j ?? []);}catch{} finally{setLoading(false);}})();},[]);
  return <SafeAreaView style={{flex:1}}>
    <View style={{padding:16}}><Text style={{fontSize:22,fontWeight:"700"}}>Restaurants</Text></View>
    {loading ? <ActivityIndicator style={{marginTop:20}}/> :
      <FlatList data={data} keyExtractor={x=>x.id} contentContainerStyle={{padding:16}}
        renderItem={({item})=>(
          <Pressable style={{padding:16, borderWidth:1, borderColor:"#eee", borderRadius:12, marginBottom:12}}>
            <Text style={{fontWeight:"600"}}>{item.name ?? "(sans nom)"}</Text>
            <Text style={{color:"#6b7280"}}>{item.city ?? "—"}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{padding:16}}>Aucun resto pour l’instant.</Text>}
      />}
  </SafeAreaView>;
}
