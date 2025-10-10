import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parse } from 'csv-parse/sync';

type CsvRow = { [key: string]: any };

@Injectable()
export class MerchantService {
  constructor(private readonly prisma: PrismaService) {}

  private asBool(v: any) {
    const s = String(v ?? '').trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y';
  }

  async importMenuCsv(buffer: Buffer, opts?: { merchantId?: string; delimiter?: string; encoding?: string }) {
    const merchantId = opts?.merchantId;
    const delimiter = opts?.delimiter || ',';
    const encoding  = opts?.encoding  || 'utf-8';
    if (!buffer?.length) throw new BadRequestException('CSV vide');

    const rows = parse(buffer, { columns: true, skip_empty_lines: true, trim: true }) as CsvRow[];

    let ok = 0, ko = 0;
    const errors: Array<{ line: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row: CsvRow = rows[i]; const line = i + 2; // +1 entête
      try {
        const merchantId = row.merchant_id ?? row.merchantId;
        if (!merchantId) throw new BadRequestException('Colonne "merchant_id" manquante');

        const merchant = await this.prisma.merchant.findUnique({ where: { id: String(merchantId) } });
        if (!merchant) throw new NotFoundException(`Marchand introuvable: ${merchantId}`);

        const name = String(row.name ?? '').trim();
        if (!name) throw new BadRequestException('Colonne "name" vide');

        const priceStr = String(row.price ?? '').replace(',', '.');
        const price = Number(priceStr);
        if (!isFinite(price)) throw new BadRequestException(`Prix invalide: "${row.price}"`);

        const description = row.description ? String(row.description) : null;
        const imageUrl = row.image_url || row.imageUrl || null;
        const available = row.available != null ? this.asBool(row.available) : true;
        const category = row.category ? String(row.category) : null;

        // upsert idempotent via clé composite UNIQUE @@unique([merchantId, name], name: "merchantId_name")
        await this.prisma.menuItem.upsert({
          where: { merchantId_name: { merchantId: merchant.id, name } as any },
          update: { price, description, imageUrl, available, ...(category !== null ? { category } : {}) },
          create: { merchantId: merchant.id, name, price, description, imageUrl, available, category: (category ?? 'Uncategorized') },
        });

        ok++;
      } catch (e: any) {
        ko++; errors.push({ line, error: e?.message ?? String(e) });
      }
    }

    return { imported: ok, errors: ko, details: errors };
  }
}
