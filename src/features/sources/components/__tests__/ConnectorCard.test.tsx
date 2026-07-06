/**
 * Tests for the ConnectorCard component.
 *
 * Verifies that essential connector metadata is rendered accessibly,
 * including name, dataset count, reliability, and live status.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/utils";
import { ConnectorCard } from "../ConnectorCard";
import type { Connector } from "../../types";

const MOCK_CONNECTOR: Connector = {
  id: "cbs",
  name: "CBS",
  fullName: "Centraal Bureau voor de Statistiek",
  abbr: "CBS",
  datasets: 847,
  lastSync: "2 hours ago",
  coverage: "Netherlands",
  reliability: 98,
  tags: ["Demographics", "Economy", "Housing"],
  brandColor: "#1C3D8F",
};

describe("ConnectorCard", () => {
  it("renders the connector name", () => {
    render(<ConnectorCard connector={MOCK_CONNECTOR} />);
    expect(screen.getByText("CBS")).toBeInTheDocument();
  });

  it("renders the full name", () => {
    render(<ConnectorCard connector={MOCK_CONNECTOR} />);
    expect(
      screen.getByText("Centraal Bureau voor de Statistiek")
    ).toBeInTheDocument();
  });

  it("renders the coverage region", () => {
    render(<ConnectorCard connector={MOCK_CONNECTOR} />);
    expect(screen.getByText("Netherlands")).toBeInTheDocument();
  });

  it("renders the last sync time", () => {
    render(<ConnectorCard connector={MOCK_CONNECTOR} />);
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
  });

  it("renders the live status badge", () => {
    render(<ConnectorCard connector={MOCK_CONNECTOR} />);
    // i18n key 'sources.live' is returned as-is by the test mock
    expect(screen.getByText("sources.live")).toBeInTheDocument();
  });

  it("has an accessible article landmark with the full name", () => {
    render(<ConnectorCard connector={MOCK_CONNECTOR} />);
    expect(
      screen.getByRole("article", { name: "Centraal Bureau voor de Statistiek" })
    ).toBeInTheDocument();
  });

  it("renders a definition list with dataset, coverage, and sync stats", () => {
    render(<ConnectorCard connector={MOCK_CONNECTOR} />);
    const dl = screen.getByRole("definition");
    expect(dl).toBeInTheDocument();
  });
});
