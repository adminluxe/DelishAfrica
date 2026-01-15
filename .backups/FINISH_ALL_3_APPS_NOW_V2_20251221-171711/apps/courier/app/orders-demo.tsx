import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Link } from "expo-router";

export default function OrdersDemo() {
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 22 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 10 }}>
        Démo — Commander
      </Text>

      <Text style={{ opacity: 0.7, marginBottom: 18, lineHeight: 20 }}>
        Choisis une destination. Si une route n’existe pas encore dans l’app, tu le verras
        immédiatement, mais au moins le bouton “Commander (démo)” ouvrira toujours cet écran.
      </Text>

      <Link href="/" asChild>
        <Pressable
          style={{
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Accueil</Text>
          <Text style={{ opacity: 0.7, marginTop: 4 }}>Retour à l’accueil (route “/”).</Text>
        </Pressable>
      </Link>

      <Link href="/thieyp" asChild>
        <Pressable
          style={{
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            backgroundColor: "rgba(255,215,0,0.10)",
            borderWidth: 1,
            borderColor: "rgba(255,215,0,0.22)",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Menu Thieyp</Text>
          <Text style={{ opacity: 0.75, marginTop: 4 }}>
            Si la route /thieyp existe, c’est la démo parfaite.
          </Text>
        </Pressable>
      </Link>

      <Link href="/orders" asChild>
        <Pressable
          style={{
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            backgroundColor: "rgba(147,51,234,0.10)",
            borderWidth: 1,
            borderColor: "rgba(147,51,234,0.22)",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Orders</Text>
          <Text style={{ opacity: 0.75, marginTop: 4 }}>
            Si la route /orders existe, tu arrives sur la liste/flux de commandes.
          </Text>
        </Pressable>
      </Link>

      <View style={{ height: 20 }} />
      <Text style={{ opacity: 0.55, fontSize: 12 }}>
        Tip: si /thieyp ou /orders n’existent pas, on recâble ensuite vers la vraie route (1 min).
      </Text>
    </ScrollView>
  );
}
