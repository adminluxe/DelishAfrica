import { useEffect, useState } from "react";
import { SafeAreaView, View, Text, FlatList, ActivityIndicator } from "react-native";

type Mission = { id:string; title:string; status:string };
const API = process.env.EXPO_PUBLIC_API_URL!;

export default function Missions() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Mission[]>([]);
  useEffect(() => {
    (async () => {
      try {
        // TODO: branchement API réel
        setData([{id:"1", title:"Pickup Chez A", status:"new"}]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SafeAreaView>
      <View style={{padding:16}}>
        <Text style={{fontSize:22, fontWeight:"700"}}>Missions</Text>
        {loading ? <ActivityIndicator style={{marginTop:12}}/> :
          <FlatList keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" data={data} keyExtractor={x=>x.id}
            contentContainerStyle={{paddingVertical:8}}
            renderItem={({item}) => (
              <View style={{padding:12, borderWidth:1, borderColor:"#eee", borderRadius:10, marginBottom:10}}>
                <Text style={{fontWeight:"600"}}>{item.title}</Text>
                <Text style={{color:"#6b7280"}}>{item.status}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={{padding:16}}>Aucune mission pour l’instant.</Text>}
          />}
      </View>
    </SafeAreaView>
  );
}
