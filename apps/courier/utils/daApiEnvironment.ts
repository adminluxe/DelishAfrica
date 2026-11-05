import Constants from 'expo-constants';
import { assertApiRequestTarget, resolveApiEnvironment } from '../../../packages/contracts/src/apiEnvironment';
// Expo only inlines direct process.env.EXPO_PUBLIC_* property reads.
export function daApiEnvironment() {
  const extra = Constants.expoConfig?.extra || {};
  return resolveApiEnvironment({
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    releaseRing: process.env.EXPO_PUBLIC_RELEASE_RING,
    nativeApiBaseUrl: extra.EXPO_PUBLIC_API_BASE_URL,
    nativeApiUrl: extra.EXPO_PUBLIC_API_URL,
    nativeReleaseRing: extra.EXPO_PUBLIC_RELEASE_RING,
    development: typeof __DEV__ !== 'undefined' && __DEV__,
  });
}
export function daApiBase(): string { return daApiEnvironment().baseUrl; }
export function daApiOrigin(): string { return daApiEnvironment().origin; }
export function daApiScope(): string { return daApiEnvironment().scope; }
export function daAssertApiRequest(input: RequestInfo | URL): string {
  return assertApiRequestTarget(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url, daApiEnvironment());
}
