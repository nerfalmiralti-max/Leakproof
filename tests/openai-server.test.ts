import { afterEach, describe, expect, it, vi } from "vitest";
import { analyseFramesOnServer } from "@/lib/analysis/openai-server";
import { analysisRequestSchema } from "@/lib/analysis/request-schema";
import { analysisResultSchema } from "@/lib/analysis/result-schema";
import { scoreEvidence } from "@/lib/analysis/scoring";
import { POST } from "@/app/api/analyze/route";

const observations = {
  quality: "GOOD",
  qualityIssues: [],
  waterDetected: true,
  waterEvidence: "STRONG",
  activeFlow: "NO",
  persistentSource: "NO",
  spreading: "NO",
  activeFlowFrames: [],
  persistentSourceFrames: [],
  spreadingFrames: [],
  evidence: ["Water is visible."],
};
const frames = Array.from({ length: 6 }, (_, index) => ({
  time: 0.1 + (6.8 * index) / 5,
  image: "data:image/jpeg;base64,/9j/" + "A".repeat(130) + "/9k=",
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
  it("sends one bounded structured request with storage disabled and derives the result", async () => {
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
      expect(
        body.input[0].content.filter(
          (part: { type: string }) => part.type === "input_image",
        ),
      ).toHaveLength(6);
      return reply(JSON.stringify(observations));
    });
    const result = await analyseFramesOnServer(frames);
    expect(result).toMatchObject({
      provider: "openai",
      leakRisk: "LOW",
      waterConfidence: null,
      activeFlowProbability: null,
    });
    expect(count).toBe(1);
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
