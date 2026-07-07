/**
 * Tests for the DatasetCard component.
 *
 * Verifies that the card renders essential dataset metadata and exposes
 * an accessible "Explore" action that triggers navigation.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "@/test/utils";
import { DatasetCard } from "../DatasetCard";
import type { Dataset } from "../../types";

const MOCK_DATASET: Dataset = {
  id: "test-dataset-1",
  title: "Kerncijfers wijken en buurten 2023",
  provider: "CBS",
  description: "Key figures for all Dutch neighborhoods and districts.",
  tags: ["Population", "Housing"],
  updated: "Jan 15, 2024",
  updatedAt: "2024-01-15T00:00:00",
  records: "87,432",
  recordCount: 87432,
  topics: 24,
  qualification: {
    yearStart: 1970,
    yearEnd: 2023,
    years: [1970, 2023],
    geographicLevels: ["neighborhood", "municipality"],
    spatialCoverage: "Netherlands — all municipalities, wijken and buurten",
    periodSource: "perioden-dimension",
    confidence: "cbs-metadata",
    evidence: ["test"],
  },
};

describe("DatasetCard", () => {
  it("renders the dataset title", () => {
    render(<DatasetCard dataset={MOCK_DATASET} setScreen={vi.fn()} />);
    expect(screen.getByText("Kerncijfers wijken en buurten 2023")).toBeInTheDocument();
  });

  it("renders the provider name", () => {
    render(<DatasetCard dataset={MOCK_DATASET} setScreen={vi.fn()} />);
    expect(screen.getByText("CBS")).toBeInTheDocument();
  });

  it("renders the dataset description", () => {
    render(<DatasetCard dataset={MOCK_DATASET} setScreen={vi.fn()} />);
    expect(
      screen.getByText("Key figures for all Dutch neighborhoods and districts.")
    ).toBeInTheDocument();
  });

  it("renders the record count", () => {
    render(<DatasetCard dataset={MOCK_DATASET} setScreen={vi.fn()} />);
    expect(screen.getAllByText("87,432").length).toBeGreaterThan(0);
  });

  it("renders the last updated date", () => {
    render(<DatasetCard dataset={MOCK_DATASET} setScreen={vi.fn()} />);
    expect(screen.getAllByText("Jan 15, 2024").length).toBeGreaterThan(0);
  });

  it("calls setScreen with 'dataset-detail' when Explore is clicked", async () => {
    const user = userEvent.setup();
    const mockSetScreen = vi.fn();
    render(<DatasetCard dataset={MOCK_DATASET} setScreen={mockSetScreen} />);

    // The button text comes from i18n key `datasets.exploreDataset`
    // which our mock returns as the key itself
    await user.click(screen.getByRole("button", { name: /datasets\.exploreDataset/i }));
    expect(mockSetScreen).toHaveBeenCalledWith("dataset-detail");
  });
});
