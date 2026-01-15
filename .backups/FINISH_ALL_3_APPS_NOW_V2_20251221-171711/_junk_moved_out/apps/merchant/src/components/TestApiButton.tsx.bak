import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { API_BASE_URL, healthUrl } from "../config/api";

type Status = "idle" | "loading" | "ok" | "error";

export const TestApiButton: React.FC = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleTest = async () => {
    try {
      setStatus("loading");
      setMessage(null);

      const res = await fetch(healthUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      let payload: any = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      setStatus("ok");
      setMessage(payload?.status ?? "OK");
    } catch (error: any) {
      setStatus("error");
      setMessage(error?.message ?? "Erreur inconnue");
    }
  };

  const color =
    status === "ok" ? "#16a34a" : status === "error" ? "#dc2626" : "#6b7280";

  return (
    <View
      style={{
        marginTop: 24,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e5e7eb",
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
        Test API
      </Text>
      <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
        API_BASE_URL = {API_BASE_URL}
      </Text>

      <TouchableOpacity
        onPress={handleTest}
        disabled={status === "loading"}
        style={{
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 999,
          backgroundColor: "#111827",
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {status === "loading" && (
          <ActivityIndicator size="small" color="#f9fafb" />
        )}
        <Text style={{ color: "#f9fafb", fontWeight: "600" }}>
          {status === "loading" ? "Test en cours..." : "Tester l’API"}
        </Text>
      </TouchableOpacity>

      <View style={{ marginTop: 12 }}>
        {status === "idle" && (
          <Text style={{ fontSize: 12, color: "#6b7280" }}>
            Appuie pour vérifier que l’API répond bien.
          </Text>
        )}
        {status !== "idle" && (
          <Text style={{ fontSize: 13, fontWeight: "500", color }}>
            Statut : {status.toUpperCase()}
            {message ? ` – ${message}` : ""}
          </Text>
        )}
      </View>
    </View>
  );
};
