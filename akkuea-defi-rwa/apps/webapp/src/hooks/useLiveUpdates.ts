"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

export interface LiveUpdateOptions<T> {
  /** SSE endpoint URL for live updates */
  endpoint?: string;
  /** Fallback polling interval in ms (default: 30000) */
  pollingInterval?: number;
  /** Called when new data is received */
  onUpdate?: (data: T) => void;
  /** Whether live updates are enabled */
  enabled?: boolean;
  /** Maximum reconnection attempts before falling back to polling */
  maxReconnectAttempts?: number;
  /** Delay between reconnection attempts in ms */
  reconnectDelay?: number;
}

export interface UseLiveUpdatesReturn<T> {
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Last update timestamp */
  lastUpdatedAt: Date | null;
  /** Whether using fallback polling mode */
  isPolling: boolean;
  /** Latest data received from live updates */
  data: T | null;
  /** Manually trigger a refresh */
  refresh: () => void;
  /** Re-establish connection */
  reconnect: () => void;
}

const DEFAULT_POLLING_INTERVAL = 30000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 3;
const DEFAULT_RECONNECT_DELAY = 2000;

export function useLiveUpdates<T>(
  fetchFn: () => Promise<T>,
  options: LiveUpdateOptions<T> = {},
): UseLiveUpdatesReturn<T> {
  const {
    endpoint,
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    onUpdate,
    enabled = true,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    reconnectDelay = DEFAULT_RECONNECT_DELAY,
  } = options;

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [data, setData] = useState<T | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const mountedRef = useRef(true);

  const updateData = useCallback(
    (newData: T) => {
      if (!mountedRef.current) return;
      setData(newData);
      setLastUpdatedAt(new Date());
      onUpdate?.(newData);
    },
    [onUpdate],
  );

  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const result = await fetchFn();
      updateData(result);
    } catch {
      // Silently fail on polling fetch errors
    }
  }, [fetchFn, updateData]);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    setIsPolling(true);
    setConnectionStatus("connected");
    fetchData();

    pollingIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        fetchData();
      }
    }, pollingInterval);
  }, [fetchData, pollingInterval]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connectSSE = useCallback(() => {
    if (!endpoint || typeof window === "undefined") {
      startPolling();
      return;
    }

    closeEventSource();
    setConnectionStatus("connecting");

    try {
      const eventSource = new EventSource(endpoint);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!mountedRef.current) return;
        setConnectionStatus("connected");
        reconnectAttemptsRef.current = 0;
        stopPolling();
      };

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const parsedData = JSON.parse(event.data) as T;
          updateData(parsedData);
        } catch {
          // Invalid JSON, ignore
        }
      };

      eventSource.onerror = () => {
        if (!mountedRef.current) return;

        closeEventSource();
        setConnectionStatus("disconnected");

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          setConnectionStatus("connecting");

          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connectSSE();
            }
          }, reconnectDelay);
        } else {
          startPolling();
        }
      };
    } catch {
      startPolling();
    }
  }, [
    endpoint,
    closeEventSource,
    stopPolling,
    startPolling,
    updateData,
    maxReconnectAttempts,
    reconnectDelay,
  ]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    stopPolling();
    connectSSE();
  }, [stopPolling, connectSSE]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      connectSSE();
    }

    return () => {
      mountedRef.current = false;
      closeEventSource();
      stopPolling();

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled, connectSSE, closeEventSource, stopPolling]);

  return {
    connectionStatus,
    lastUpdatedAt,
    isPolling,
    data,
    refresh,
    reconnect,
  };
}

export function getTimeSinceUpdate(lastUpdatedAt: Date | null): string {
  if (!lastUpdatedAt) return "Never";

  const now = new Date();
  const diffMs = now.getTime() - lastUpdatedAt.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h ago`;
}
