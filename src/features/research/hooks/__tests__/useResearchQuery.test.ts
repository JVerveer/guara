/**
 * Tests for the useResearchQuery hook.
 *
 * Verifies loading state, successful data resolution, and error handling.
 * The research service is mocked to keep tests deterministic and fast.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useResearchQuery } from "../useResearchQuery";
import type { ResearchQuery } from "../../types";

// Mock the entire researchService module
vi.mock("../../services/researchService", () => ({
  researchService: {
    getResult: vi.fn(),
  },
}));

// Import the mock after setting it up
import { researchService } from "../../services/researchService";

const MOCK_RESULT: ResearchQuery = {
  question: "Kerncijfers wijken en buurten",
  sourceCount: 1,
  confidenceScore: 100,
  evidenceSources: [],
  answerTitle: "CBS StatLine results",
  answerSummary: "Live CBS StatLine catalog result.",
  answerBullets: ["85039NED: Kerncijfers wijken en buurten 2021"],
};

describe("useResearchQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with isLoading=true and no result", () => {
    vi.mocked(researchService.getResult).mockResolvedValue(MOCK_RESULT);

    const { result } = renderHook(() => useResearchQuery());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("resolves to the research result after loading", async () => {
    vi.mocked(researchService.getResult).mockResolvedValue(MOCK_RESULT);

    const { result } = renderHook(() => useResearchQuery());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.result).toEqual(MOCK_RESULT);
    expect(result.current.error).toBeNull();
  });

  it("sets error state when the service throws", async () => {
    vi.mocked(researchService.getResult).mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useResearchQuery());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("Network failure");
    expect(result.current.result).toBeNull();
  });

  it("exposes a retry function that re-fetches", async () => {
    vi.mocked(researchService.getResult)
      .mockRejectedValueOnce(new Error("First failure"))
      .mockResolvedValue(MOCK_RESULT);

    const { result } = renderHook(() => useResearchQuery());

    // Wait for first failure
    await waitFor(() => expect(result.current.error).not.toBeNull());

    // Trigger retry
    result.current.retry();

    // Should load and then succeed
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.result).toEqual(MOCK_RESULT);
    expect(result.current.error).toBeNull();
  });
});
