import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const merchantId = process.env.MERCHANT_ID!;
  const items = [
    { name: 'Thiebou Dieune', price: 15.90, category: 'Plats', description: 'Riz au poisson sénégalais' },
    { name: 'Mafé',          price: 13.50, category: 'Plats', description: 'Sauce arachide' },
  ];
  for (const it of items) {
    await prisma.menuItem.upsert({
      where: { merchantId_name: { merchantId, name: it.name } }, // si contrainte unique existe
      update: { ...it },
      create: { merchantId, ...it },
    }).catch(async e => {
      // fallback si pas d'unique composite
      const exists = await prisma.menuItem.findFirst({ where: { merchantId, name: it.name } });
      if (!exists) await prisma.menuItem.create({ data: { merchantId, ...it } });
    });
  }
  console.log('✅ seed menu items ok');
  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
