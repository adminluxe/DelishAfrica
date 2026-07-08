// apps/merchant/src/config/api.ts
const RAW = process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.delishafrica.me";

export const API_BASE_URL = RAW.replace(/\/$/, "");
export const healthUrl = `${API_BASE_URL}/api/health`;
