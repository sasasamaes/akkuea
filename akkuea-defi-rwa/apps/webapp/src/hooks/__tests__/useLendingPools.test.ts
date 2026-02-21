import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { useLendingPools } from "../useLendingPools";
import type { LendingPool } from "@real-estate-defi/shared";

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
// Mock the lendingApi service
// ---------------------------------------------------------------------------

const mockGetPools = mock(async (): Promise<LendingPool[]> => [mockPool, mockPool2]);
const mockGetUserDeposits = mock(async () => []);
const mockGetUserBorrows = mock(async () => []);

mock.module("@/services/api", () => ({
  lendingApi: {
    getPools: mockGetPools,
    getPool: mock(async () => mockPool),
    deposit: mock(async () => ({
      transactionHash: "a".repeat(64),
      position: {},
    })),
    borrow: mock(async () => ({
      transactionHash: "b".repeat(64),
      position: {},
    })),
    getUserDeposits: mockGetUserDeposits,
    getUserBorrows: mockGetUserBorrows,
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useLendingPools", () => {
  beforeEach(() => {
    mockGetPools.mockClear();
    mockGetUserDeposits.mockClear();
    mockGetUserBorrows.mockClear();
  });

  it("starts in loading state", () => {
    const { result } = renderHook(() => useLendingPools(null));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.pools).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("loads pools after successful API fetch", async () => {
    const { result } = renderHook(() => useLendingPools(null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.pools).toHaveLength(2);
    expect(result.current.pools[0].name).toBe("USDC Stable Pool");
    expect(result.current.pools[1].name).toBe("XLM Native Pool");
    expect(result.current.error).toBeNull();
  });

  it("sets error state on API failure", async () => {
    mockGetPools.mockImplementationOnce(async () => {
      throw new Error("Network error: unable to reach server");
    });

    const { result } = renderHook(() => useLendingPools(null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Network error: unable to reach server");
    expect(result.current.pools).toEqual([]);
  });

  it("fetches user positions when wallet address is provided", async () => {
    mockGetUserDeposits.mockImplementation(async () => [
      {
        id: "dep-001",
        poolId: mockPool.id,
        depositor: VALID_STELLAR_ADDRESS,
        amount: "25000",
        shares: "25000",
        depositedAt: "2024-01-15T10:00:00Z",
        lastAccrualAt: "2024-01-15T10:00:00Z",
        accruedInterest: "12.5",
      },
    ]);

    const { result } = renderHook(() =>
      useLendingPools(VALID_STELLAR_ADDRESS),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetUserDeposits).toHaveBeenCalledWith(
      mockPool.id,
      VALID_STELLAR_ADDRESS,
    );
    const pos = result.current.userPositions[mockPool.id];
    expect(pos).toBeDefined();
    expect(pos.deposits).toHaveLength(1);
    expect(pos.deposits[0].amount).toBe("25000");
  });

  it("does not fetch user positions when no address is given", async () => {
    const { result } = renderHook(() => useLendingPools(null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetUserDeposits).not.toHaveBeenCalled();
    expect(result.current.userPositions).toEqual({});
  });

  it("refetch re-triggers pool loading", async () => {
    const { result } = renderHook(() => useLendingPools(null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetPools).toHaveBeenCalledTimes(1);

    result.current.refetch();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetPools).toHaveBeenCalledTimes(2);
  });
});
