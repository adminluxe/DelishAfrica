const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const log = {
  ok:  (m) => console.log(`✓ ${m}`),
  info:(m) => console.log(`ℹ︎ ${m}`),
  warn:(m)=> console.warn(`⚠ ${m}`),
};

async function main() {
  // 0) Health-check
  const [{ version }] = await prisma.$queryRaw`SELECT version();`;
  log.ok(`DB version: ${version}`);

  // 1) USER (email unique → upsert)
  const adminEmail = 'admin@delish.africa';
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: 'dev-admin',     // en prod: hash !
      role: 'ADMIN',             // enum Role: ADMIN existe dans ton schema
    },
  });
  log.ok(`User admin prêt (id=${admin.id})`);

  // 2) MERCHANT (pas d’unique → findFirst puis create)
  async function ensureMerchantByName(name) {
    const found = await prisma.merchant.findFirst({ where: { name } });
    if (found) return found;
    return prisma.merchant.create({ data: { name } });
  }
  const merchant = await ensureMerchantByName('Mafé House');
  log.ok(`Merchant prêt (id=${merchant.id})`);

  // 3) PRODUCTS (pas d’unique → findFirst { merchantId, name } puis create)
  const PRODUCTS = [
    { name: 'Mafé poulet',   price: 12.9,  description: 'Ragoût arachide', category: 'Plat', spicyLevel: 1 },
    { name: 'Yassa poisson', price: 14.9,  description: 'Citron/Oignons',  category: 'Plat', spicyLevel: 2 },
    { name: 'Bissap 50cl',   price: 3.9,   description: 'Boisson',         category: 'Boisson', spicyLevel: null },
  ];

  async function ensureProduct(merchantId, spec) {
    const found = await prisma.product.findFirst({
      where: { merchantId, name: spec.name },
    });
    if (found) return found;
    return prisma.product.create({ data: { merchantId, ...spec } });
  }

  const createdProducts = [];
  for (const spec of PRODUCTS) {
    const p = await ensureProduct(merchant.id, spec);
    createdProducts.push(p);
  }
  log.ok(`Produits prêts (${createdProducts.length})`);

  // 4) ORDER (pas d’unique → findFirst par userId/merchantId/status, sinon create)
  //    total = somme de 2 premiers produits (si dispo)
  const itemsForOrder = createdProducts.slice(0, 2).map(p => ({ product: p, quantity: 1 }));
  const computedTotal = itemsForOrder.reduce((sum, it) => sum + (it.product.price * it.quantity), 0);

  let order = await prisma.order.findFirst({
    where: { userId: admin.id, merchantId: merchant.id, status: 'PENDING' },
  });
  if (!order) {
    order = await prisma.order.create({
      data: {
        userId: admin.id,
        merchantId: merchant.id,
        total: Number(computedTotal.toFixed(2)),
        status: 'PENDING',
      },
    });
  }
  log.ok(`Order prêt (id=${order.id}, total=${order.total})`);

  // 5) ORDER ITEMS (clé composite → create et on ignore le doublon)
  for (const it of itemsForOrder) {
    try {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: it.product.id,
          quantity: it.quantity,
        },
      });
      log.ok(`OrderItem ajouté (${it.product.name})`);
    } catch (e) {
      // P2002 (dupe composite) → on ignore
      log.warn(`OrderItem déjà présent pour product=${it.product.id} → ignore`);
    }
  }

  log.ok('Seed terminé sans erreur.');
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (e) => { console.error('Seed fatal error:', e); await prisma.$disconnect(); process.exit(1); });
