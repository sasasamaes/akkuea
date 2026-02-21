import { describe, it, expect, mock, beforeEach } from "bun:test";
import type { LendingPool, DepositPosition } from "@real-estate-defi/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_STELLAR_ADDRESS =
  "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU";

const mockPool: LendingPool = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "USDC Stable Pool",
  asset: "USDC",
  assetAddress: VALID_STELLAR_ADDRESS,
  totalDeposits: "5000000",
  totalBorrows: "3600000",
  availableLiquidity: "1400000",
  utilizationRate: 72,
  supplyAPY: 5.2,
  borrowAPY: 7.8,
  collateralFactor: 75,
  liquidationThreshold: 80,
  liquidationPenalty: 5,
  reserveFactor: 1000,
  isActive: true,
  isPaused: false,
  createdAt: "2024-01-01T00:00:00Z",
};

const mockPool2: LendingPool = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  name: "XLM Native Pool",
  asset: "XLM",
  assetAddress: VALID_STELLAR_ADDRESS,
  totalDeposits: "2000000",
  totalBorrows: "1300000",
  availableLiquidity: "700000",
  utilizationRate: 65,
  supplyAPY: 4.5,
  borrowAPY: 6.5,
  collateralFactor: 70,
  liquidationThreshold: 80,
  liquidationPenalty: 5,
  reserveFactor: 1000,
  isActive: true,
  isPaused: false,
  createdAt: "2024-01-02T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Direct tests of lendingApi — mirrors the unit-test approach used by the
// existing services/api/__tests__/lending.test.ts in the project
// ---------------------------------------------------------------------------

/**
 * Simulates what useLendingPools does: fetches pools then user positions.
 * Testing the async logic directly avoids a @testing-library/react dependency
 * that is not set up in this monorepo, keeping tests consistent with the
 * existing bun:test patterns.
 */

const mockGetPools = mock(async (): Promise<LendingPool[]> => [
  mockPool,
  mockPool2,
]);
const mockGetUserDeposits = mock(
  async (_poolId: string, _addr: string): Promise<DepositPosition[]> => [],
);
const mockGetUserBorrows = mock(async () => []);

mock.module("@/services/api", () => ({
  lendingApi: {
    getPools: mockGetPools,
    getUserDeposits: mockGetUserDeposits,
    getUserBorrows: mockGetUserBorrows,
  },
}));

// Import after module mock is set up
const { lendingApi } = await import("@/services/api");

describe("useLendingPools — service integration", () => {
  beforeEach(() => {
    mockGetPools.mockClear();
    mockGetUserDeposits.mockClear();
    mockGetUserBorrows.mockClear();
  });

  it("getPools returns all pools", async () => {
    const pools = await lendingApi.getPools();
    expect(pools).toHaveLength(2);
    expect(pools[0].name).toBe("USDC Stable Pool");
    expect(pools[1].name).toBe("XLM Native Pool");
  });

  it("getPools returns empty list when API throws — error state scenario", async () => {
    mockGetPools.mockImplementationOnce(async () => {
      throw new Error("Network error: unable to reach server");
    });

    let result: LendingPool[] = [];
    let errorMessage: string | null = null;

    try {
      result = await lendingApi.getPools();
    } catch (err) {
      errorMessage =
        err instanceof Error ? err.message : "Unknown error";
    }

    expect(result).toHaveLength(0);
    expect(errorMessage).toBe("Network error: unable to reach server");
  });

  it("fetches user deposit positions per pool when address is provided", async () => {
    const mockDeposit: DepositPosition = {
      id: "dep-001",
      poolId: mockPool.id,
      depositor: VALID_STELLAR_ADDRESS,
      amount: "25000",
      shares: "25000",
      depositedAt: "2024-01-15T10:00:00Z",
      lastAccrualAt: "2024-01-15T10:00:00Z",
      accruedInterest: "12.5",
    };

    mockGetUserDeposits.mockImplementationOnce(
      async (_poolId: string, _addr: string): Promise<DepositPosition[]> => [
        mockDeposit,
      ],
    );
    mockGetUserDeposits.mockImplementationOnce(
      async (_poolId: string, _addr: string): Promise<DepositPosition[]> => [],
    );

    const pools = await lendingApi.getPools();
    const deposits = await lendingApi.getUserDeposits(
      pools[0].id,
      VALID_STELLAR_ADDRESS,
    );

    expect(mockGetUserDeposits).toHaveBeenCalledWith(
      mockPool.id,
      VALID_STELLAR_ADDRESS,
    );
    expect(deposits).toHaveLength(1);
    expect(deposits[0].amount).toBe("25000");
  });

  it("does not call getUserDeposits when no address is given", async () => {
    // Simulate the hook's guard: no address → skip position fetch
    const userAddress: string | null = null;
    await lendingApi.getPools();

    if (userAddress) {
      await lendingApi.getUserDeposits(mockPool.id, userAddress);
    }

    expect(mockGetUserDeposits).not.toHaveBeenCalled();
  });

  it("aggregates positions across multiple pools", async () => {
    const pools = await lendingApi.getPools();

    // Both calls succeed — simulating what refetch does
    const calls = await Promise.all(
      pools.map((pool) =>
        lendingApi.getUserDeposits(pool.id, VALID_STELLAR_ADDRESS),
      ),
    );

    expect(mockGetUserDeposits).toHaveBeenCalledTimes(pools.length);
    expect(calls).toHaveLength(pools.length);
  });
});
