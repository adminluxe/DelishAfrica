import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import {
  CreateDemoOrderDto,
  DemoOrderCustomerDto,
  DemoOrderItem,
  DemoOrderMetaDto,
  DemoOrderResponse,
} from './demo-orders.dto';

// ⚠️ Pour la démo uniquement : stockage en mémoire (reset à chaque restart)
const DEMO_ORDERS: DemoOrderResponse[] = [];
let DEMO_ORDER_SEQ = 1;

// Prix de référence alignés sur le menu Thieyp
const THIEYP_PRICES: Record<string, number> = {
  'thieyp-tieboudienne': 1790,
  'thieyp-poulet-yassa': 1590,
  'thieyp-pastels-thon': 890,
};

@Controller('orders')
export class DemoOrdersController {
  @Post('demo')
  createDemoOrder(
    @Body() body: CreateDemoOrderDto,
  ): DemoOrderResponse {
    if (body.partnerId !== 'thieyp') {
      throw new BadRequestException('Unsupported partnerId for demo');
    }

    if (!body.items || body.items.length === 0) {
      throw new BadRequestException(
        'At least one item is required',
      );
    }

    const items: DemoOrderItem[] = body.items.map((item) => {
      const unitPriceCents = THIEYP_PRICES[item.menuItemId];
      if (!unitPriceCents) {
        throw new BadRequestException(
          `Unknown menuItemId: ${item.menuItemId}`,
        );
      }

      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPriceCents,
      };
    });

    const totalCents = items.reduce(
      (sum, it) => sum + it.unitPriceCents * it.quantity,
      0,
    );

    const orderId = `DA-DEMO-${String(DEMO_ORDER_SEQ++).padStart(
      4,
      '0',
    )}`;

    const now = new Date().toISOString();

    const order: DemoOrderResponse = {
      orderId,
      partnerId: body.partnerId,
      status: 'PENDING',
      currency: 'EUR',
      totalCents,
      createdAt: now,
      items,
      customer: body.customer as DemoOrderCustomerDto,
      meta: body.meta as DemoOrderMetaDto | undefined,
    };

    DEMO_ORDERS.push(order);

    return order;
  }
}
