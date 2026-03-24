import type { PositionHealth, LiquidationReadiness } from '@real-estate-defi/shared';
import type { BorrowPosition } from '../db/schema';
import { RiskMonitoringService } from '../services/RiskMonitoringService';
import { lendingRepository } from '../repositories/LendingRepository';

export class RiskMonitoringController {
  private static service = new RiskMonitoringService();

  static async assessAllPositions(): Promise<PositionHealth[]> {
    try {
      const positions = await this.getAllBorrowPositions();
      const collateralPrices = await this.getCollateralPrices(positions);
      return await this.service.assessPositions(positions, collateralPrices);
    } catch (error) {
      throw new Error(`Failed to assess positions: ${error}`);
    }
  }

  static async getPositionsByRisk(riskLevel?: string): Promise<PositionHealth[]> {
    const allHealth = await this.assessAllPositions();
    if (!riskLevel) return allHealth;
    return allHealth.filter((h) => h.riskLevel === riskLevel);
  }

  static async getLiquidationReadiness(positionId: string): Promise<LiquidationReadiness> {
    const allHealth = await this.assessAllPositions();
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
    return await lendingRepository.getAllBorrowPositions();
  }

  private static async getCollateralPrices(
    positions: BorrowPosition[],
  ): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    const assetAddresses = [...new Set(positions.map((p) => p.collateralAsset))];

    // Mock prices - in production, fetch from oracle/valuation service
    for (const assetAddress of assetAddresses) {
      prices.set(assetAddress, 1.0); // $1 per unit placeholder
    }

    return prices;
  }
}
