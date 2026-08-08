export const release = {
  production: import.meta.env.PUBLIC_DA_RELEASE_MODE === "production",
} as const;

export const site = {
  name: "DelishAfrica®",
  title: "DelishAfrica® — Le goût d’un continent, mis en mouvement",
  description: "Restaurants africains, récits culinaires et livraison orchestrée dans une expérience internationale.",
  url: "https://delishafrica.me",
  locale: "fr_FR",
  indexable: release.production,
  mode: release.production ? "" : "C6 · private production-candidate preview",
  supportEmail: "support@delishafrica.me",
} as const;

export const appGateways = {
  client: {
    label: "Client",
    scheme: "delishafricaclient://",
    web: "https://client.delishafrica.me",
    preparedPath: "/open/client/",
  },
  merchant: {
    label: "Merchant",
    scheme: "delishafricamerchant://",
    web: "https://merchant.delishafrica.me",
    preparedPath: "/open/merchant/",
  },
  courier: {
    label: "Courier",
    scheme: "delishafricacourier://",
    web: "https://courier.delishafrica.me",
    preparedPath: "/open/courier/",
  },
} as const;
