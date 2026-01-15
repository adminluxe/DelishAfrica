import { useEffect, useState } from "react";
import { SafeAreaView, View, Text, FlatList, ActivityIndicator } from "react-native";

type Order = { id:string; status:string; total?:number };
const API = process.env.EXPO_PUBLIC_API_URL!;

export default function Orders() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Order[]>([]);
  useEffect(() => {
    (async () => {
      try {
        // TODO: branchement API réel
        setData([{id:"A-001", status:"pending", total:29.9}]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SafeAreaView>
      <View style={{padding:16}}>
        <Text style={{fontSize:22, fontWeight:"700"}}>Commandes</Text>
        {loading ? <ActivityIndicator style={{marginTop:12}}/> :
          <FlatList keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" data={data} keyExtractor={x=>x.id}
            contentContainerStyle={{paddingVertical:8}}
            renderItem={({item}) => (
              <View style={{padding:12, borderWidth:1, borderColor:"#eee", borderRadius:10, marginBottom:10}}>
                <Text style={{fontWeight:"600"}}>#{item.id}</Text>
                <Text style={{color:"#6b7280"}}>{item.status}</Text>
                {item.total != null && <Text>Total: €{item.total?.toFixed(2)}</Text>}
              </View>
            )}
            ListEmptyComponent={<Text style={{padding:16}}>Aucune commande pour l’instant.</Text>}
          />}
      </View>
    </SafeAreaView>
  );
}
