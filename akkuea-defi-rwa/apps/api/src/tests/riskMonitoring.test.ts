import { describe, test, expect, beforeEach } from 'bun:test';
import { RiskMonitoringService } from '../services/RiskMonitoringService';
import type { BorrowPosition } from '@real-estate-defi/shared';

describe('RiskMonitoringService', () => {
  let service: RiskMonitoringService;

  beforeEach(() => {
    service = new RiskMonitoringService();
  });

  test('Healthy positions are evaluated as safe', async () => {
    const positions: BorrowPosition[] = [
      {
        poolId: 'pool-1',
        borrower: 'borrower-1',
        collateralPropertyId: 'prop-1',
        collateralShares: 10,
        borrowAmount: 50000,
        borrowDate: new Date(),
        interestRate: 0.05,
        isLiquidated: false,
      },
    ];

    const collateralPrices = new Map([['prop-1', 10000]]);
    const results = await service.evaluatePositions(positions, collateralPrices);

    expect(results).toHaveLength(1);
    expect(results[0].riskLevel).toBe('safe');
    expect(results[0].healthFactor).toBeGreaterThan(1.25);
  });

  test('Warning threshold breached', async () => {
    const positions: BorrowPosition[] = [
      {
        poolId: 'pool-1',
        borrower: 'borrower-1',
        collateralPropertyId: 'prop-1',
        collateralShares: 10,
        borrowAmount: 90000,
        borrowDate: new Date(),
        interestRate: 0.05,
        isLiquidated: false,
      },
    ];

    const collateralPrices = new Map([['prop-1', 10000]]);
    const results = await service.evaluatePositions(positions, collateralPrices);

    expect(results[0].riskLevel).toBe('warning');
    expect(results[0].healthFactor).toBeLessThanOrEqual(1.25);
    expect(results[0].healthFactor).toBeGreaterThan(1.1);
  });

  test('Critical threshold breached', async () => {
    const positions: BorrowPosition[] = [
      {
        poolId: 'pool-1',
        borrower: 'borrower-1',
        collateralPropertyId: 'prop-1',
        collateralShares: 10,
        borrowAmount: 95000,
        borrowDate: new Date(),
        interestRate: 0.05,
        isLiquidated: false,
      },
    ];

    const collateralPrices = new Map([['prop-1', 10000]]);
    const results = await service.evaluatePositions(positions, collateralPrices);

    expect(results[0].riskLevel).toBe('critical');
    expect(results[0].healthFactor).toBeLessThanOrEqual(1.1);
  });

  test('No positions exist - empty result returned safely', async () => {
    const positions: BorrowPosition[] = [];
    const collateralPrices = new Map();
    const results = await service.evaluatePositions(positions, collateralPrices);

    expect(results).toHaveLength(0);
  });

  test('Liquidation readiness for critical position', () => {
    const health = {
      positionId: 'pos-1',
      borrower: 'borrower-1',
      poolId: 'pool-1',
      healthFactor: 0.95,
      riskLevel: 'critical' as const,
      collateralValue: 100000,
      borrowValue: 105000,
      liquidationThreshold: 1.0,
    };

    const readiness = service.prepareLiquidation(health);

    expect(readiness.isLiquidatable).toBe(true);
    expect(readiness.collateralToSeize).toBe(100000);
    expect(readiness.debtToCover).toBe(105000);
    expect(readiness.estimatedProceeds).toBe(95000);
  });

  test('Liquidation readiness for safe position', () => {
    const health = {
      positionId: 'pos-1',
      borrower: 'borrower-1',
      poolId: 'pool-1',
      healthFactor: 2.0,
      riskLevel: 'safe' as const,
      collateralValue: 100000,
      borrowValue: 50000,
      liquidationThreshold: 1.0,
    };

    const readiness = service.prepareLiquidation(health);

    expect(readiness.isLiquidatable).toBe(false);
    expect(readiness.collateralToSeize).toBe(0);
    expect(readiness.debtToCover).toBe(0);
  });
});
