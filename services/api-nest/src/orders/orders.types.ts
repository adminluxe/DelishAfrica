export type OrderStatus =
  | 'pending' | 'accepted' | 'ready' | 'picked_up' | 'delivered' | 'cancelled';

export type OrderItem = { sku: string; name: string; qty: number; unitPrice: number; };

export type Order = {
  id: string;
  partnerSlug: string;
  status: OrderStatus;
  items: OrderItem[];
  notes?: string;
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
  updatedAt: string;
};
