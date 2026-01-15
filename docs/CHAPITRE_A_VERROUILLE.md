# Chapitre A — Dev Clients / Metro / Tunnel / API : VERROUILLÉ ✅

Date: ____ / ____ / 2025

## Objectif
Pouvoir lancer et ouvrir les 3 apps iOS (Client/Courier/Merchant) en Dev Client,
via Expo Metro + tunnel, de manière reproductible.

## Conditions de succès (validées)
- Metro OK sur ports:
  - Client: 8081
  - Courier: 8082
  - Merchant: 8083
  - Ouverture iPhone:


# CHAPITRE A — Verrouillage (iOS Dev Clients / Metro / API)

## ✅ Validé
- 3 apps iOS ouvertes (Client / Courier / Merchant)
- Metro bundlers actifs :
  - Client : 8081
  - Courier : 8082
  - Merchant : 8083
- Snapshot pris via : /opt/delishafrica/monorepo/scripts/da_snapshot.sh

## ⚠️ Restant avant verrouillage final
### API (Local)
- /api/health : OK
- /api/partners : KO (404)
- /api/partners/thieyp : KO (404)

### API (Remote HTTPS)
- https://api.delishafrica.me/api/* : KO (530 / 1033 Cloudflare tunnel)

## 🔧 Correctifs
1) Fix routes partners (local)
- Script : /opt/delishafrica/monorepo/scripts/da_fix_partners_routes_clean.sh
- Vérification : /opt/delishafrica/monorepo/scripts/da_api_doctor.sh

2) Fix cloudflared tunnel (https)
- Script : /opt/delishafrica/monorepo/scripts/da_fix_cloudflared_api.sh
- Vérification : /opt/delishafrica/monorepo/scripts/da_api_doctor.sh

## ✅ Critère de verrouillage
Le chapitre A est considéré "verrouillé" uniquement quand :
- Local + Remote retournent 200 sur :
  - /api/health
  - /api/partners
  - /api/partners/thieyp
- Et que 8081/8082/8083 restent UP.
  - Les 3 apps s’ouvrent sans erreur
  - Aucun “No development servers found”
- API OK:
  - GET /api/health
  - GET /api/partners
  - GET /api/partners/thieyp

## Commande standard de relance (si besoin)
cd /opt/delishafrica/monorepo && ./reset_delishafrica.sh
./da_reset_and_mux.sh

## Prochaine étape (Chapitre B)
Implémenter le flux demo-orders:
Client -> création commande -> Merchant -> Courier -> delivered
