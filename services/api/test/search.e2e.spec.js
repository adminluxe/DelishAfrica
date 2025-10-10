const request = require('supertest');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:4001';

describe('Health', () => {
  it('GET /api/health -> 200', async () => {
    await request(BASE).get('/api/health').expect(200);
  });
});

describe('Search', () => {
  it('GET /api/search -> 200 & array', async () => {
    const res = await request(BASE).get('/api/search?q=brux&limit=5&offset=0');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('Rate limit bursts -> at least one 429 within 12 calls', async () => {
    const calls = [];
    for (let i = 0; i < 12; i++) {
      calls.push(request(BASE).get('/api/search?q=brux&limit=1&offset=0'));
    }
    const results = await Promise.all(calls);
    const codes = results.map(r => r.status);
    // tolérant : au moins un 429 attendu
    expect(codes.some(c => c === 429)).toBe(true);
  });
});
