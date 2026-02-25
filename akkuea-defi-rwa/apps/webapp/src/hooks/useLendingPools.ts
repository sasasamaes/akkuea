"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  LendingPool,
  DepositPosition,
  BorrowPosition,
} from "@real-estate-defi/shared";
import { lendingApi } from "@/services/api";

export interface UserPositions {
  deposits: DepositPosition[];
  borrows: BorrowPosition[];
}

export interface UseLendingPoolsReturn {
  /** All available lending pools from the API */
  pools: LendingPool[];
  /** Map of poolId → user's deposit + borrow positions in that pool */
  userPositions: Record<string, UserPositions>;
  /** True while the initial pools fetch or position fetch is in-flight */
  isLoading: boolean;
  /** Non-null when any fetch has failed */
  error: string | null;
  /** Re-trigger a full reload (pools + positions) */
  refetch: () => void;
}

/**
 * Fetches all lending pools and the current user's positions in each pool.
 *
 * @param userAddress - Connected wallet address, or null/undefined when disconnected.
 */
export function useLendingPools(
  userAddress?: string | null,
): UseLendingPoolsReturn {
  const [pools, setPools] = useState<LendingPool[]>([]);
  const [userPositions, setUserPositions] = useState<
    Record<string, UserPositions>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  /** Expose a refetch handle so consuming components can trigger a reload */
  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Fetch all pools
        const fetchedPools = await lendingApi.getPools();
        if (cancelled) return;
        setPools(fetchedPools);

        // 2. If a wallet is connected, fetch user positions for every pool
        if (userAddress) {
          const positionEntries = await Promise.all(
            fetchedPools.map(async (pool) => {
              const [deposits, borrows] = await Promise.all([
                lendingApi
                  .getUserDeposits(pool.id, userAddress)
                  .catch(() => [] as DepositPosition[]),
                lendingApi
                  .getUserBorrows(pool.id, userAddress)
                  .catch(() => [] as BorrowPosition[]),
              ]);
              return [pool.id, { deposits, borrows }] as const;
            }),
          );

          if (cancelled) return;
          setUserPositions(Object.fromEntries(positionEntries));
        } else {
          setUserPositions({});
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load lending pools. Please try again.";
        setError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userAddress, fetchKey]);

  return { pools, userPositions, isLoading, error, refetch };
}
