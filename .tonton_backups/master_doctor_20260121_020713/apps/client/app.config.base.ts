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
    eas: { e7d6f-559b-4536-81a9-fbc0dbc0c68f' }
  }
};
export default config;
#tonton_write_test 2026-01-17T21:56:58+01:00
#tonton_unlock_ok 20260117_215717
