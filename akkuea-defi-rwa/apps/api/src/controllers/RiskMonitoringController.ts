import type { BorrowPosition, PositionHealth, LiquidationReadiness } from '@real-estate-defi/shared';
import { RiskMonitoringService } from '../services/RiskMonitoringService';
import { LendingController } from './LendingController';

export class RiskMonitoringController {
  private static service = new RiskMonitoringService();

  static async evaluateAllPositions(): Promise<PositionHealth[]> {
    try {
      const positions = await this.getAllBorrowPositions();
      const collateralPrices = await this.getCollateralPrices(positions);
      return await this.service.evaluatePositions(positions, collateralPrices);
    } catch (error) {
      throw new Error(`Failed to evaluate positions: ${error}`);
    }
  }

  static async getPositionsByRisk(riskLevel?: string): Promise<PositionHealth[]> {
    const allHealth = await this.evaluateAllPositions();
    if (!riskLevel) return allHealth;
    return allHealth.filter((h) => h.riskLevel === riskLevel);
  }

  static async getLiquidationReadiness(positionId: string): Promise<LiquidationReadiness> {
    const allHealth = await this.evaluateAllPositions();
    const health = allHealth.find((h) => h.positionId === positionId);
    
    if (!health) {
      throw new Error(`Position ${positionId} not found`);
    }

    return this.service.prepareLiquidation(health);
  }

  static async getRiskTransitions(positionId?: string) {
    return this.service.getTransitions(positionId);
  }

  private static async getAllBorrowPositions(): Promise<BorrowPosition[]> {
    // Aggregate all borrow positions across pools
    const pools = await LendingController.getPools();
    const positions: BorrowPosition[] = [];

    for (const pool of pools) {
      for (const borrower of pool.borrowers) {
        const userBorrows = await LendingController.getUserBorrows(pool.id, borrower);
        positions.push(...userBorrows);
      }
    }

    return positions;
  }

  private static async getCollateralPrices(
    positions: BorrowPosition[],
  ): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    const propertyIds = [...new Set(positions.map((p) => p.collateralPropertyId))];

    // Mock prices - in production, fetch from oracle/valuation service
    for (const propertyId of propertyIds) {
      prices.set(propertyId, 100000); // $100k per share placeholder
    }

    return prices;
  }
}
