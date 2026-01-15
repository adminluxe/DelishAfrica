import * as SecureStore from 'expo-secure-store';
const K_ACCESS='da_courier_token';
const K_REFRESH='da_courier_refresh';

export async function setTokens(access:string, refresh?:string){
  await SecureStore.setItemAsync(K_ACCESS, access);
  if (refresh) await SecureStore.setItemAsync(K_REFRESH, refresh);
}
export async function getToken(){ try{ return await SecureStore.getItemAsync(K_ACCESS); }catch{ return null; } }
export async function getRefresh(){ try{ return await SecureStore.getItemAsync(K_REFRESH); }catch{ return null; } }
export async function clearToken(){ await SecureStore.deleteItemAsync(K_ACCESS); await SecureStore.deleteItemAsync(K_REFRESH); }
