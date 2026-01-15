// apps/client/src/config/api.ts
const RAW = process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.delishafrica.me";

// On supprime un éventuel / final pour éviter les // dans les URLs
export const API_BASE_URL = RAW.replace(/\/$/, "");

// URL de l'endpoint de healthcheck
export const healthUrl = `${API_BASE_URL}/api/health`;
