import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const NAME = 'Maison Mafé — Marchand de test';

  // Crée ou récupère le marchand
  let merchant = await prisma.merchant.findFirst({ where: { name: NAME }});
  if (!merchant) {
    merchant = await prisma.merchant.create({
      data: {
        name: NAME,
        address: '1 Rue de la Paix, 1000 Bruxelles, BE',
      },
    });
  }
  console.log('✅ Merchant ID =', merchant.id);

  // Chemin racine du monorepo (services/api/prisma -> ../../../)
  const repoRoot = path.resolve(__dirname, '../../../');
  const outDir = path.join(repoRoot, 'apps/merchant-web/templates');
  fs.mkdirSync(outDir, { recursive: true });

  // CSV prêt pour l’import
  const headers = 'merchant_id,name,price,description,image_url,available,category';
  const rows = [
    [merchant.id, 'Mafé Poulet', '12.00', 'Poulet mijoté sauce arachide', 'https://example.com/images/mafe.jpg', 'true', 'African Classics'],
    [merchant.id, 'Thiebou Yapp', '14.50', 'Riz au mouton parfumé',       'https://example.com/images/yapp.jpg', 'true', 'African Classics'],
    [merchant.id, 'Alloco',       '6.00',  'Banane plantain frite',       'https://example.com/images/alloco.jpg','true', 'Sides'],
  ].map(r => r.join(',')).join('\n');

  const csv = `${headers}\n${rows}\n`;
  const outFile = path.join(outDir, 'menu_template.csv');
  fs.writeFileSync(outFile, csv, 'utf8');

  console.log('✅ CSV écrit :', outFile);
  console.log('👀 Aperçu :\n' + csv.split('\n').slice(0,2).join('\n'));
}

main().catch(e => { console.error(e); process.exit(1); })
       .finally(async () => { await prisma.$disconnect(); });
