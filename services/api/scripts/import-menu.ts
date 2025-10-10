import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function asBool(v: any) {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

async function run(filePath: string) {
  if (!filePath) throw new Error('Usage: ts-node scripts/import-menu.ts <path/to/menu.csv>');
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`CSV introuvable: ${abs}`);

  const buf = fs.readFileSync(abs);
  const records = parse(buf, { columns: true, skip_empty_lines: true, trim: true });

  let ok = 0, ko = 0;
  const errors: Array<{line:number; error:string; row:any}> = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const line = i + 2; // +1 header +1 index->ligne
    try {
      const merchantId = row.merchant_id ?? row.merchantId;
      if (!merchantId) throw new Error('Colonne "merchant_id" manquante');

      const merchant = await prisma.merchant.findUnique({ where: { id: String(merchantId) } });
      if (!merchant) throw new Error(`Marchand introuvable: ${merchantId}`);

      const name = String(row.name ?? '').trim();
      if (!name) throw new Error('Colonne "name" vide');

      const priceStr = String(row.price ?? '').replace(',', '.');
      const price = Number(priceStr);
      if (!isFinite(price)) throw new Error(`Prix invalide: "${row.price}"`);

      const description = row.description ? String(row.description) : null;
      const imageUrl = row.image_url || row.imageUrl || null;
      const available = row.available != null ? asBool(row.available) : true;
      const category = row.category ? String(row.category) : null;

      await prisma.menuItem.upsert({
        where: { merchantId_name: { merchantId: merchant.id, name } as any },
        update: { price, description, imageUrl, available, category },
        create: { merchantId: merchant.id, name, price, description, imageUrl, available, category },
      });

      ok++;
    } catch (e: any) {
      ko++;
      errors.push({ line, error: e.message ?? String(e), row });
    }
  }

  return { ok, ko, errors };
}

(async () => {
  try {
    const csvPath = process.argv[2];
    const res = await run(csvPath);
    console.log('✅ Import terminé:', { imported: res.ok, erreurs: res.ko });
    if (res.errors.length) {
      console.error('❌ Détails erreurs (max 10):');
      for (const e of res.errors.slice(0, 10)) {
        console.error(`  - Ligne ${e.line}: ${e.error}`);
      }
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
