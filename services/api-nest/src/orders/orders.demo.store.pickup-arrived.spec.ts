import { equal, ok } from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('pickup-arrived fact is assigned-courier-only and idempotent', async () => {
  const root = mkdtempSync(join(tmpdir(), 'da-pickup-arrived-'));
  const storeFile = join(root, 'orders.json');
  process.env.DA_DEMO_ORDERS_STORE_FILE = storeFile;

  try {
    const store = await import('./orders.demo.store');
    store.resetDemoOrders([
      {
        id: 'order-pickup-1',
        status: 'ready',
        assignmentProposal: {
          status: 'accepted',
          courierId: 'courier-good',
          acceptedAt: '2026-10-27T08:00:00.000Z',
        },
      },
    ]);

    equal(
      store.markDemoOrderCourierPickupArrived({
        orderId: 'order-pickup-1',
        courierId: 'courier-wrong',
      }),
      null,
    );

    const first = store.markDemoOrderCourierPickupArrived({
      orderId: 'order-pickup-1',
      courierId: 'courier-good',
      auditId: 'arrival-audit-1',
    });
    ok(first?.courierArrivedPickupAt);
    const firstAt = first!.courierArrivedPickupAt;
    const firstArrivalEvents = first!.timeline.filter(
      (event: any) => event.label === 'courier_arrived_pickup',
    );
    equal(firstArrivalEvents.length, 1);
    equal(firstArrivalEvents[0].auditId, 'arrival-audit-1');

    const replay = store.markDemoOrderCourierPickupArrived({
      orderId: 'order-pickup-1',
      courierId: 'courier-good',
      auditId: 'arrival-audit-2',
    });
    equal(replay?.courierArrivedPickupAt, firstAt);
    equal(
      replay?.timeline.filter(
        (event: any) => event.label === 'courier_arrived_pickup',
      ).length,
      1,
    );

    const picked = store.updateDemoOrderStatus({
      orderId: 'order-pickup-1',
      status: 'picked_up',
    });
    ok(picked?.pickedUpAt);
    const pickedAt = picked!.pickedUpAt;

    const pickedReplay = store.updateDemoOrderStatus({
      orderId: 'order-pickup-1',
      status: 'picked_up',
    });
    equal(pickedReplay?.pickedUpAt, pickedAt);

    const delivered = store.updateDemoOrderStatus({
      orderId: 'order-pickup-1',
      status: 'delivered',
    });
    ok(delivered?.deliveredAt);
  } finally {
    delete process.env.DA_DEMO_ORDERS_STORE_FILE;
    rmSync(root, { recursive: true, force: true });
  }
});
