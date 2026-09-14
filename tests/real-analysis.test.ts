import { describe, expect, it } from "vitest";
import {
  scoreEvidence,
  visionEvidenceSchema,
  type VisionEvidence,
} from "@/lib/analysis/scoring";

const water: VisionEvidence = {
  quality: "GOOD",
  qualityIssues: [],
  waterDetected: true,
  waterEvidence: "STRONG",
  waterSupportingFrames: [0, 5],
  activeFlow: "NO",
  persistentSource: "NO",
  spreading: "NO",
  activeFlowFrames: [],
  persistentSourceFrames: [],
  spreadingFrames: [],
  sourceType: "SUSPICIOUS_SOURCE",
  sourceSupportingFrames: [0, 5],
  evidence: [],
};
describe("defensive real evidence scoring", () => {
  it("dry or weak water evidence never creates an actionable risk", () => {
    for (const waterEvidence of ["NONE", "WEAK"] as const) {
      const result = scoreEvidence({
        ...water,
        waterEvidence,
        waterDetected: false,
      });
      expect(result).toMatchObject({
        leakRisk: "NO_WATER",
        waterDetected: false,
        waterConfidence: null,
        activeFlowProbability: null,
        persistentSource: null,
        spreadingDetected: null,
      });
    }
  });
  it("poor quality takes precedence even over an apparent no-water observation", () => {
    expect(
      scoreEvidence({
        ...water,
        quality: "POOR",
        qualityIssues: ["DARKNESS"],
        waterDetected: false,
        waterEvidence: "NONE",
      }).leakRisk,
    ).toBe("UNCERTAIN");
  });
  it("water without active signals is low", () => {
    expect(scoreEvidence(water).leakRisk).toBe("LOW");
  });
  it("one temporally supported signal is medium", () => {
    expect(
      scoreEvidence({
        ...water,
        activeFlow: "YES",
        activeFlowFrames: [0, 2, 5],
      }).leakRisk,
    ).toBe("MEDIUM");
  });
  it("high requires strong water plus all three temporally supported signals", () => {
    const signals: VisionEvidence = {
      ...water,
      activeFlow: "YES",
      persistentSource: "YES",
      spreading: "YES",
      activeFlowFrames: [0, 2, 5],
      persistentSourceFrames: [0, 3, 5],
      spreadingFrames: [0, 5],
    };
    expect(scoreEvidence(signals).leakRisk).toBe("HIGH");
    expect(
      scoreEvidence({ ...signals, waterEvidence: "MODERATE" }).leakRisk,
    ).toBe("MEDIUM");
    expect(scoreEvidence(signals)).toEqual(scoreEvidence(signals));
    expect(scoreEvidence(signals)).toMatchObject({
      waterConfidence: null,
      activeFlowProbability: null,
      activeFlow: "YES",
    });
  });
  it("unsupported or duplicated temporal citations cannot create high risk", () => {
    expect(
      scoreEvidence({
        ...water,
        activeFlow: "YES",
        activeFlowFrames: [0, 0, 0],
      }).leakRisk,
    ).toBe("UNCERTAIN");
    expect(
      scoreEvidence({
        ...water,
        activeFlow: "UNCERTAIN",
        persistentSource: "UNCERTAIN",
      }).leakRisk,
    ).toBe("UNCERTAIN");
  });
  it("rejects malformed provider fields, invented probabilities and frame indices", () => {
    expect(
      visionEvidenceSchema.safeParse({ ...water, activeFlow: 0.95 }).success,
    ).toBe(false);
    expect(
      visionEvidenceSchema.safeParse({ ...water, confidence: 95 }).success,
    ).toBe(false);
    expect(
      visionEvidenceSchema.safeParse({ ...water, activeFlowFrames: [99] })
        .success,
    ).toBe(false);
  });
});
