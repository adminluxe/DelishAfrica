export const featuredPartner = {
  slug: "thieyp",
  name: "Thieyp",
  city: "Bruxelles",
  district: "Ixelles",
  address: "Rue Longue Vie 46, 1050 Ixelles",
  cuisine: "Cuisine sénégalaise signature",
  promise: "Une table où le riz, les sauces et les boissons d’Afrique de l’Ouest racontent leur origine.",
  serviceNote: "Disponibilité et zones de livraison confirmées dans l’expérience Client.",
} as const;

export const dishes = [
  { slug: "rice-and-peace", name: "Rice & Peace", origin: "Sénégal", family: "Riz", note: "Riz parfumé, profondeur marine et héritage partagé.", price: "21,90 €", tone: "sun" },
  { slug: "yassa-poulet", name: "Yassa de poulet", origin: "Sénégal", family: "Grillades", note: "Agrumes, oignons confits et chaleur maîtrisée.", price: "19,90 €", tone: "leaf" },
  { slug: "mafe-viande", name: "Mafé à la viande", origin: "Sahel", family: "Sauces", note: "Onctuosité d’arachide, cuisson lente et générosité.", price: "20,90 €", tone: "clay" },
  { slug: "attieke-poisson", name: "Attiéké au poisson", origin: "Côte d’Ivoire", family: "Poisson", note: "Fraîcheur, texture et équilibre autour du manioc.", price: "22,90 €", tone: "violet" },
  { slug: "thieboudienne-rouge", name: "Thiéboudieune rouge", origin: "Sénégal", family: "Riz", note: "Tomate, légumes et poisson dans un grand classique de partage.", price: "21,90 €", tone: "ember" },
  { slug: "bissap", name: "Hibiscus · Bissap", origin: "Afrique de l’Ouest", family: "Boissons", note: "Une infusion florale, vive et profondément familière.", price: "4,50 €", tone: "berry" },
] as const;

export const cities = [
  { name: "Bruxelles", status: "Ville pilote", note: "Premiers partenaires, premiers parcours, première preuve culturelle." },
  { name: "Paris", status: "Préparation", note: "Un marché naturel pour relier tables, diasporas et nouveaux publics." },
  { name: "Dakar", status: "Horizon", note: "Une présence continentale pensée avec des partenaires locaux." },
  { name: "Abidjan", status: "Horizon", note: "Cuisine, création et commerce dans une ville qui rayonne." },
] as const;

export const flavorStories = [
  { origin: "Sénégal", dish: "Rice & Peace", note: "Riz parfumé, profondeur marine et héritage partagé.", tone: "sun" },
  { origin: "Afrique de l’Ouest", dish: "Yassa", note: "Agrumes, oignons confits et chaleur maîtrisée.", tone: "leaf" },
  { origin: "Sahel", dish: "Mafé", note: "Onctuosité d’arachide, cuisson lente et générosité.", tone: "clay" },
  { origin: "Côte d’Ivoire", dish: "Attiéké", note: "Fraîcheur, texture et équilibre autour du manioc.", tone: "violet" },
] as const;
