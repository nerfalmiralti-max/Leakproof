import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabase } from "@/lib/reports/server-client";
import { POST as prepare } from "@/app/api/reports/upload/route";
import { POST as submit } from "@/app/api/reports/route";
import { GET as list } from "@/app/api/dispatcher/reports/route";
import { GET as evidence } from "@/app/api/dispatcher/reports/[id]/evidence/route";
import { PATCH as status } from "@/app/api/dispatcher/reports/[id]/status/route";
import { scoreEvidence } from "@/lib/analysis/scoring";
import { createDemoResult } from "@/lib/analysis/demo";
import { remoteRepository } from "@/lib/reports/remote-repository";

vi.mock("@/lib/reports/server-client", () => ({ getSupabase: vi.fn() }));
const original = new Blob([readFileSync("tests/fixtures/observation.webm")], { type: "video/webm" });
const input = {
  analysis: scoreEvidence({ quality: "GOOD", qualityIssues: [], waterDetected: true, waterEvidence: "STRONG", waterSupportingFrames: [0, 5], activeFlow: "YES", activeFlowFrames: [0, 2, 5], persistentSource: "YES", persistentSourceFrames: [0, 3, 5], spreading: "NO", spreadingFrames: [], evidence: [] }),
  location: { lat: 43.65, lng: 51.16 }, locationLabel: "Water near path", description: "Observed water",
  video: { name: "original.webm", type: "video/webm", size: original.size, duration: 7, width: 640, height: 360 },
};
type Row = Record<string, unknown>;
let rows: Map<string, Row>;
let insertError: boolean;
const storage = {
  createSignedUploadUrl: vi.fn(), download: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn(),
};
const insert = vi.fn(async (row: Row) => {
  if (insertError) return { error: { message: "private database details" } };
  rows.set(String(row.id), row); return { error: null };
});
function table() {
  let id: string | undefined;
  let changes: Row | undefined;
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((key: string, value: string) => { if (key === "id") id = value; return query; }),
    order: vi.fn(() => query),
    range: vi.fn(async () => ({ data: [...rows.values()], error: null })),
    update: vi.fn((value: Row) => { changes = value; return query; }),
    maybeSingle: vi.fn(async () => {
      const row = id ? rows.get(id) : undefined;
      if (row && changes) Object.assign(row, changes);
      return { data: row ?? null, error: null };
    }), insert,
  };
  return query;
}
const request = (body?: unknown, authorized = false) => new Request("http://localhost/api/reports", {
  method: body === undefined ? "GET" : "POST",
  headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(authorized ? { Authorization: "Bearer dispatcher-test-key" } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
beforeEach(() => {
  vi.clearAllMocks(); rows = new Map(); insertError = false;
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key");
  vi.stubEnv("DISPATCHER_ACCESS_KEY", "dispatcher-test-key");
  storage.createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: "https://storage.example/upload?token=upload-only" }, error: null });
  storage.download.mockResolvedValue({ data: original, error: null });
  storage.remove.mockResolvedValue({ data: [], error: null });
  storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.example/video?token=private" }, error: null });
  vi.mocked(getSupabase).mockReturnValue({ storage: { from: () => storage }, from: table } as unknown as ReturnType<typeof getSupabase>);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function ticket() {
  const response = await prepare(request(input));
  expect(response.status).toBe(200);
  return (await response.json()).ticket as string;
}
async function created() {
  const response = await submit(request({ ticket: await ticket() }));
  expect(response.status).toBe(201);
  return (await response.json()).report;
}

describe("private shared reports", () => {
  it("validates and saves a real report, without returning its storage path", async () => {
    const report = await created();
    expect(report).toMatchObject({ isDemo: false, status: "NEW", analysis: { leakRisk: "MEDIUM" }, video: input.video });
    expect(report.evidenceId).toBe(report.id);
    expect(report).not.toHaveProperty("evidence_path");
    expect(storage.createSignedUploadUrl).toHaveBeenCalledWith(`reports/${report.id}/evidence.webm`, { upsert: false });
    expect(insert).toHaveBeenCalledTimes(1);
  });
  it.each(["NO_WATER", "UNCERTAIN"])("rejects %s before creating an upload", async risk => {
    expect((await prepare(request({ ...input, analysis: { ...input.analysis, leakRisk: risk } }))).status).toBe(400);
    expect(getSupabase).not.toHaveBeenCalled();
  });
  it.each([
    ["unsupported MIME", { ...input, video: { ...input.video, type: "text/plain" } }],
    ["oversized video", { ...input, video: { ...input.video, size: 52428801 } }],
    ["invalid location", { ...input, location: { lat: 100, lng: 51 } }],
    ["fabricated HIGH risk", { ...input, analysis: { ...input.analysis, leakRisk: "HIGH" } }],
    ["demo", { ...input, analysis: createDemoResult("HIGH") }],
    ["client storage path", { ...input, evidence_path: "another-report/video.webm" }],
  ])("rejects %s without Supabase writes", async (_name, invalid) => {
    expect((await prepare(request(invalid))).status).toBe(400);
    expect(getSupabase).not.toHaveBeenCalled();
  });
  it("upload preparation failure does not insert a report", async () => {
    storage.createSignedUploadUrl.mockResolvedValue({ data: null, error: {} });
    expect((await prepare(request(input))).status).toBe(502);
    expect(insert).not.toHaveBeenCalled();
  });
  it("failed or missing upload does not insert a report", async () => {
    storage.download.mockResolvedValue({ data: null, error: {} });
    expect((await submit(request({ ticket: await ticket() }))).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });
  it("DB insert failure cleans uploaded evidence and does not report success", async () => {
    insertError = true;
    const response = await submit(request({ ticket: await ticket() }));
    expect(response.status).toBe(502);
    expect(storage.remove).toHaveBeenCalledTimes(1);
    expect(await response.text()).not.toContain("private database details");
  });
  it("rejects forged file contents even when the MIME and filename claim video", async () => {
    storage.download.mockResolvedValue({ data: new Blob([new Uint8Array(original.size)], { type: "video/webm" }), error: null });
    expect((await submit(request({ ticket: await ticket() }))).status).toBe(415);
    expect(insert).not.toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });
  it("rejects oversized stored evidence", async () => {
    storage.download.mockResolvedValue({ data: { size: 52428801 }, error: null });
    expect((await submit(request({ ticket: await ticket() }))).status).toBe(413);
    expect(insert).not.toHaveBeenCalled();
  });
  it("rejects a tampered upload receipt", async () => {
    const token = await ticket();
    const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
    payload.input.location.lat = 0;
    const forged = Buffer.from(JSON.stringify(payload)).toString("base64url") + "." + token.split(".")[1];
    expect((await submit(request({ ticket: forged }))).status).toBe(400);
    expect(storage.download).not.toHaveBeenCalled();
  });
  it("retrying a committed receipt returns the same report without deleting evidence", async () => {
    const token = await ticket();
    const first = await (await submit(request({ ticket: token }))).json();
    const second = await (await submit(request({ ticket: token }))).json();
    expect(second).toEqual(first);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it("rejects every dispatcher operation without a key", async () => {
    const context = { params: Promise.resolve({ id: crypto.randomUUID() }) };
    expect((await list(request())).status).toBe(401);
    expect((await evidence(request(), context)).status).toBe(401);
    expect((await status(request({ status: "IN_REVIEW" }), context)).status).toBe(401);
    expect(getSupabase).not.toHaveBeenCalled();
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });
  it("correct dispatcher key lists reports and persists status", async () => {
    const report = await created();
    expect((await (await list(request(undefined, true))).json()).reports).toHaveLength(1);
    const response = await status(request({ status: "IN_REVIEW" }, true), { params: Promise.resolve({ id: report.id }) });
    expect(response.status).toBe(200);
    expect((await (await list(request(undefined, true))).json()).reports[0].status).toBe("IN_REVIEW");
  });
  it("rejects invalid status values", async () => {
    const report = await created();
    expect((await status(request({ status: "DELETED" }, true), { params: Promise.resolve({ id: report.id }) })).status).toBe(400);
    expect(rows.get(report.id)?.status).toBe("NEW");
  });
  it("creates a five-minute evidence URL only after dispatcher authorization", async () => {
    const report = await created();
    const response = await evidence(request(undefined, true), { params: Promise.resolve({ id: report.id }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(storage.createSignedUrl).toHaveBeenCalledWith(`reports/${report.id}/evidence.webm`, 300);
    expect(rows.get(report.id)).not.toHaveProperty("signedUrl");
  });
  it("returns a safe error when evidence signing fails", async () => {
    const report = await created();
    storage.createSignedUrl.mockResolvedValue({ data: null, error: {} });
    expect((await evidence(request(undefined, true), { params: Promise.resolve({ id: report.id }) })).status).toBe(502);
  });
  it("does not finalize or fall back locally if the browser upload fails", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ ticket: "receipt", uploadUrl: "https://storage.example/upload" })).mockResolvedValueOnce(new Response("failure", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(remoteRepository.create(input, original)).rejects.toThrow("No report was submitted");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("remote repository rejects demo evidence before making network calls", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(remoteRepository.create({ ...input, analysis: createDemoResult("HIGH") }, original)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
