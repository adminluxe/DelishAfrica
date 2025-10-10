import { Injectable, BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../../prisma/prisma.service';

type CsvRow = {
  merchant_id?: string;
  name?: string;
  price?: string;
  category?: string;
  description?: string;
  spicy_level?: string;
  imageUrl?: string;
  available?: string;
};

@Injectable()
export class MerchantImportService {
  constructor(private readonly prisma: PrismaService) {}

  private toBool(v?: string) {
    if (!v) return false;
    const s = v.trim().toLowerCase();
    return ['true', '1', 't', 'yes', 'y'].includes(s);
  }
  private toInt(v?: string) {
    if (!v || v.trim() === '') return null;
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }
  private toNumber(v?: string) {
    if (!v || v.trim() === '') return null;
    const n = Number.parseFloat(v.replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  }

  async importCsv(buffer: Buffer, merchantIdOverride?: string) {
    if (!buffer?.length) throw new BadRequestException('Empty file');

    const records: CsvRow[] = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    if (!records.length) throw new BadRequestException('CSV has no rows');

    const results = { inserted: 0, updated: 0, total: records.length, errors: [] as string[] };

    // 1) Pré-valider les merchantIds pour éviter les erreurs FK → 500
    const ids = new Set<string>();
    for (const r of records) {
      const id = (merchantIdOverride ?? r.merchant_id)?.trim();
      if (id) ids.add(id);
    }
    const known = new Set(
      (await this.prisma.merchant.findMany({ where: { id: { in: [...ids] } }, select: { id: true } }))
        .map(m => m.id)
    );

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const merchantId = (merchantIdOverride ?? r.merchant_id)?.trim();
        const name = r.name?.trim();

        if (!merchantId || !name) {
          results.errors.push(`Row ${i + 2}: missing merchant_id or name`);
          continue;
        }
        if (!known.has(merchantId)) {
          results.errors.push(`Row ${i + 2}: unknown merchant_id ${merchantId}`);
          continue;
        }

        const price = this.toNumber(r.price);
        const spicyLevel = this.toInt(r.spicy_level);
        const available = this.toBool(r.available);
        const category = r.category?.trim() || null;
        const description = r.description?.trim() || null;
        const imageUrl = r.imageUrl?.trim() || null;

        try {
          const existing = await tx.menuItem.findFirst({
            where: { merchantId, name },
            select: { id: true },
          });

          if (existing) {
            await tx.menuItem.update({
              where: { id: existing.id },
              data: {
                price: price ?? undefined,
                category: category ?? undefined,
                description: description ?? undefined,
                spicyLevel: spicyLevel ?? undefined,
                imageUrl: imageUrl ?? undefined,
                available,
              },
            });
            results.updated++;
          } else {
            await tx.menuItem.create({
              data: {
                merchantId,
                name,
                price: price ?? 0,
                category: category ?? '',
                description,
                spicyLevel: spicyLevel ?? 0,
                imageUrl,
                available,
              },
            });
            results.inserted++;
          }
        } catch (e: any) {
          results.errors.push(`Row ${i + 2}: ${e?.message ?? 'unknown error'}`);
        }
      }
    });

    return results;
  }
}
