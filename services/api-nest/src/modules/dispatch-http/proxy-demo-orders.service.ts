import { Injectable } from '@nestjs/common';

type AnyObj = Record<string, any>;

@Injectable()
export class ProxyDemoOrdersService {
  private base(): string {
    const port = process.env.PORT || process.env.APP_PORT || '3010';
    return `http://127.0.0.1:${port}`;
  }

  private async postJson(path: string, body: AnyObj): Promise<AnyObj> {
    const url = `${this.base()}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const txt = await res.text();
    let json: AnyObj = {};
    try { json = txt ? JSON.parse(txt) : {}; } catch { json = { raw: txt }; }
    return { status: res.status, json };
  }

  async listDemoOrders(filter: AnyObj) {
    // P0-A1: dispatch internal proxy uses production Orders surface; demo route remains compatibility-only.
    return this.postJson('/api/v1/orders/list', filter);
  }

  async getDemoOrder(filter: AnyObj) {
    return this.postJson('/api/v1/orders/get', filter);
  }
}
