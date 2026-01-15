import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'DelishAfrica - Client',
  slug: 'delishafrica-client',
  owner: 'delishafrica',
  scheme: 'delishafrica.client',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  extra: {
    EXPO_PUBLIC_API_URL: 'https://api.delishafrica.me',
    eas: {
      projectId: "b9aebdae-10b4-4638-a576-a5f61352ea97",
    },
  },
  ios: {
    bundleIdentifier: 'me.delishafrica.client',
  },
  plugins: ['expo-router', 'expo-secure-store'],
};

export default config;
