import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyseFramesOnServer } from "@/lib/analysis/openai-server";

const water = {
  quality: "GOOD",
  qualityIssues: [],
  waterDetected: true,
  waterEvidence: "STRONG",
  waterSupportingFrames: [0, 5],
};
const temporal = {
  activeFlow: "YES",
  activeFlowSupportingFrames: [0, 2, 5],
  persistentSource: "YES",
  persistentSourceSupportingFrames: [0, 3, 5],
  spreading: "NO",
  spreadingSupportingFrames: [],
};
const frames = Array.from({ length: 6 }, (_, i) => ({
  time: i * 1.3,
  image: "data:image/jpeg;base64,test-fixture",
}));
const reply = (evidence: unknown) =>
  Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(evidence) }],
      },
    ],
  });
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_WATER_GATE_MODEL", "");
  vi.stubEnv("OPENAI_TEMPORAL_MODEL", "");
  vi.stubEnv("OPENAI_VISION_MODEL", "gpt-5.6-terra");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("two-stage vision orchestration", () => {
  it.each([
    [[0, 5, 5, 99], [0, 5], 5, "PASS"],
    [[1, 2, -1], [1, 2], 1, "NO_WATER"],
  ])(
    "logs only Stage 1 categories, indices and decision (%j)",
    async (indices, validIndices, span, decision) => {
      const log = vi.spyOn(console, "info").mockImplementation(() => {});
      const gate = {
        ...water,
        waterEvidence: "MODERATE",
        waterSupportingFrames: indices,
      };
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(reply(gate))
          .mockResolvedValueOnce(reply(temporal)),
      );
      await analyseFramesOnServer(frames);
      expect(log).toHaveBeenCalledExactlyOnceWith(
        "LeakProof Stage 1 water gate",
        {
          rawEvidence: gate,
          validSupportingFrames: validIndices,
          supportingFrameSpan: span,
          decision,
        },
      );
      const logged = JSON.stringify(log.mock.calls);
      expect(logged).not.toContain("test-key");
      expect(logged).not.toContain("data:image");
      expect(logged).not.toContain("activeFlow");
    },
  );
  it.each(["water_gate", "temporal"])(
    "logs an HTTP failure in %s without switching models",
    async (stage) => {
      const fetchMock = vi.fn();
      if (stage === "temporal") fetchMock.mockResolvedValueOnce(reply(water));
      fetchMock.mockResolvedValueOnce(
        Response.json(
          { error: { message: "Provider unavailable" } },
          {
            status: 503,
            headers: { "x-request-id": "req_stage_test" },
          },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);
      await expect(analyseFramesOnServer(frames)).rejects.toMatchObject({
        code: "provider_unavailable",
      });
      expect(fetchMock).toHaveBeenCalledTimes(stage === "temporal" ? 2 : 1);
      expect(console.error).toHaveBeenCalledWith(
        "LeakProof OpenAI request failed",
        {
          stage,
          status: 503,
          requestId: "req_stage_test",
          body: JSON.stringify({ error: { message: "Provider unavailable" } }),
        },
      );
    },
  );

  it("retains UNCERTAIN when water is established but temporal evidence is insufficient", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reply(water))
        .mockResolvedValueOnce(
          reply({
            ...temporal,
            activeFlow: "UNCERTAIN",
            activeFlowSupportingFrames: [],
          }),
        ),
    );
    expect(await analyseFramesOnServer(frames)).toMatchObject({
      leakRisk: "UNCERTAIN",
      waterDetected: true,
    });
  });
  it.each([
    [
      "dry wood",
      {
        ...water,
        waterDetected: false,
        waterEvidence: "NONE",
        waterSupportingFrames: [],
      },
      "NO_WATER",
    ],
    [
      "glossy dry surface",
      { ...water, waterEvidence: "WEAK", waterSupportingFrames: [0] },
      "NO_WATER",
    ],
    [
      "unsupported moderate water",
      { ...water, waterEvidence: "MODERATE", waterSupportingFrames: [1, 2] },
      "NO_WATER",
    ],
    [
      "poor video",
      { ...water, quality: "POOR", qualityIssues: ["BLUR"] },
      "UNCERTAIN",
    ],
  ])(
    "%s stops after Stage 1 and never calls Terra",
    async (_scene, gate, risk) => {
      const fetchMock = vi.fn().mockResolvedValueOnce(reply(gate));
      vi.stubGlobal("fetch", fetchMock);
      expect((await analyseFramesOnServer(frames)).leakRisk).toBe(risk);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe(
        "gpt-4.1-mini",
      );
    },
  );

  it("confirmed running water calls Terra once with the same frames and scores MEDIUM", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(water))
      .mockResolvedValueOnce(reply(temporal));
    vi.stubGlobal("fetch", fetchMock);
    expect(await analyseFramesOnServer(frames)).toMatchObject({
      leakRisk: "MEDIUM",
      activeFlow: "YES",
      persistentSource: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [gate, flow] = fetchMock.mock.calls.map((call) =>
      JSON.parse(call[1].body),
    );
    expect(gate.model).toBe("gpt-4.1-mini");
    expect(flow.model).toBe("gpt-5.6-terra");
    expect(gate.text.format.schema.required.sort()).toEqual(
      Object.keys(water).sort(),
    );
    expect(flow.text.format.schema.required.sort()).toEqual(
      Object.keys(temporal).sort(),
    );
    expect(flow.input).toEqual(gate.input);
    expect(flow).not.toHaveProperty("temperature");
    expect(gate.temperature).toBe(0);
    expect(fetchMock.mock.calls[0][1].signal).toBe(
      fetchMock.mock.calls[1][1].signal,
    );
  });

  it.each([
    ["STRONG", "HIGH"],
    ["MODERATE", "MEDIUM"],
  ])(
    "%s water with all temporal signals scores %s",
    async (waterEvidence, leakRisk) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(reply({ ...water, waterEvidence }))
          .mockResolvedValueOnce(
            reply({
              ...temporal,
              spreading: "YES",
              spreadingSupportingFrames: [0, 5],
            }),
          ),
      );
      expect(await analyseFramesOnServer(frames)).toMatchObject({
        leakRisk,
        waterConfidence: null,
        activeFlowProbability: null,
      });
    },
  );

  it.each(["water_gate", "temporal"])(
    "malformed %s response fails safely without retries",
    async (stage) => {
      const fetchMock = vi.fn();
      if (stage === "temporal") fetchMock.mockResolvedValueOnce(reply(water));
      fetchMock.mockResolvedValueOnce(
        reply({ ...temporal, waterDetected: false, leakRisk: "HIGH" }),
      );
      vi.stubGlobal("fetch", fetchMock);
      await expect(analyseFramesOnServer(frames)).rejects.toMatchObject({
        code: "malformed",
        status: 502,
      });
      expect(fetchMock).toHaveBeenCalledTimes(stage === "temporal" ? 2 : 1);
      expect(console.error).toHaveBeenCalledWith(
        "LeakProof OpenAI stage failed",
        { stage, code: "malformed" },
      );
    },
  );

  it("honors explicit stage model settings over the deprecated single-model setting", async () => {
    vi.stubEnv("OPENAI_WATER_GATE_MODEL", "custom-gate");
    vi.stubEnv("OPENAI_TEMPORAL_MODEL", "custom-temporal");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(water))
      .mockResolvedValueOnce(reply(temporal));
    vi.stubGlobal("fetch", fetchMock);
    await analyseFramesOnServer(frames);
    expect(
      fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).model),
    ).toEqual(["custom-gate", "custom-temporal"]);
  });

  it("does not call Terra when cancelled after Stage 1", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => {
      controller.abort();
      return reply(water);
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      analyseFramesOnServer(frames, controller.signal),
    ).rejects.toMatchObject({ code: "cancelled" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
