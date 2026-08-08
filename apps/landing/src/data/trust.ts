export const trustPrinciples = [
  { code: "01", title: "Culture visible", text: "Le restaurant, le plat et l’origine restent identifiables tout au long du parcours." },
  { code: "02", title: "Paiement séparé", text: "La landing prépare l’intention. Les opérations de paiement restent dans les parcours sécurisés prévus à cet effet." },
  { code: "03", title: "Statuts humains", text: "Commande reçue, cuisine, prête, en route, livrée : chaque étape est racontée sans jargon." },
  { code: "04", title: "Données minimisées", text: "Les données sensibles et les documents d’identité ne sont jamais exposés dans les pages éditoriales publiques." },
  { code: "05", title: "Partenaires accompagnés", text: "L’onboarding Merchant et Courier est progressif, contrôlé et distinct de la vitrine publique." },
  { code: "06", title: "Accessibilité durable", text: "Contrastes, navigation clavier, mouvement réduit et hiérarchie sémantique font partie du produit." },
] as const;

export const statusTimeline = [
  { status: "Reçue", detail: "La commande est enregistrée et transmise au restaurant." },
  { status: "Cuisine", detail: "Le restaurant accepte et prépare la commande." },
  { status: "Prête", detail: "La commande attend une prise en charge coursier." },
  { status: "En route", detail: "Le coursier a récupéré la commande." },
  { status: "Livrée", detail: "La remise est confirmée dans le parcours de suivi." },
] as const;

export const confidenceFactsPrivate = [
  { label: "Paiement", value: "Stripe TEST validé", note: "Le wording public final sera adapté avant mise en ligne." },
  { label: "Commande", value: "Verticale validée", note: "Client → Merchant → Courier → suivi." },
  { label: "Coursier", value: "KYC séparé", note: "Le futur intake restera derrière un contrat versionné." },
  { label: "Publication", value: "Privée", note: "DNS, Cloudflare et nginx public restent inchangés." },
] as const;

export const confidenceFactsPublic = [
  { label: "Landing", value: "Éditoriale", note: "Aucun compte, paiement ou document d’identité n’est traité dans ces pages." },
  { label: "Applications", value: "Parcours séparés", note: "Client, Merchant et Courier prennent le relais selon le rôle." },
  { label: "Paiement", value: "Dans Client", note: "La landing n’exécute aucune opération de paiement." },
  { label: "Coursier", value: "Documents hors landing", note: "Les pièces sensibles restent dans un parcours dédié et contrôlé." },
] as const;
