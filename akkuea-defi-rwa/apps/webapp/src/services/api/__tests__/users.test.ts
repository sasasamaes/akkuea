import { describe, it, expect, beforeEach, mock } from "bun:test";
import { userApi } from "../users";
import { setupMockFetch, wrapFetchMock } from "./helpers";
import type { KycDocument, Transaction, User } from "@real-estate-defi/shared";

// Valid Stellar address for tests
const VALID_STELLAR_ADDRESS = "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU";

describe("User API", () => {
  beforeEach(() => {
    global.fetch = wrapFetchMock(
      mock(() => {
        throw new Error("fetch not mocked");
      }),
    );
  });

  describe("getByWallet", () => {
    it("fetches user by wallet address", async () => {
      const mockUser: User = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        walletAddress: VALID_STELLAR_ADDRESS,
        email: "user@example.com",
        displayName: "Test User",
        kycStatus: "pending",
        kycTier: "none",
        kycDocuments: [],
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockUser,
      });
      global.fetch = fetchMock;

      const result = await userApi.getByWallet(VALID_STELLAR_ADDRESS);

      expect(result).toEqual(mockUser);
      expect(calls[0].url).toBe(`http://localhost:3001/users/${VALID_STELLAR_ADDRESS}`);
      expect(calls[0].options.method).toBe("GET");
    });
  });

  describe("connectWallet", () => {
    it("connects wallet and returns token", async () => {
      const connectPayload = {
        signature: "0xsig123456",
        message: "Connect wallet message",
      };

      const mockResponse: { token: string; user: User } = {
        token: "auth-token-123",
        user: {
          id: "550e8400-e29b-41d4-a716-446655440001",
          walletAddress: VALID_STELLAR_ADDRESS,
          email: "user@example.com",
          displayName: "Test User",
          kycStatus: "pending",
          kycTier: "none",
          kycDocuments: [],
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await userApi.connectWallet(VALID_STELLAR_ADDRESS, connectPayload);

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe(
        `http://localhost:3001/users/${VALID_STELLAR_ADDRESS}/wallet`,
      );
      expect(calls[0].options.method).toBe("POST");
      expect(JSON.parse(calls[0].options.body as string)).toEqual(
        connectPayload,
      );
    });
  });

  describe("getTransactions", () => {
    it("fetches user transactions", async () => {
      const mockTransactions: Transaction[] = [
        {
          id: "550e8400-e29b-41d4-a716-446655440010",
          type: "deposit",
          hash: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
          from: VALID_STELLAR_ADDRESS,
          to: VALID_STELLAR_ADDRESS,
          amount: "1000",
          asset: "USDC",
          status: "confirmed",
          timestamp: "2024-01-15T10:00:00Z",
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440011",
          type: "borrow",
          hash: "def456abc123def456abc123def456abc123def456abc123def456abc123defg",
          from: VALID_STELLAR_ADDRESS,
          to: VALID_STELLAR_ADDRESS,
          amount: "500",
          asset: "USDC",
          status: "pending",
          timestamp: "2024-01-15T12:00:00Z",
        },
      ];

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockTransactions,
      });
      global.fetch = fetchMock;

      const result = await userApi.getTransactions(VALID_STELLAR_ADDRESS);

      expect(result).toEqual(mockTransactions);
      expect(calls[0].url).toBe(
        `http://localhost:3001/users/${VALID_STELLAR_ADDRESS}/transactions`,
      );
      expect(calls[0].options.method).toBe("GET");
    });
  });

  describe("getPortfolio", () => {
    it("fetches user portfolio", async () => {
      const mockPortfolio = {
        properties: [
          { propertyId: "550e8400-e29b-41d4-a716-446655440001", shares: 10 },
          { propertyId: "550e8400-e29b-41d4-a716-446655440002", shares: 5 },
        ],
        deposits: [{ poolId: "550e8400-e29b-41d4-a716-446655440010", amount: 1000 }],
        borrows: [{ poolId: "550e8400-e29b-41d4-a716-446655440010", amount: 500 }],
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockPortfolio,
      });
      global.fetch = fetchMock;

      const result = await userApi.getPortfolio(VALID_STELLAR_ADDRESS);

      expect(result).toEqual(mockPortfolio);
      expect(calls[0].url).toBe(
        `http://localhost:3001/users/${VALID_STELLAR_ADDRESS}/portfolio`,
      );
      expect(calls[0].options.method).toBe("GET");
    });
  });

  describe("getKycStatus", () => {
    it("fetches KYC status", async () => {
      const mockKycStatus = {
        status: "approved",
        tier: "verified",
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockKycStatus,
      });
      global.fetch = fetchMock;

      const result = await userApi.getKycStatus("550e8400-e29b-41d4-a716-446655440001");

      expect(result).toEqual(mockKycStatus);
      expect(calls[0].url).toBe("http://localhost:3001/kyc/status/550e8400-e29b-41d4-a716-446655440001");
      expect(calls[0].options.method).toBe("GET");
    });
  });

  describe("submitKyc", () => {
    it("submits KYC for verification", async () => {
      const submitPayload = {
        userId: "550e8400-e29b-41d4-a716-446655440001",
        documents: [
          {
            type: "passport" as const,
            documentUrl: "https://example.com/doc.pdf",
          },
        ],
      };

      const mockResponse = {
        status: "pending",
        message: "KYC submission received",
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await userApi.submitKyc(submitPayload);

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe("http://localhost:3001/kyc/submit");
      expect(calls[0].options.method).toBe("POST");
      expect(JSON.parse(calls[0].options.body as string)).toEqual(
        submitPayload,
      );
    });
  });

  describe("getKycDocuments", () => {
    it("fetches user KYC documents", async () => {
      const mockDocuments: KycDocument[] = [
        {
          id: "550e8400-e29b-41d4-a716-446655440020",
          userId: "550e8400-e29b-41d4-a716-446655440001",
          type: "passport",
          fileName: "passport.pdf",
          fileUrl: "https://example.com/doc.pdf",
          status: "approved",
          uploadedAt: "2024-01-10T08:00:00Z",
          reviewedAt: "2024-01-12T10:00:00Z",
        },
      ];

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockDocuments,
      });
      global.fetch = fetchMock;

      const result = await userApi.getKycDocuments("550e8400-e29b-41d4-a716-446655440001");

      expect(result).toEqual(mockDocuments);
      expect(calls[0].url).toBe("http://localhost:3001/kyc/documents/550e8400-e29b-41d4-a716-446655440001");
      expect(calls[0].options.method).toBe("GET");
    });
  });
});
