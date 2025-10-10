import { z } from 'zod';
export const MenuRowSchema = z.object({
  merchant_id: z.string().min(1),
  name: z.string().min(1).transform(s => s.trim()),
  price: z.string().or(z.number()).transform((v) => {
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
    if (Number.isNaN(n)) throw new Error('Invalid price');
    return Number(n.toFixed(2));
  }),
  category: z.string().min(1).transform(s => s.trim()),
  description: z.string().optional().default(''),
  spicy_level: z.coerce.number().int().min(0).max(5).optional().default(0),
  imageUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  available: z.coerce.boolean().optional().default(true),
});
export type MenuRow = z.infer<typeof MenuRowSchema>;
export function validateCsvRows(rows: Record<string, any>[]) {
  const required = ['merchant_id','name','price','category'];
  const header = Object.keys(rows[0] || {});
  const missing = required.filter(c => !header.includes(c));
  if (missing.length) return { ok:false, errors:[`Colonnes manquantes: ${missing.join(', ')}`] };
  const parsed: MenuRow[] = []; const errors: string[] = [];
  rows.forEach((r, idx) => {
    try { parsed.push(MenuRowSchema.parse(r)); }
    catch (e: any) { errors.push(`Ligne ${idx+2}: ${e.message}`); }
  });
  return errors.length ? { ok:false, errors } : { ok:true, data: parsed };
}
