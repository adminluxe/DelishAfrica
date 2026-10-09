import * as SecureStore from 'expo-secure-store';
import { GuestCheckoutDraftVault } from './guestCheckoutDraftVault';

/** Device-only protected storage for the temporary checkout capability.
 * Never use AsyncStorage, URLs or analytics to persist this bearer token.
 */
export const guestCheckoutDraftVault = new GuestCheckoutDraftVault({
  getItemAsync: (key) => SecureStore.getItemAsync(key),
  setItemAsync: (key, value) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
});
