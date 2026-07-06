import { useEffect, useMemo, useState } from "react";
import { graphService } from "../services/graphService";
import type { ResearchGraph } from "../types";

interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  totalDatasets: number;
}

interface UseResearchGraphResult {
  graph: ResearchGraph | null;
  stats: GraphStats;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
}

/**
 * Fetches the full knowledge graph for the graph explorer screen.
 * Computes aggregate stats (node count, total datasets) as derived values.
 */
export function useResearchGraph(): UseResearchGraphResult {
  const [graph, setGraph] = useState<ResearchGraph | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    graphService
      .getMainGraph()
      .then((data) => {
        if (!cancelled) setGraph(data);
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

  const stats = useMemo<GraphStats>(
    () => ({
      nodeCount: graph?.nodes.length ?? 0,
      edgeCount: graph?.edges.length ?? 0,
      totalDatasets: graph?.nodes.reduce((sum, n) => sum + (n.datasets ?? 0), 0) ?? 0,
    }),
    [graph]
  );

  const retry = () => setFetchKey((k) => k + 1);

  return { graph, stats, isLoading, error, retry };
}
