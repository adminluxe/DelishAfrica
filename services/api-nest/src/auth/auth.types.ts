export type DaAuthRole = 'client' | 'merchant' | 'courier' | 'ops';

export type DaAuthUser = {
  id: string;
  role: DaAuthRole;
  name: string;
  email?: string;
  merchantSlug?: string;
  courierId?: string;
  clientId?: string;
  opsScope?: string[];
};

export type DaAuthTokenPayload = {
  sub: string;
  role: DaAuthRole;
  name: string;
  email?: string;
  merchantSlug?: string;
  courierId?: string;
  clientId?: string;
  opsScope?: string[];
  iat: number;
  exp: number;
  iss: 'delishafrica-api';
  aud: 'delishafrica-apps';
};
