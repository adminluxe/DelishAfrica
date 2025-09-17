import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function sanitizeId(merchantId: string, name: string) {
  return `${merchantId}-${name}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 191);
}

function getField(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    if (row[k] != null) return String(row[k]).trim();
    if (row[k.toLowerCase()] != null) return String(row[k.toLowerCase()]).trim();
    if (row[k.toUpperCase()] != null) return String(row[k.toUpperCase()]).trim();
  }
  return undefined;
}

@Injectable()
export class MerchantService {
  async createMenuItemsFromCSV(rows: Record<string, string>[]) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException("CSV vide");
    }

    const items: any[] = [];
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      try {
        const merchantId = getField(raw, ["merchant_id", "merchantId"]);
        const name = getField(raw, ["name"])!;
        const priceStr = getField(raw, ["price"])!;
        const category = getField(raw, ["category"]) || "Divers";
        const description = getField(raw, ["description"]) || null;
        const spicyStr = getField(raw, ["spicy_level", "spicyLevel"]) || "0";
        const imageUrl = getField(raw, ["imageUrl", "image_url"]) || null;
        const availableStr = getField(raw, ["available"]) || "true";

        if (!merchantId || !name || !priceStr) {
          throw new BadRequestException(`Ligne ${i + 1}: merchant_id, name et price sont requis`);
        }

        const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
        if (!merchant) throw new NotFoundException(`Ligne ${i + 1}: merchant ${merchantId} introuvable`);

        const priceNorm = priceStr.replace(",", ".");
        const priceNum = Number(priceNorm);
        if (!Number.isFinite(priceNum)) {
          throw new BadRequestException(`Ligne ${i + 1}: price invalide "${priceStr}"`);
        }

        const spicyLevel = Number(spicyStr) || 0;
        const available = String(availableStr).toLowerCase() !== "false";
        const id = sanitizeId(merchantId, name);

        let item;
        try {
          item = await prisma.menuItem.upsert({
            where: { id },
            update: { description, price: priceNum, category, spicyLevel, imageUrl, available },
            create: { id, merchantId, name, description, price: priceNum, category, spicyLevel, imageUrl, available }
          });
        } catch (e: any) {
          // Prisma error → renvoyer 400 explicite
          console.error("DB upsert error @", i + 1, { id, merchantId, name, priceNum, category }, e?.code, e?.message);
          const code = e?.code ? ` (Prisma ${e.code})` : "";
          throw new BadRequestException(`Ligne ${i + 1}: echec upsert${code} — ${e?.meta?.cause || e?.message || e}`);
        }

        items.push(item);
      } catch (e: any) {
        console.error("CSV row error @", i + 1, raw, e?.message || e);
        throw e;
      }
    }
    return items;
  }
}
