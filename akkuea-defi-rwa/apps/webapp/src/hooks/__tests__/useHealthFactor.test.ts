import { describe, it, expect } from "bun:test";
import { renderHook } from "@testing-library/react";
import { useHealthFactor } from "../useHealthFactor";
import type { BorrowPosition } from "@real-estate-defi/shared";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const VALID_STELLAR_ADDRESS =
  "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU";

function makeBorrow(
  overrides: Partial<BorrowPosition> = {},
): BorrowPosition {
  return {
    id: "borrow-001",
    poolId: "550e8400-e29b-41d4-a716-446655440001",
    borrower: VALID_STELLAR_ADDRESS,
    principal: "10000",
    accruedInterest: "0",
    collateralAmount: "20000",
    collateralAsset: VALID_STELLAR_ADDRESS,
    healthFactor: 2.0,
    borrowedAt: "2024-01-15T10:00:00Z",
    lastAccrualAt: "2024-01-15T10:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useHealthFactor", () => {
  it('returns status "none" and Infinity when there are no borrow positions', () => {
    const { result } = renderHook(() => useHealthFactor([]));
    expect(result.current.status).toBe("none");
    expect(result.current.healthFactor).toBe(Infinity);
  });

  it('returns status "safe" when health factor is >= 1.5', () => {
    const { result } = renderHook(() =>
      useHealthFactor([makeBorrow({ healthFactor: 2.45 })]),
    );
    expect(result.current.status).toBe("safe");
    expect(result.current.healthFactor).toBeCloseTo(2.45, 1);
  });

  it('returns status "warning" when health factor is between 1.1 and 1.5', () => {
    const { result } = renderHook(() =>
      useHealthFactor([makeBorrow({ healthFactor: 1.3 })]),
    );
    expect(result.current.status).toBe("warning");
    expect(result.current.healthFactor).toBeCloseTo(1.3, 1);
  });

  it('returns status "critical" when health factor is below 1.1', () => {
    const { result } = renderHook(() =>
      useHealthFactor([makeBorrow({ healthFactor: 0.95 })]),
    );
    expect(result.current.status).toBe("critical");
    expect(result.current.healthFactor).toBeCloseTo(0.95, 1);
  });

  it("computes weighted-average health factor across multiple borrows", () => {
    // Pool A: debt=10000, hf=2.0  |  Pool B: debt=30000, hf=1.0
    // weighted avg = (2.0 * 10000 + 1.0 * 30000) / 40000 = 50000/40000 = 1.25
    const borrows: BorrowPosition[] = [
      makeBorrow({
        id: "b-001",
        principal: "10000",
        accruedInterest: "0",
        healthFactor: 2.0,
      }),
      makeBorrow({
        id: "b-002",
        principal: "30000",
        accruedInterest: "0",
        healthFactor: 1.0,
      }),
    ];

    const { result } = renderHook(() => useHealthFactor(borrows));
    expect(result.current.healthFactor).toBeCloseTo(1.25, 1);
    expect(result.current.status).toBe("warning");
  });

  it("includes accrued interest in the debt weighting", () => {
    // debt = principal(5000) + accruedInterest(5000) = 10000
    const { result } = renderHook(() =>
      useHealthFactor([
        makeBorrow({
          principal: "5000",
          accruedInterest: "5000",
          healthFactor: 1.5,
        }),
      ]),
    );
    expect(result.current.healthFactor).toBeCloseTo(1.5, 1);
    expect(result.current.status).toBe("safe");
  });

  it('ignores borrow positions with principal of 0', () => {
    const { result } = renderHook(() =>
      useHealthFactor([
        makeBorrow({ principal: "0", accruedInterest: "0", healthFactor: 0.5 }),
      ]),
    );
    // Zero-debt position is excluded → no effective borrows → "none"
    expect(result.current.status).toBe("none");
  });
});
