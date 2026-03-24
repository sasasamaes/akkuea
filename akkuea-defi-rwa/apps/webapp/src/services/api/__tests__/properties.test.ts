import { describe, it, expect, beforeEach, mock } from "bun:test";
import { propertyApi } from "../properties";
import { setupMockFetch, wrapFetchMock } from "./helpers";
import type { PropertyInfo, ShareOwnership } from "@real-estate-defi/shared";

// Valid Stellar address for tests
const VALID_STELLAR_ADDRESS =
  "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU";

describe("Property API", () => {
  beforeEach(() => {
    global.fetch = wrapFetchMock(
      mock(() => {
        throw new Error("fetch not mocked");
      }),
    );
  });

  describe("getAll", () => {
    it("fetches all properties with pagination", async () => {
      const mockResponse: {
        data: PropertyInfo[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      } = {
        data: [
          {
            id: "550e8400-e29b-41d4-a716-446655440001",
            name: "Property 1",
            description: "A beautiful residential property in downtown",
            propertyType: "residential",
            location: {
              address: "123 Main St",
              city: "New York",
              country: "USA",
              postalCode: "10001",
            },
            totalValue: "1000000",
            totalShares: 1000,
            availableShares: 500,
            pricePerShare: "1000",
            images: ["https://example.com/image1.jpg"],
            documents: [],
            verified: true,
            listedAt: "2024-01-01T00:00:00Z",
            owner: VALID_STELLAR_ADDRESS,
          },
          {
            id: "550e8400-e29b-41d4-a716-446655440002",
            name: "Property 2",
            description: "A commercial property in the business district",
            propertyType: "commercial",
            location: {
              address: "456 Business Ave",
              city: "Los Angeles",
              country: "USA",
              postalCode: "90001",
            },
            totalValue: "2000000",
            totalShares: 2000,
            availableShares: 1500,
            pricePerShare: "1000",
            images: ["https://example.com/image2.jpg"],
            documents: [],
            verified: true,
            listedAt: "2024-01-02T00:00:00Z",
            owner: VALID_STELLAR_ADDRESS,
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await propertyApi.getAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockResponse.data);
      expect(result.pagination).toEqual(mockResponse.pagination);
      expect(calls[0].url).toContain("/properties");
      expect(calls[0].url).toContain("page=1");
      expect(calls[0].url).toContain("limit=10");
    });

    it("handles filters correctly", async () => {
      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: {
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        },
      });
      global.fetch = fetchMock;

      await propertyApi.getAll({
        propertyType: "residential",
        country: "USA",
        minPrice: 100000,
        maxPrice: 500000,
        verified: true,
      });

      const url = calls[0].url;
      expect(url).toContain("propertyType=residential");
      expect(url).toContain("country=USA");
      expect(url).toContain("minPrice=100000");
      expect(url).toContain("maxPrice=500000");
      expect(url).toContain("verified=true");
    });

    it("handles no parameters", async () => {
      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: {
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        },
      });
      global.fetch = fetchMock;

      await propertyApi.getAll();

      expect(calls[0].url).toBe("http://localhost:3001/properties");
    });
  });

  describe("getById", () => {
    it("fetches property by ID", async () => {
      const mockProperty: PropertyInfo = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Test Property",
        description: "A test property for unit testing purposes",
        propertyType: "residential",
        location: {
          address: "123 Test St",
          city: "Test City",
          country: "USA",
        },
        totalValue: "1000000",
        totalShares: 1000,
        availableShares: 800,
        pricePerShare: "1000",
        images: ["https://example.com/test.jpg"],
        documents: [],
        verified: true,
        listedAt: "2024-01-01T00:00:00Z",
        owner: VALID_STELLAR_ADDRESS,
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockProperty,
      });
      global.fetch = fetchMock;

      const result = await propertyApi.getById(
        "550e8400-e29b-41d4-a716-446655440001",
      );

      expect(result).toEqual(mockProperty);
      expect(calls[0].url).toBe(
        "http://localhost:3001/properties/550e8400-e29b-41d4-a716-446655440001",
      );
      expect(calls[0].options.method).toBe("GET");
    });
  });

  describe("create", () => {
    it("creates a new property", async () => {
      const createPayload = {
        name: "New Property",
        description: "A brand new property listing for investment",
        propertyType: "residential",
        location: {
          address: "123 Main St",
          city: "New York",
          country: "USA",
          postalCode: "10001",
        },
        totalValue: "1000000",
        totalShares: 1000,
        pricePerShare: "1000",
        images: ["https://example.com/image1.jpg"],
      };

      const mockResponse: PropertyInfo = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: createPayload.name,
        description: createPayload.description,
        propertyType: "residential",
        location: createPayload.location,
        totalValue: createPayload.totalValue,
        totalShares: createPayload.totalShares,
        availableShares: createPayload.totalShares,
        pricePerShare: createPayload.pricePerShare,
        images: createPayload.images,
        documents: [],
        verified: false,
        listedAt: "2024-01-15T10:00:00Z",
        owner: VALID_STELLAR_ADDRESS,
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 201,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await propertyApi.create(createPayload);

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe("http://localhost:3001/properties");
      expect(calls[0].options.method).toBe("POST");
      expect(JSON.parse(calls[0].options.body as string)).toEqual(
        createPayload,
      );
    });
  });

  describe("tokenize", () => {
    it("tokenizes a property", async () => {
      const mockResponse = {
        tokenAddress: VALID_STELLAR_ADDRESS,
        transactionHash: "0xabc123def456",
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await propertyApi.tokenize(
        "550e8400-e29b-41d4-a716-446655440001",
      );

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe(
        "http://localhost:3001/properties/550e8400-e29b-41d4-a716-446655440001/tokenize",
      );
      expect(calls[0].options.method).toBe("POST");
    });
  });

  describe("buyShares", () => {
    it("buys property shares", async () => {
      const mockResponse = {
        transactionHash: "0xdef789abc012",
        newBalance: 50,
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await propertyApi.buyShares(
        "550e8400-e29b-41d4-a716-446655440001",
        VALID_STELLAR_ADDRESS,
        50,
      );

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe(
        "http://localhost:3001/properties/550e8400-e29b-41d4-a716-446655440001/buy-shares",
      );
      expect(calls[0].options.method).toBe("POST");
      expect(JSON.parse(calls[0].options.body as string)).toEqual({
        buyer: VALID_STELLAR_ADDRESS,
        shares: 50,
      });
      expect(new Headers(calls[0].options.headers).get("x-user-address")).toBe(
        VALID_STELLAR_ADDRESS,
      );
    });
  });

  describe("getShares", () => {
    it("gets user share holdings for a property", async () => {
      const mockShareOwnership: ShareOwnership = {
        propertyId: "550e8400-e29b-41d4-a716-446655440001",
        owner: VALID_STELLAR_ADDRESS,
        shares: 100,
        purchasePrice: "10000",
        purchasedAt: "2024-01-10T14:30:00Z",
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockShareOwnership,
      });
      global.fetch = fetchMock;

      const result = await propertyApi.getShares(
        "550e8400-e29b-41d4-a716-446655440001",
        VALID_STELLAR_ADDRESS,
      );

      expect(result).toEqual(mockShareOwnership);
      expect(calls[0].url).toBe(
        `http://localhost:3001/properties/550e8400-e29b-41d4-a716-446655440001/shares/${VALID_STELLAR_ADDRESS}`,
      );
      expect(calls[0].options.method).toBe("GET");
    });

    it("handles null response when no shares found", async () => {
      const { fetchMock } = setupMockFetch({
        status: 200,
        body: null,
        headers: { "Content-Type": "application/json" },
      });
      global.fetch = fetchMock;

      const result = await propertyApi.getShares(
        "550e8400-e29b-41d4-a716-446655440001",
        VALID_STELLAR_ADDRESS,
      );

      expect(result).toBeNull();
    });
  });
});
