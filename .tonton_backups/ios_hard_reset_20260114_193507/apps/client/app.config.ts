import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "DelishAfrica - Client",
  slug: "delishafrica-client",
  owner: "delishafrica",
  scheme: "delishafricaclient",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  extra: {
    EXPO_PUBLIC_API_URL: "https://api.delishafrica.me/api/v1",
    eas: { projectId: "de3e6023-5b7d-400a-8977-8008c096d555" },
  },
  ios: {
    bundleIdentifier: "me.delishafrica.client",
  },
  android: {
    package: "com.delishafrica.client",
  },
  plugins: ["expo-router", "expo-secure-store"],
};

export default config;
