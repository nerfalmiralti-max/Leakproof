import { describe, expect, it } from "vitest";
import { scoreEvidence } from "@/lib/analysis/scoring";

// Provider-response fixtures test the deterministic gate, not image recognition.
const observation = {
  quality: "GOOD",
  qualityIssues: [],
  waterDetected: true,
  waterEvidence: "STRONG",
  waterSupportingFrames: [0, 5],
  activeFlow: "UNCERTAIN",
  persistentSource: "UNCERTAIN",
  spreading: "UNCERTAIN",
  activeFlowFrames: [],
  persistentSourceFrames: [],
  spreadingFrames: [],
  sourceType: "SUSPICIOUS_SOURCE",
  sourceSupportingFrames: [0, 5],
  evidence: [],
};

describe("visible water gate", () => {
  it.each([
    ["dry wooden floor", [], "Wood grain is visible."],
    ["glossy dry floor", [2], "The polished surface is shiny."],
    [
      "reflected light on a dry surface",
      [1, 1],
      "Light reflects on the floor.",
    ],
    ["dark patch on dry material", [2, 3], "A dark patch is visible."],
  ])("rejects unsupported water on %s", (_scene, frames, evidence) => {
    for (const waterEvidence of ["MODERATE", "STRONG"]) {
      expect(
        scoreEvidence({
          ...observation,
          waterEvidence,
          waterSupportingFrames: frames,
          evidence: [evidence],
        }),
      ).toMatchObject({
        leakRisk: "NO_WATER",
        waterDetected: false,
        waterEvidence: "WEAK",
        persistentSource: null,
        spreadingDetected: null,
      });
    }
  });

  it.each([
    [0, 6],
    [-1, 5],
    [0, 3.5],
    [0, 2],
    [3, 3],
  ])(
    "does not count invalid, duplicate or nearby frame citations (%j, %j)",
    (first, second) => {
      expect(
        scoreEvidence({
          ...observation,
          waterSupportingFrames: [first, second],
        }).leakRisk,
      ).toBe("NO_WATER");
    },
  );

  it.each(["MODERATE", "STRONG"])(
    "accepts two separated frames for %s water",
    (waterEvidence) => {
      expect(
        scoreEvidence({
          ...observation,
          waterEvidence,
          waterSupportingFrames: [3, 0, 0, 99],
        }),
      ).toMatchObject({ waterDetected: true, leakRisk: "UNCERTAIN" });
    },
  );

  it("does not treat uncertainty about water alone as poor video quality", () => {
    expect(
      scoreEvidence({
        ...observation,
        qualityIssues: ["AMBIGUOUS"],
        waterSupportingFrames: [],
      }).leakRisk,
    ).toBe("NO_WATER");
  });

  it.each(["BLUR", "DARKNESS", "CAMERA_MOTION", "OBSTRUCTION", "FRAMING"])(
    "preserves UNCERTAIN for unusable video with %s",
    (issue) => {
      expect(
        scoreEvidence({
          ...observation,
          quality: "POOR",
          qualityIssues: [issue],
          waterSupportingFrames: [],
        }).leakRisk,
      ).toBe("UNCERTAIN");
    },
  );

  it("obvious running water still passes and retains temporal scoring", () => {
    const running = {
      ...observation,
      waterSupportingFrames: [0, 2, 5],
      activeFlow: "YES",
      persistentSource: "YES",
      spreading: "YES",
      activeFlowFrames: [0, 2, 5],
      persistentSourceFrames: [0, 3, 5],
      spreadingFrames: [0, 5],
      evidence: [
        "A visible stream emerges repeatedly and accumulates with ripples.",
      ],
    };
    expect(scoreEvidence(running)).toMatchObject({
      waterDetected: true,
      leakRisk: "HIGH",
      activeFlow: "YES",
      persistentSource: true,
      spreadingDetected: true,
      waterConfidence: null,
      activeFlowProbability: null,
    });
    expect(
      scoreEvidence({ ...running, waterSupportingFrames: [] }).leakRisk,
    ).toBe("NO_WATER");
  });
});
