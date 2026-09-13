import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalysisStage, DemoScenario } from "@/domain/analysis";
import { createDemoResult, DEMO_SCENARIOS } from "@/lib/analysis/demo";
import { analyzeLeakVideo } from "@/lib/analysis/provider";

const validVideo = {
  name: "evidence.mp4",
  size: 1_024,
  type: "video/mp4",
  duration: 7,
  width: 1280,
  height: 720,
};
const validSource = new Blob([new Uint8Array(validVideo.size)], {
  type: validVideo.type,
});

describe("demo analysis", () => {
  it("provides a deterministic result for every selectable scenario", () => {
    expect(DEMO_SCENARIOS.map(({ value }) => value)).toEqual([
      "NO_WATER",
      "UNCERTAIN",
      "LOW",
      "MEDIUM",
      "HIGH",
    ]);

    for (const { value } of DEMO_SCENARIOS) {
      expect(createDemoResult(value)).toEqual(createDemoResult(value));
      expect(createDemoResult(value)).toMatchObject({
        provider: "demo",
        scenario: value,
        leakRisk: value,
      });
    }
  });

  it("gates all downstream signals when no water is detected", () => {
    expect(createDemoResult("NO_WATER")).toMatchObject({
      waterDetected: false,
      activeFlowProbability: null,
      persistentSource: null,
      spreadingDetected: null,
      leakRisk: "NO_WATER",
    });
  });

  it("makes no confirmed downstream claim for an uncertain recording", () => {
    const result = createDemoResult("UNCERTAIN");

    expect(result.activeFlowProbability).toBeNull();
    expect(result.persistentSource).toBeNull();
    expect(result.spreadingDetected).toBeNull();
    expect(result.recommendation.toLowerCase()).toMatch(/record|capture|video/);
    expect(result.explanation.toLowerCase()).toMatch(
      /unclear|uncertain|insufficient/,
    );
  });

  it.each<DemoScenario>(["LOW", "MEDIUM", "HIGH"])(
    "keeps confidence and probability values within bounds for %s",
    (scenario) => {
      const result = createDemoResult(scenario);

      expect(result.waterConfidence).toBeGreaterThanOrEqual(0);
      expect(result.waterConfidence).toBeLessThanOrEqual(1);
      expect(result.activeFlowProbability).toBeGreaterThanOrEqual(0);
      expect(result.activeFlowProbability).toBeLessThanOrEqual(1);
    },
  );
});

describe("analysis provider", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reports only the water stage for the no-water gate", async () => {
    const stages: AnalysisStage[] = [];

    const analysis = analyzeLeakVideo(
      { video: validVideo, scenario: "NO_WATER", source: validSource },
      { onStage: (stage) => stages.push(stage) },
    );
    await vi.advanceTimersByTimeAsync(600);
    const result = await analysis;

    expect(stages).toEqual(["water"]);
    expect(result.leakRisk).toBe("NO_WATER");
  });

  it("reports all stages for a complete high-risk analysis", async () => {
    const stages: AnalysisStage[] = [];

    const analysis = analyzeLeakVideo(
      { video: validVideo, scenario: "HIGH", source: validSource },
      { onStage: (stage) => stages.push(stage) },
    );
    await vi.advanceTimersByTimeAsync(2_400);
    const result = await analysis;

    expect(stages).toEqual(["water", "movement", "source", "risk"]);
    expect(result.leakRisk).toBe("HIGH");
  });

  it("downgrades inadequate resolution to uncertain without downstream stages", async () => {
    const stages: AnalysisStage[] = [];

    const analysis = analyzeLeakVideo(
      {
        video: { ...validVideo, width: 240, height: 720 },
        scenario: "HIGH",
        source: validSource,
      },
      { onStage: (stage) => stages.push(stage) },
    );
    await vi.advanceTimersByTimeAsync(600);
    const result = await analysis;

    expect(stages).toEqual(["water"]);
    expect(result.leakRisk).toBe("UNCERTAIN");
    expect(result.scenario).toBe("HIGH");
    expect(result.activeFlowProbability).toBeNull();
  });

  it("rejects unsupported duration before emitting analysis progress", async () => {
    const onStage = vi.fn();

    await expect(
      analyzeLeakVideo(
        {
          video: { ...validVideo, duration: 11 },
          scenario: "HIGH",
          source: validSource,
        },
        { onStage },
      ),
    ).rejects.toThrow(/5.*10/);
    expect(onStage).not.toHaveBeenCalled();
  });

  it("stops promptly when aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      analyzeLeakVideo(
        { video: validVideo, scenario: "MEDIUM", source: validSource },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("cancels between stages without emitting downstream progress", async () => {
    const controller = new AbortController();
    const stages: AnalysisStage[] = [];

    const analysis = analyzeLeakVideo(
      { video: validVideo, scenario: "HIGH", source: validSource },
      {
        signal: controller.signal,
        onStage: (stage) => {
          stages.push(stage);
          controller.abort();
        },
      },
    );

    await expect(analysis).rejects.toMatchObject({ name: "AbortError" });
    expect(stages).toEqual(["water"]);
  });

  it("rejects a source blob whose size does not match its metadata before analysis", async () => {
    const onStage = vi.fn();

    const analysis = analyzeLeakVideo(
      {
        video: validVideo,
        scenario: "HIGH",
        source: new Blob(["short"], { type: "video/mp4" }),
      },
      { onStage },
    );
    const rejection = expect(analysis).rejects.toThrow(/size|match/i);
    await vi.advanceTimersByTimeAsync(2_400);

    await rejection;
    expect(onStage).not.toHaveBeenCalled();
  });
});
