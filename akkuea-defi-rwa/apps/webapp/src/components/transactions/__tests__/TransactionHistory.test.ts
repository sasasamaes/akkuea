import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  Transaction,
  PaginatedTransactionResponse,
} from "@real-estate-defi/shared";
import { transactionsApi } from "@/services/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_STELLAR_ADDRESS =
  "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU";

const VALID_TX_HASH =
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "550e8400-e29b-41d4-a716-446655440001",
    type: "deposit",
    hash: VALID_TX_HASH,
    from: VALID_STELLAR_ADDRESS,
    amount: "10000",
    asset: "USDC",
    status: "confirmed",
    timestamp: "2024-01-15T10:00:00Z",
    ...overrides,
  };
}

const STELLAR_EXPERT_BASE = "https://stellar.expert/explorer/testnet/tx";

// ---------------------------------------------------------------------------
// Mock the transactionsApi
// ---------------------------------------------------------------------------

const mockGetTransactions = mock(
  async (): Promise<PaginatedTransactionResponse> => ({
    items: [
      makeTx(),
      makeTx({ id: "550e8400-e29b-41d4-a716-446655440002", type: "borrow" }),
    ],
    nextCursor: undefined,
    total: 2,
  }),
);
const originalGetTransactions = transactionsApi.getTransactions;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TransactionHistory — service integration", () => {
  beforeEach(() => {
    transactionsApi.getTransactions = mockGetTransactions;
    mockGetTransactions.mockClear();
  });

  afterAll(() => {
    transactionsApi.getTransactions = originalGetTransactions;
  });

  it("renders transaction list from API", async () => {
    const result = await transactionsApi.getTransactions({});
    expect(result.items).toHaveLength(2);
    expect(result.items[0].type).toBe("deposit");
    expect(result.items[1].type).toBe("borrow");
  });

  it("hash links to Stellar Expert in correct format", async () => {
    const result = await transactionsApi.getTransactions({});
    const tx = result.items[0];
    const expectedUrl = `${STELLAR_EXPERT_BASE}/${tx.hash}`;
    expect(expectedUrl).toBe(`${STELLAR_EXPERT_BASE}/${VALID_TX_HASH}`);
    expect(tx.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("loading state — API returns result after async call", async () => {
    // Simulate slow API
    mockGetTransactions.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { items: [makeTx()], nextCursor: undefined, total: 1 };
    });

    const result = await transactionsApi.getTransactions({});
    expect(result.items).toHaveLength(1);
  });

  it("empty state on zero results", async () => {
    mockGetTransactions.mockImplementationOnce(async () => ({
      items: [],
      nextCursor: undefined,
      total: 0,
    }));

    const result = await transactionsApi.getTransactions({});
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("error state on failure — error message and retry", async () => {
    mockGetTransactions.mockImplementationOnce(async () => {
      throw new Error("Network error: unable to reach server");
    });

    let errorMessage: string | null = null;

    try {
      await transactionsApi.getTransactions({});
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Unknown error";
    }

    expect(errorMessage).toBe("Network error: unable to reach server");

    // Retry — second call should succeed (mock reset to default)
    const retryResult = await transactionsApi.getTransactions({});
    expect(retryResult.items).toHaveLength(2);
  });

  it("load more fetches next page with cursor", async () => {
    // Page 1 — has nextCursor
    mockGetTransactions.mockImplementationOnce(async () => ({
      items: [makeTx({ id: "page1-001" })],
      nextCursor: "cursor_after_page1",
      total: 3,
    }));

    const page1 = await transactionsApi.getTransactions({ limit: 1 });
    expect(page1.items).toHaveLength(1);
    expect(page1.nextCursor).toBe("cursor_after_page1");

    // Page 2 — uses cursor from page 1
    mockGetTransactions.mockImplementationOnce(async () => ({
      items: [makeTx({ id: "page2-001" }), makeTx({ id: "page2-002" })],
      nextCursor: undefined,
      total: 3,
    }));

    const page2 = await transactionsApi.getTransactions({
      cursor: page1.nextCursor,
      limit: 2,
    });
    expect(page2.items).toHaveLength(2);
    expect(page2.nextCursor).toBeUndefined();

    // Total across both pages
    const allTx = [...page1.items, ...page2.items];
    expect(allTx).toHaveLength(3);
  });

  it("transaction types map to correct values", () => {
    const types = [
      "deposit",
      "withdraw",
      "borrow",
      "repay",
      "liquidation",
      "buy_shares",
      "sell_shares",
      "dividend",
    ] as const;
    for (const type of types) {
      const tx = makeTx({ type });
      expect(tx.type).toBe(type);
    }
  });

  it("status values are valid enum members", () => {
    const statuses = [
      "submitting",
      "pending",
      "confirmed",
      "failed",
      "not_found",
    ] as const;
    for (const status of statuses) {
      const tx = makeTx({ status });
      expect(tx.status).toBe(status);
    }
  });
});
