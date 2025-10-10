const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const NAME = 'Maison Mafé — Marchand de test';
  const PHONE = '+32400000000';
  const ADDRESS = '1 Rue de la Paix, 1000 Bruxelles, BE';

  let m = await prisma.merchant.findFirst({ where: { name: NAME }});
  if (!m) {
    m = await prisma.merchant.create({
      data: { name: NAME, phone: PHONE, address: ADDRESS, active: true }
    });
  }
  console.log(m.id);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
