import { z } from "zod";
export const Money = z.object({ amount: z.number(), currency: z.string().default("EUR") });
export const Address = z.object({ line1: z.string(), line2: z.string().optional(), city: z.string(), postalCode: z.string() });
export const MenuOption = z.object({ id: z.string(), name: z.string(), priceDelta: z.number().default(0) });
export const MenuItem = z.object({
  id: z.string(), merchantId: z.string(), name: z.string(),
  description: z.string().optional(), price: z.number(), category: z.string(),
  options: z.array(MenuOption).default([]), allergens: z.array(z.string()).default([]),
  spicyLevel: z.number().min(0).max(3).default(0)
});
export const OrderItem = z.object({ itemId: z.string(), qty: z.number().min(1), selectedOptions: z.array(z.string()).default([]) });
export const Order = z.object({
  id: z.string(), customerId: z.string(), merchantId: z.string(), items: z.array(OrderItem),
  total: z.number(), address: Address,
  status: z.enum(["CREATED","CONFIRMED","PREPARING","READY","PICKED_UP","DELIVERED","CANCELLED"]).default("CREATED")
});
export type TMenuItem = z.infer<typeof MenuItem>;
export type TOrder = z.infer<typeof Order>;
