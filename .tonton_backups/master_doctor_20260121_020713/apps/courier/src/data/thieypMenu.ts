export type ThieypMenuDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

export const THIEYP_MENU = {
  currency: "EUR" as const,
  daily: [
    { day: "MON" as ThieypMenuDay, items: [
      { id: "mon_rice_and_peace", name: "Rice and Peace", price: 21.90 },
      { id: "mon_attieke_poisson", name: "Attiéké au poisson", price: 21.90 },
    ]},
    { day: "TUE" as ThieypMenuDay, items: [
      { id: "tue_thieboudieune", name: "Thiéboudieune", price: 21.90 },
      { id: "tue_mafe_jarret", name: "Mafè à la viande (jarret)", price: 29.90 },
    ]},
    { day: "WED" as ThieypMenuDay, items: [
      { id: "wed_yassa_crevettes", name: "Yassa aux crevettes", price: 22.90 },
      { id: "wed_attieke_poulet", name: "Attiéké au poulet", price: 21.90 },
    ]},
    { day: "THU" as ThieypMenuDay, items: [
      { id: "thu_foutou_graine", name: "Foutou banane sauce graine", price: 22.90 },
      { id: "thu_thiou_boulettes_poisson", name: "Thiou boulettes de poisson", price: 21.90 },
    ]},
    { day: "FRI" as ThieypMenuDay, items: [
      { id: "fri_yassa_poulet", name: "Yassa au poulet", price: 21.90 },
      { id: "fri_thieboudieune", name: "Thiéboudieune", price: 21.90 },
    ]},
    { day: "SAT" as ThieypMenuDay, items: [
      { id: "sat_dibi_allocos", name: "Dibi et allocos", price: 22.90 },
      { id: "sat_acras_morue_allocos", name: "Acras de morue et allocos", price: 21.90 },
    ]},
  ],
  extras: {
    entreeDuJour: { min: 10.50, max: 12.50 },
    platVegetarien: 21.90,
    dessertDuJour: { min: 8.50, max: 10.50 },
    jusFrais: 4.90,
    jusOptions: ["hibiscus", "gingembre", "baobab"] as const,
  },
  partnerCard: {
    address: "Rue Longue Vie 46, 1050 Ixelles",
    hours: "Lun–Sam 12h–14h30 / 18h–22h",
    phone: "+32 493 39 27 37",
    website: "https://www.thieyp.be",
    instagram: "thieypbruxelles",
  }
} as const;
