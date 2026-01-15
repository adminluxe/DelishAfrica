export type CreateOrderItemDto = {
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
};

export type CreateOrderDto = {
  partnerSlug: string;
  items: CreateOrderItemDto[];
  notes?: string;
  customerName?: string;
  customerPhone?: string;
};
