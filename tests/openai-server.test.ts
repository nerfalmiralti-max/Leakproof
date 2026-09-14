import { afterEach, describe, expect, it, vi } from "vitest";
import { analyseFramesOnServer } from "@/lib/analysis/openai-server";
import { analysisRequestSchema } from "@/lib/analysis/request-schema";
import { analysisResultSchema } from "@/lib/analysis/result-schema";
import { scoreEvidence } from "@/lib/analysis/scoring";
import { POST } from "@/app/api/analyze/route";

const observations = {
  sourceType: "SUSPICIOUS_SOURCE",
  sourceSupportingFrames: [0, 5],
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
  evidence: ["Water is visible."],
};
const gateObservations = {
  quality: observations.quality,
  qualityIssues: observations.qualityIssues,
  waterDetected: observations.waterDetected,
  waterEvidence: observations.waterEvidence,
  waterSupportingFrames: observations.waterSupportingFrames,
};
const temporalObservations = {
  sourceType: observations.sourceType,
  sourceSupportingFrames: observations.sourceSupportingFrames,
  activeFlow: observations.activeFlow,
  activeFlowSupportingFrames: observations.activeFlowFrames,
  persistentSource: observations.persistentSource,
  persistentSourceSupportingFrames: observations.persistentSourceFrames,
  spreading: observations.spreading,
  spreadingSupportingFrames: observations.spreadingFrames,
};
const frames = Array.from({ length: 6 }, (_, index) => ({
  time: 0.1 + (6.8 * index) / 5,
  image:
    "data:image/jpeg;base64," +
    Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(128),
      Buffer.from([0xff, 0xd9]),
    ]).toString("base64"),
}));
function reply(text: string) {
  return Response.json({
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text }] }],
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("server-only vision integration", () => {
  it("uses compatible parameters for both stage models", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-real-key");
    vi.stubEnv("OPENAI_WATER_GATE_MODEL", "gpt-4.1-mini");
    vi.stubEnv("OPENAI_TEMPORAL_MODEL", "gpt-5.6-terra");
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const isGate = body.text.format.name === "water_gate_evidence";
      expect(body.model).toBe(isGate ? "gpt-4.1-mini" : "gpt-5.6-terra");
      if (!isGate) expect(body).not.toHaveProperty("temperature");
      else expect(body.temperature).toBe(0);
      expect(body).not.toHaveProperty("reasoning");
      expect(body.text.format).toMatchObject({
        type: "json_schema",
        strict: true,
      });
      expect(
        body.input[0].content.filter(
          (part: { type: string }) => part.type === "input_image",
        ),
      ).toEqual(
        frames.map((frame) => ({
          type: "input_image",
          image_url: frame.image,
          detail: "high",
        })),
      );
      return reply(
        JSON.stringify(isGate ? gateObservations : temporalObservations),
      );
    });
    await expect(analyseFramesOnServer(frames)).resolves.toMatchObject({
      leakRisk: "LOW",
    });
  });
  it("logs provider status, body and request id only on the server, redacting echoed secrets and frames", async () => {
    const apiKey = "test-only-secret-key";
    vi.stubEnv("OPENAI_API_KEY", apiKey);
    vi.stubEnv("ANALYSIS_PROVIDER", "openai");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            error: {
              message: `Unsupported parameter: temperature. ${apiKey} ${frames[0].image}`,
              type: "invalid_request_error",
              param: "temperature",
              code: "unsupported_parameter",
            },
            input: [{ private: "user frame metadata" }],
          }).replaceAll("/", "\\/"),
          { status: 400, headers: { "x-request-id": "req_provider_test" } },
        ),
    );
    const response = await POST(
      new Request("http://localhost:3000/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          video: {
            name: "private.webm",
            type: "video/webm",
            size: 1024,
            duration: 7,
            width: 640,
            height: 360,
          },
          frames,
        }),
      }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      code: "provider_unavailable",
      error: "The analysis service is unavailable. Please try again later.",
    });
    expect(log).toHaveBeenCalledWith("LeakProof OpenAI request failed", {
      stage: "water_gate",
      status: 400,
      requestId: "req_provider_test",
      body: expect.stringContaining("Unsupported parameter: temperature"),
    });
    const logs = JSON.stringify(log.mock.calls);
    for (const privateValue of [
      apiKey,
      frames[0].image,
      frames[0].image.split(",")[1],
      "user frame metadata",
      "private.webm",
    ]) {
      expect(logs).not.toContain(privateValue);
    }
  });

  it("logs a non-JSON provider error without a request id", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-real-key");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      async () => new Response("Bad gateway", { status: 502 }),
    );
    await expect(analyseFramesOnServer(frames)).rejects.toMatchObject({
      code: "provider_unavailable",
    });
    expect(log).toHaveBeenCalledWith("LeakProof OpenAI request failed", {
      stage: "water_gate",
      status: 502,
      requestId: null,
      body: "Bad gateway",
    });
  });
  it("uses the public Host header when Next constructs an internal request URL", async () => {
    vi.stubEnv("ANALYSIS_PROVIDER", "openai");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new Request("http://localhost:3002/api/analyze", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3002",
        origin: "http://127.0.0.1:3002",
        "content-type": "application/json",
      },
      body: "{}",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_input" });
  });
  it("requires a key and never silently substitutes a demo result", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(analyseFramesOnServer(frames)).rejects.toMatchObject({
      code: "not_configured",
      status: 503,
    });
  });
  it("sends two bounded structured requests for confirmed water with storage disabled and derives the result", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-real-key");
    let count = 0;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      count++;
      expect(url).toBe("https://api.openai.com/v1/responses");
      const body = JSON.parse(init.body as string);
      expect(body.store).toBe(false);
      expect(body.text.format).toMatchObject({
        strict: true,
        type: "json_schema",
      });
      expect(body.text.format.schema.required).toContain(
        count === 1 ? "waterSupportingFrames" : "activeFlowSupportingFrames",
      );
      expect(
        body.input[0].content.filter(
          (part: { type: string }) => part.type === "input_image",
        ),
      ).toHaveLength(6);
      return reply(
        JSON.stringify(count === 1 ? gateObservations : temporalObservations),
      );
    });
    const result = await analyseFramesOnServer(frames);
    expect(result).toMatchObject({
      provider: "openai",
      leakRisk: "LOW",
      waterConfidence: null,
      activeFlowProbability: null,
    });
    expect(count).toBe(2);
    expect(analysisResultSchema.safeParse(result).success).toBe(true);
  });
  it("downgrades a provider water claim without supporting frames", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-real-key");
    vi.stubGlobal("fetch", async () =>
      reply(
        JSON.stringify({
          ...gateObservations,
          waterSupportingFrames: [],
        }),
      ),
    );
    const result = await analyseFramesOnServer(frames);
    expect(result).toMatchObject({
      leakRisk: "NO_WATER",
      waterDetected: false,
    });
    expect(result.explanation).not.toContain("Water is visible");
    expect(analysisResultSchema.safeParse(result).success).toBe(true);
  });
  for (const [name, response, code] of [
    ["malformed JSON", () => reply("not-json"), "malformed"],
    ["malformed schema", () => reply('{"risk":"HIGH"}'), "malformed"],
    [
      "refusal",
      () =>
        Response.json({
          status: "completed",
          output: [{ type: "message", content: [{ type: "refusal" }] }],
        }),
      "refusal",
    ],
    [
      "incomplete response",
      () => Response.json({ status: "incomplete", output: [] }),
      "incomplete",
    ],
    [
      "rate limit",
      () => new Response("upstream private diagnostic", { status: 429 }),
      "rate_limited",
    ],
  ] as const) {
    it(`safely rejects ${name}`, async () => {
      vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-real-key");
      vi.stubGlobal("fetch", async () => response());
      await expect(analyseFramesOnServer(frames)).rejects.toMatchObject({
        code,
      });
    });
  }
  it("handles network failure without exposing upstream messages", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-real-key");
    vi.stubGlobal("fetch", async () => {
      throw new Error("private transport diagnostic");
    });
    await expect(analyseFramesOnServer(frames)).rejects.toMatchObject({
      code: "network",
      message: "The analysis service could not be reached. Please try again.",
    });
  });
  it("handles timeout without a paid request", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-real-key");
    const controller = new AbortController();
    controller.abort();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("timeout", "TimeoutError");
    });
    await expect(analyseFramesOnServer(frames)).rejects.toMatchObject({
      code: "timeout",
      status: 504,
    });
  });
  it("rejects incomplete or unordered frame coverage", () => {
    const video = {
      name: "test.webm",
      type: "video/webm",
      size: 1024,
      duration: 7,
      width: 640,
      height: 360,
    };
    expect(
      analysisRequestSchema.safeParse({ video, frames: frames.slice(0, 4) })
        .success,
    ).toBe(false);
    expect(
      analysisRequestSchema.safeParse({ video, frames: frames.toReversed() })
        .success,
    ).toBe(false);
  });
  it("rejects fabricated numeric probabilities in a real domain result", () => {
    const result = scoreEvidence(observations);
    expect(
      analysisResultSchema.safeParse({ ...result, waterConfidence: 0.97 })
        .success,
    ).toBe(false);
  });
  it("rejects oversized API bodies before contacting the provider", async () => {
    vi.stubEnv("ANALYSIS_PROVIDER", "openai");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(
      new Request("http://localhost:3000/api/analyze", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "3000000",
        },
        body: "{}",
      }),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "too_large" });
  });
});
