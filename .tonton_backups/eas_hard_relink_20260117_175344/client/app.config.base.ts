import { ExpoConfig } from 'expo';
const config: ExpoConfig = {
  owner: 'delishafrica',
  name: 'DelishAfrica Client',
  slug: 'delishafrica-client',
  scheme: 'delishafrica-client',
  ios: {
    bundleIdentifier: 'me.delishafrica.client',
    infoPlist: { ITSAppUsesNonExemptEncryption: false }
  },
  android: { package: 'me.delishafrica.client' },
  extra: {
    API_BASE_URL: process.env.API_BASE_URL ?? 'https://api.delishafrica.me/api/v1',
    eas: { projectId: 'b63a37af-f832-4c16-bc10-3f384d5ea2b3' }
  }
};
export default config;
