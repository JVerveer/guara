import { useEffect, useMemo, useState } from "react";
import { connectorService } from "../services/connectorService";
import type { Connector } from "../types";

interface UseConnectorsResult {
  connectors: Connector[];
  /** Sum of all datasets across all connectors */
  totalDatasets: number;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
}

/**
 * Fetches the list of registered data connectors (CBS, KNMI, Kadaster, etc.)
 * and exposes aggregate statistics.
 */
export function useConnectors(): UseConnectorsResult {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    connectorService
      .getAllConnectors()
      .then((data) => {
        if (!cancelled) setConnectors(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  const totalDatasets = useMemo(
    () => connectors.reduce((sum, c) => sum + c.datasets, 0),
    [connectors]
  );

  const retry = () => setFetchKey((k) => k + 1);

  return { connectors, totalDatasets, isLoading, error, retry };
}
