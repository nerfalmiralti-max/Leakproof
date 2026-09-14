import { describe, expect, it } from "vitest";
import { scoreEvidence, temporalEvidenceSchema } from "@/lib/analysis/scoring";
import { analysisResultSchema } from "@/lib/analysis/result-schema";
import { realCreateReportSchema } from "@/lib/reports/schemas";

const flowing = {
  quality: "GOOD",
  qualityIssues: [],
  waterDetected: true,
  waterEvidence: "STRONG",
  waterSupportingFrames: [0, 5],
  activeFlow: "YES",
  activeFlowFrames: [0, 2, 5],
  persistentSource: "YES",
  persistentSourceFrames: [0, 3, 5],
  spreading: "NO",
  spreadingFrames: [],
  evidence: [],
  sourceType: "CONTROLLED_SOURCE",
  sourceSupportingFrames: [0, 5],
};

describe("source-aware leak suspicion", () => {
  it.each(["faucet", "garden hose", "shower", "fountain"])(
    "normal %s flow stays LOW despite persistence",
    () => {
      const result = scoreEvidence(flowing);
      expect(result).toMatchObject({
        sourceType: "CONTROLLED_SOURCE",
        leakRisk: "LOW",
        activeFlow: "YES",
        persistentSource: true,
      });
      expect(result.explanation).toContain("controlled");
      expect(analysisResultSchema.safeParse(result).success).toBe(true);
    },
  );
  it("even all three temporal signals do not turn controlled flow into HIGH", () => {
    expect(
      scoreEvidence({ ...flowing, spreading: "YES", spreadingFrames: [0, 5] })
        .leakRisk,
    ).toBe("LOW");
  });
  it("off-camera source is UNCERTAIN while preserving observed flow", () => {
    const result = scoreEvidence({
      ...flowing,
      sourceType: "UNCERTAIN_SOURCE",
      sourceSupportingFrames: [],
    });
    expect(result).toMatchObject({
      sourceType: "UNCERTAIN_SOURCE",
      leakRisk: "UNCERTAIN",
      waterDetected: true,
      activeFlow: "YES",
    });
    expect(analysisResultSchema.safeParse(result).success).toBe(true);
  });
  it.each([
    "pavement crack",
    "damaged pipe connection",
    "damaged faucet connection",
  ])("independent uncontrolled release at %s allows MEDIUM/HIGH", () => {
    const suspicious = { ...flowing, sourceType: "SUSPICIOUS_SOURCE" };
    expect(scoreEvidence(suspicious).leakRisk).toBe("MEDIUM");
    expect(
      scoreEvidence({
        ...suspicious,
        spreading: "YES",
        spreadingFrames: [0, 5],
      }).leakRisk,
    ).toBe("HIGH");
  });
  it.each([[], [0, 0], [1, 2]].map((indices) => [indices]))(
    "unsupported source citations %j cannot justify LOW or elevated risk",
    (indices) => {
      for (const sourceType of ["CONTROLLED_SOURCE", "SUSPICIOUS_SOURCE"]) {
        expect(
          scoreEvidence({
            ...flowing,
            sourceType,
            sourceSupportingFrames: indices,
          }).leakRisk,
        ).toBe("UNCERTAIN");
      }
    },
  );
  it("missing source assessment cannot infer a leak from persistence", () => {
    const {
      sourceType: _type,
      sourceSupportingFrames: _frames,
      ...legacy
    } = flowing;
    void _type;
    void _frames;
    expect(scoreEvidence(legacy).leakRisk).toBe("UNCERTAIN");
    expect(
      temporalEvidenceSchema.safeParse({
        activeFlow: "YES",
        activeFlowSupportingFrames: [0, 2, 5],
        persistentSource: "YES",
        persistentSourceSupportingFrames: [0, 3, 5],
        spreading: "NO",
        spreadingSupportingFrames: [],
      }).success,
    ).toBe(false);
  });
  it("preserves NO_WATER and poor-quality UNCERTAIN precedence", () => {
    expect(
      scoreEvidence({
        ...flowing,
        waterDetected: false,
        waterEvidence: "NONE",
        waterSupportingFrames: [],
      }).leakRisk,
    ).toBe("NO_WATER");
    expect(
      scoreEvidence({ ...flowing, quality: "POOR", qualityIssues: ["BLUR"] })
        .leakRisk,
    ).toBe("UNCERTAIN");
  });
  it("accepts controlled LOW reports and rejects forged elevated risk or unknown sources", () => {
    const input = {
      analysis: scoreEvidence(flowing),
      location: { lat: 43.65, lng: 51.16 },
      locationLabel: "Test fixture",
      description: "",
      video: {
        name: "test.webm",
        size: 10,
        type: "video/webm",
        duration: 6,
        width: 640,
        height: 480,
      },
    };
    expect(realCreateReportSchema.safeParse(input).success).toBe(true);
    expect(
      realCreateReportSchema.safeParse({
        ...input,
        analysis: { ...input.analysis, leakRisk: "MEDIUM" },
      }).success,
    ).toBe(false);
    expect(
      realCreateReportSchema.safeParse({
        ...input,
        analysis: { ...input.analysis, sourceType: "UNCERTAIN_SOURCE" },
      }).success,
    ).toBe(false);
    const { sourceType: _source, ...historical } = input.analysis;
    void _source;
    expect(analysisResultSchema.safeParse(historical).success).toBe(true);
  });
});
