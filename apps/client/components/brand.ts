export type BrandKey = 'courier' | 'client' | 'merchant';

export const brand = {
  courier: {
    name: 'DelishAfrica',
    accent: '#0DBE7D',
    accent2: '#1A8C7F',
    bgDark: ['#070709', '#0B0B10', '#10101A'],
    bgLight: ['#F8FFFC', '#F3FBFF', '#F0F5FF'],
  },
  client: {
    name: 'DelishAfrica',
    accent: '#3B82F6',
    accent2: '#22D3EE',
    bgDark: ['#070B12', '#0B1220', '#0A1628'],
    bgLight: ['#F7FBFF', '#F1F7FF', '#EEF6FF'],
  },
  merchant: {
    name: 'DelishAfrica',
    accent: '#B45309',  // terre cuite
    accent2: '#F59E0B', // braise
    bgDark: ['#0A0707', '#120B0B', '#180F10'],
    bgLight: ['#FFF7F2', '#FFF2E8', '#FFF8F3'],
  },
} as const;
