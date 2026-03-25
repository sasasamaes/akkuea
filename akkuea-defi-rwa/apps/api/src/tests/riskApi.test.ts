import { describe, test, expect } from 'bun:test';
import { Elysia } from 'elysia';
import { riskMonitoringRoutes } from '../routes/riskMonitoring';

describe('Risk Monitoring API', () => {
  const app = new Elysia().use(riskMonitoringRoutes);

  test('Monitoring data is available to internal tools', async () => {
    const response = await app.handle(new Request('http://localhost/internal/risk/positions'));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Filter positions by risk level', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/positions/risk/critical'),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Get liquidation readiness for position', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/liquidation/pool-1-borrower-1'),
    );

    expect(response.status).toBeLessThan(500);
  });

  test('Get risk transitions', async () => {
    const response = await app.handle(new Request('http://localhost/internal/risk/transitions'));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Get transitions for specific position', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/transitions?positionId=pos-1'),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
