// Re-export types from schemas (single source of truth)
export type {
  PropertyLocation,
  PropertyDocument,
  PropertyInfo,
  ShareOwnership,
} from "../schemas/property.schema";

export type {
  LendingPool,
  DepositPosition,
  BorrowPosition,
} from "../schemas/lending.schema";

export type {
  TransactionType,
  TransactionStatus,
  Transaction,
  TransactionFilter,
  TransactionQueryParams,
  PaginatedTransactionResponse,
} from "../schemas/transaction.schema";

export type {
  KycStatus,
  KycTier,
  KycDocument,
  User,
  OraclePrice,
} from "../schemas/user.schema";

// Keep pagination types (schema-independent)
export * from "./pagination";

// Observability contracts
export * from "./observability";
