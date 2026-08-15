import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

const OPERATOR = "Purple Orchid GROUP";
const SUPPORT_EMAIL = "support@purpleorchidgroup.com";
const PRIVACY_EMAIL = "support@purpleorchidgroup.com";
const JURISDICTION = "Belgique";
const UPDATED = '2026-08-15';
const MARKER = 'DELISHAFRICA_LEGAL_V1';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(title: string, body: string): string {
  return `<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>${esc(title)} · DelishAfrica</title><style>body{font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;max-width:860px;margin:0 auto;padding:32px 20px;line-height:1.6;color:#171717;background:#fffaf4}h1,h2{line-height:1.2}a{color:#7a421d}.card{background:white;border:1px solid #ead9c8;border-radius:18px;padding:20px;margin:18px 0}small{color:#666}</style></head><body><small>${MARKER} · Mise à jour ${UPDATED}</small><h1>${esc(title)}</h1>${body}<div class=\"card\"><strong>Opérateur</strong><br>${esc(OPERATOR)}<br><strong>Contact</strong><br><a href=\"mailto:${esc(SUPPORT_EMAIL)}\">${esc(SUPPORT_EMAIL)}</a></div></body></html>`;
}

@Controller('legal')
export class LegalController {
  @Get('privacy')
  privacy(@Res() res: Response) {
    const body = `
      <p>Cette politique décrit comment DelishAfrica traite les données nécessaires à ses services de commande, paiement, livraison, identité, sécurité et assistance.</p>
      <h2>Données susceptibles d'être traitées</h2>
      <ul><li>identifiants de session et d'authentification ;</li><li>nom, e-mail, téléphone, profil et adresses de livraison ;</li><li>commandes, restaurants, statuts et informations de livraison ;</li><li>données de localisation lorsque la fonctionnalité et l'autorisation l'exigent ;</li><li>métadonnées de paiement traitées avec notre prestataire de paiement, sans stockage par DelishAfrica des données complètes de carte ;</li><li>données de vérification professionnelle lorsque vous utilisez un espace Merchant ou Courier ;</li><li>journaux techniques nécessaires à la sécurité, à la prévention des abus et au support.</li></ul>
      <h2>Finalités</h2><p>Fournir le service, exécuter les commandes et livraisons, sécuriser les accès et transactions, assurer le support, respecter les obligations applicables et améliorer la fiabilité.</p>
      <h2>Prestataires</h2><p>Des prestataires techniques peuvent intervenir pour l'hébergement, l'identité, le paiement, la cartographie, la messagerie et les notifications. Ils ne reçoivent que les données nécessaires à leur mission.</p>
      <h2>Conservation et droits</h2><p>Les données sont conservées pendant la durée nécessaire au service, à la sécurité, aux obligations applicables et aux sauvegardes. Vous pouvez demander accès, rectification ou effacement lorsque le droit le permet en écrivant à <a href=\"mailto:${esc(PRIVACY_EMAIL)}\">${esc(PRIVACY_EMAIL)}</a>.</p>
      <h2>Sécurité et transferts</h2><p>Nous appliquons des mesures techniques et organisationnelles de protection. Certains prestataires peuvent traiter des données dans d'autres pays sous les garanties juridiques applicables.</p>`;
    return res.type('html').send(shell('Politique de confidentialité', body));
  }

  @Get('terms')
  terms(@Res() res: Response) {
    const body = `
      <p>Ces conditions encadrent l'utilisation des services DelishAfrica. Les informations fournies doivent être exactes et le service ne doit pas être détourné ou utilisé de manière frauduleuse.</p>
      <h2>Commandes et paiements</h2><p>Les prix, disponibilités, frais et conditions présentés au moment de la commande s'appliquent. Les paiements peuvent être opérés par un prestataire externe sécurisé.</p>
      <h2>Livraison</h2><p>Les estimations de préparation et de livraison peuvent varier selon le restaurant, le trafic, la disponibilité des coursiers et les circonstances opérationnelles.</p>
      <h2>Accès et sécurité</h2><p>Vous êtes responsable de la confidentialité de vos moyens d'accès. Toute fraude ou tentative d'accès non autorisé peut entraîner une restriction du service.</p>
      <h2>Droit applicable</h2><p>Sous réserve des règles impératives applicables, ces conditions sont interprétées selon le droit de ${esc(JURISDICTION)}.</p>`;
    return res.type('html').send(shell("Conditions d'utilisation", body));
  }

  @Get('support')
  support(@Res() res: Response) {
    const body = `<p>Pour une question relative à une commande, un accès, un paiement, une livraison, un espace partenaire ou vos données, contactez <a href=\"mailto:${esc(SUPPORT_EMAIL)}\">${esc(SUPPORT_EMAIL)}</a>.</p>`;
    return res.type('html').send(shell('Assistance', body));
  }

  @Get('account-deletion')
  deletion(@Res() res: Response) {
    const body = `<p>Si vous disposez d'une identité gérée par DelishAfrica et souhaitez demander l'effacement de votre compte ou de vos données, contactez <a href=\"mailto:${esc(PRIVACY_EMAIL)}\">${esc(PRIVACY_EMAIL)}</a> depuis l'adresse associée à votre identité. Nous vous indiquerons les vérifications nécessaires, les données pouvant être supprimées et celles devant être conservées pour des obligations légales, de sécurité ou de prévention de la fraude.</p><p>Cette page ne prétend pas qu'une création autonome de compte est disponible dans les applications : cette capacité est vérifiée séparément lors de la readiness Store.</p>`;
    return res.type('html').send(shell('Suppression de compte et de données', body));
  }
}
