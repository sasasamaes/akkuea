import type { PropertyInfo } from '@real-estate-defi/shared';
import {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  NotImplementedError,
} from '@real-estate-defi/shared';
import { logger } from '../services/logger';
import { propertyRepository, type PropertyFilter, type PaginatedResult } from '../repositories/PropertyRepository';
import { userRepository } from '../repositories/UserRepository';
import type { Property, NewProperty, PropertyDocument } from '../db/schema';

/**
 * DTO for creating a property
 */
export interface CreatePropertyInput {
  name: string;
  description: string;
  propertyType: 'residential' | 'commercial' | 'industrial' | 'land' | 'mixed';
  location: {
    address: string;
    city: string;
    country: string;
    postalCode?: string;
    coordinates?: { latitude: number; longitude: number };
  };
  totalValue: string; // Decimal as string for precision
  totalShares: number;
  pricePerShare: string; // Decimal as string for precision
  images: string[];
}

/**
 * DTO for updating a property
 */
export interface UpdatePropertyInput {
  name?: string;
  description?: string;
  propertyType?: 'residential' | 'commercial' | 'industrial' | 'land' | 'mixed';
  location?: {
    address: string;
    city: string;
    country: string;
    postalCode?: string;
    coordinates?: { latitude: number; longitude: number };
  };
  totalValue?: string; // Decimal as string for precision
  pricePerShare?: string; // Decimal as string for precision
  images?: string[];
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Maps database Property to shared PropertyInfo type
 */
async function mapPropertyToPropertyInfo(
  property: Property & { documents?: PropertyDocument[] },
  ownerAddress?: string
): Promise<PropertyInfo> {
  // Get owner's wallet address if not provided
  let walletAddress = ownerAddress;
  if (!walletAddress) {
    const owner = await userRepository.findById(property.ownerId);
    walletAddress = owner?.walletAddress ?? '';
  }

  return {
    id: property.id,
    name: property.name,
    description: property.description,
    propertyType: property.propertyType,
    location: property.location,
    totalValue: property.totalValue, // Already a string in DB
    tokenAddress: property.tokenAddress ?? undefined,
    totalShares: property.totalShares,
    availableShares: property.availableShares,
    pricePerShare: property.pricePerShare, // Already a string in DB
    images: property.images,
    documents: (property.documents ?? []).map((doc) => ({
      id: doc.id,
      type: doc.type,
      name: doc.name,
      url: doc.url,
      uploadedAt: doc.uploadedAt.toISOString(),
      verified: doc.verified,
    })),
    verified: property.verified,
    listedAt: property.listedAt.toISOString(),
    owner: walletAddress,
  };
}

/**
 * Validates pagination parameters
 */
function validatePagination(page: unknown, limit: unknown): { page: number; limit: number } {
  const pageNum = typeof page === 'string' ? parseInt(page, 10) : typeof page === 'number' ? page : 1;
  const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : typeof limit === 'number' ? limit : 10;

  return {
    page: pageNum > 0 ? pageNum : 1,
    limit: limitNum > 0 && limitNum <= 100 ? limitNum : 10,
  };
}

export class PropertyController {
  /**
   * Get properties with pagination and filters
   */
  static async getProperties(query?: {
    page?: string | number;
    limit?: string | number;
    ownerId?: string;
    city?: string;
    country?: string;
    propertyType?: string;
    minPricePerShare?: string | number;
    maxPricePerShare?: string | number;
    minAvailableShares?: string | number;
    hasAvailableShares?: string | boolean;
    verified?: string | boolean;
  }): Promise<PaginatedResponse<PropertyInfo>> {
    const startTime = Date.now();
    logger.info('Fetching properties', { operation: 'READ', entity: 'property' });

    try {
      const pagination = validatePagination(query?.page, query?.limit);

      const filter: PropertyFilter = {};

      if (query?.ownerId) filter.ownerId = query.ownerId;
      if (query?.city) filter.city = query.city;
      if (query?.country) filter.country = query.country;
      if (query?.propertyType && ['residential', 'commercial', 'industrial', 'land', 'mixed'].includes(query.propertyType)) {
        filter.propertyType = query.propertyType as PropertyFilter['propertyType'];
      }
      if (query?.minPricePerShare !== undefined) {
        filter.minPricePerShare = Number(query.minPricePerShare);
      }
      if (query?.maxPricePerShare !== undefined) {
        filter.maxPricePerShare = Number(query.maxPricePerShare);
      }
      if (query?.minAvailableShares !== undefined) {
        filter.minAvailableShares = Number(query.minAvailableShares);
      }
      if (query?.hasAvailableShares === 'true' || query?.hasAvailableShares === true) {
        filter.hasAvailableShares = true;
      }
      if (query?.verified === 'true' || query?.verified === true) {
        filter.verified = true;
      }

      const result: PaginatedResult<Property> = await propertyRepository.findPaginated(
        pagination,
        Object.keys(filter).length > 0 ? filter : undefined
      );

      // Map properties to PropertyInfo
      const properties = await Promise.all(
        result.data.map((property) => mapPropertyToPropertyInfo(property))
      );

      logger.info('Properties fetched successfully', {
        operation: 'READ',
        entity: 'property',
        count: properties.length,
        duration: Date.now() - startTime,
      });

      return {
        data: properties,
        pagination: result.pagination,
      };
    } catch (error) {
      logger.error('Failed to fetch properties', { error, operation: 'READ', entity: 'property' });
      throw error;
    }
  }

  /**
   * Get a single property by ID
   */
  static async getProperty(id: string): Promise<PropertyInfo> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required', [{ field: 'id', message: 'Property ID is required' }]);
    }

    logger.info('Fetching property', { operation: 'READ', entity: 'property', entityId: id });

    try {
      const property = await propertyRepository.findByIdWithDocuments(id);

      if (!property) {
        throw new NotFoundError('Property', id);
      }

      const propertyInfo = await mapPropertyToPropertyInfo(property);

      logger.info('Property fetched successfully', {
        operation: 'READ',
        entity: 'property',
        entityId: id,
        duration: Date.now() - startTime,
      });

      return propertyInfo;
    } catch (error) {
      logger.error('Failed to fetch property', { error, operation: 'READ', entity: 'property', entityId: id });
      throw error;
    }
  }

  /**
   * Create a new property
   */
  static async createProperty(
    data: CreatePropertyInput,
    userAddress: string,
  ): Promise<PropertyInfo> {
    const startTime = Date.now();
    logger.info('Creating property', { operation: 'CREATE', entity: 'property', userId: userAddress });

    try {
      // Validate required fields
      if (!data.name || data.name.trim().length === 0) {
        throw new ValidationError('Property name is required');
      }
      if (!data.description || data.description.length < 10) {
        throw new ValidationError('Description must be at least 10 characters');
      }
      if (!data.location) {
        throw new ValidationError('Location is required');
      }
      if (data.totalShares <= 0) {
        throw new ValidationError('Total shares must be positive');
      }
      const pricePerShare = parseFloat(data.pricePerShare);
      if (isNaN(pricePerShare) || pricePerShare <= 0) {
        throw new ValidationError('Price per share must be positive');
      }
      if (!data.images || data.images.length === 0) {
        throw new ValidationError('At least one image is required');
      }

      // Get or create user by wallet address
      const user = await userRepository.getOrCreateByWallet(userAddress);

      // Create property
      const newProperty: NewProperty = {
        name: data.name,
        description: data.description,
        propertyType: data.propertyType,
        location: data.location,
        totalValue: data.totalValue, // Already a string from validation
        totalShares: data.totalShares,
        availableShares: data.totalShares, // Initially all shares are available
        pricePerShare: data.pricePerShare, // Already a string from validation
        images: data.images,
        verified: false,
        ownerId: user.id,
      };

      const property = await propertyRepository.create(newProperty);
      const propertyInfo = await mapPropertyToPropertyInfo(property, userAddress);

      logger.info('Property created successfully', {
        operation: 'CREATE',
        entity: 'property',
        entityId: property.id,
        duration: Date.now() - startTime,
      });

      return propertyInfo;
    } catch (error) {
      logger.error('Failed to create property', { error, operation: 'CREATE', entity: 'property' });
      throw error;
    }
  }

  /**
   * Update an existing property
   */
  static async updateProperty(
    id: string,
    data: UpdatePropertyInput,
    userAddress: string,
  ): Promise<PropertyInfo> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required');
    }

    if (!userAddress) {
      throw new AuthenticationError('User address is required for authentication');
    }

    logger.info('Updating property', { operation: 'UPDATE', entity: 'property', entityId: id, userId: userAddress });

    try {
      // Check if property exists
      const property = await propertyRepository.findById(id);

      if (!property) {
        throw new NotFoundError('Property', id);
      }

      // Verify ownership
      const owner = await userRepository.findById(property.ownerId);
      if (!owner || owner.walletAddress !== userAddress) {
        throw new AuthorizationError('You do not have permission to update this property');
      }

      // Build update data
      const updateData: Partial<NewProperty> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.propertyType !== undefined) updateData.propertyType = data.propertyType;
      if (data.location !== undefined) updateData.location = data.location;
      if (data.totalValue !== undefined) updateData.totalValue = data.totalValue; // Already a string
      if (data.pricePerShare !== undefined) updateData.pricePerShare = data.pricePerShare; // Already a string
      if (data.images !== undefined) updateData.images = data.images;

      const updatedProperty = await propertyRepository.update(id, updateData);

      if (!updatedProperty) {
        throw new Error('Failed to update property');
      }

      const propertyInfo = await mapPropertyToPropertyInfo(updatedProperty, userAddress);

      logger.info('Property updated successfully', {
        operation: 'UPDATE',
        entity: 'property',
        entityId: id,
        duration: Date.now() - startTime,
      });

      return propertyInfo;
    } catch (error) {
      logger.error('Failed to update property', { error, operation: 'UPDATE', entity: 'property', entityId: id });
      throw error;
    }
  }

  /**
   * Delete a property
   */
  static async deleteProperty(id: string, userAddress: string): Promise<{ success: boolean }> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required');
    }

    if (!userAddress) {
      throw new AuthenticationError('User address is required for authentication');
    }

    logger.info('Deleting property', { operation: 'DELETE', entity: 'property', entityId: id, userId: userAddress });

    try {
      // Check if property exists
      const property = await propertyRepository.findById(id);

      if (!property) {
        throw new NotFoundError('Property', id);
      }

      // Verify ownership
      const owner = await userRepository.findById(property.ownerId);
      if (!owner || owner.walletAddress !== userAddress) {
        throw new AuthorizationError('You do not have permission to delete this property');
      }

      // Delete property
      const deleted = await propertyRepository.delete(id);

      if (!deleted) {
        throw new Error('Failed to delete property');
      }

      logger.info('Property deleted successfully', {
        operation: 'DELETE',
        entity: 'property',
        entityId: id,
        duration: Date.now() - startTime,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete property', { error, operation: 'DELETE', entity: 'property', entityId: id });
      throw error;
    }
  }

  /**
   * Tokenize a property on the blockchain
   * Note: This feature is planned for Cycle 2
   */
  static async tokenizeProperty(
    id: string,
    _data: unknown,
    userAddress?: string,
  ): Promise<never> {
    logger.info('Tokenization attempted', {
      operation: 'TOKENIZE',
      entity: 'property',
      entityId: id,
      userId: userAddress,
    });

    throw new NotImplementedError('Property tokenization');
  }

  /**
   * Buy shares of a property
   * Note: This feature is planned for Cycle 2
   */
  static async buyShares(
    id: string,
    data: { buyer: string; shares: number },
  ): Promise<never> {
    logger.info('Share purchase attempted', {
      operation: 'BUY_SHARES',
      entity: 'property',
      entityId: id,
      userId: data.buyer,
      shares: data.shares,
    });

    throw new NotImplementedError('Share purchasing');
  }

  /**
   * Get user's share ownership for a property
   * Note: This feature is planned for Cycle 2
   */
  static async getUserShares(id: string, owner: string): Promise<never> {
    logger.info('Share ownership lookup attempted', {
      operation: 'GET_SHARES',
      entity: 'property',
      entityId: id,
      userId: owner,
    });

    throw new NotImplementedError('Share ownership lookup');
  }
}
