"use client";

import { useCallback, useEffect, useState } from "react";
import type { PropertyInfo } from "@real-estate-defi/shared";
import { propertyApi } from "@/services/api/properties";

interface UsePropertiesResult {
  properties: PropertyInfo[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "We couldn't load marketplace properties. Please try again.";
}

export function useProperties(): UsePropertiesResult {
  const [properties, setProperties] = useState<PropertyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await propertyApi.getAll({
        limit: 100,
      });
      setProperties(response.data);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProperties();
  }, [fetchProperties]);

  return {
    properties,
    isLoading,
    error,
    refetch: fetchProperties,
  };
}
