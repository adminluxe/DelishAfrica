import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  const NAME = process.env.MERCHANT_NAME || 'Maison Mafé — Marchand de test';

  let merchant = await prisma.merchant.findFirst({ where: { name: NAME }});
  if (!merchant) {
    merchant = await prisma.merchant.create({
      data: {
        name: NAME,
        active: true,
        address: '1 Rue de la Paix, 1000 Bruxelles, BE',
        // phone: '+32400000000', // décommente si ton modèle le contient
      },
    });
  }

  console.log('MERCHANT_ID=' + merchant.id);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
