import { describe, expect, it } from "vitest";

import type { Risk } from "@/domain/analysis";
import type { ReportStatus } from "@/domain/report";
import { canReport, RISK_META, STATUS_META } from "@/lib/presentation";
import { createDemoResult } from "@/lib/analysis/demo";

describe("presentation metadata", () => {
  it("defines readable metadata for every risk and status", () => {
    const risks: Risk[] = ["NO_WATER", "UNCERTAIN", "LOW", "MEDIUM", "HIGH"];
    const statuses: ReportStatus[] = [
      "NEW",
      "IN_REVIEW",
      "ACCEPTED",
      "RESOLVED",
    ];

    expect(Object.keys(RISK_META)).toEqual(risks);
    expect(Object.keys(STATUS_META)).toEqual(statuses);
    for (const risk of risks) {
      expect(RISK_META[risk].className).toMatch(/bg-.*text-/);
      expect(RISK_META[risk].markerColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each([
    ["NO_WATER", false],
    ["UNCERTAIN", false],
    ["LOW", true],
    ["MEDIUM", true],
    ["HIGH", true],
  ] as const)(
    "allows reporting only for actionable result %s",
    (scenario, allowed) => {
      expect(canReport(createDemoResult(scenario))).toBe(allowed);
    },
  );
});
