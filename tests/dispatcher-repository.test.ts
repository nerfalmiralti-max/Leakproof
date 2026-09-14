import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateReportInput, LeakReport } from "@/domain/report";
import { createDemoResult } from "@/lib/analysis/demo";

const mocks = vi.hoisted(() => ({
  key: vi.fn(),
  local: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    getEvidence: vi.fn(),
  },
  remote: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    getEvidence: vi.fn(),
  },
}));
vi.mock("@/lib/reports/indexeddb-repository", () => ({
  getIndexedDBRepository: () => mocks.local,
}));
vi.mock("@/lib/reports/remote-repository", () => ({
  getDispatcherKey: mocks.key,
  remoteRepository: mocks.remote,
}));

import { getReportRepository } from "@/lib/reports";

const demo: LeakReport = {
  id: "same-id",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  analysis: createDemoResult("HIGH"),
  status: "NEW",
  isDemo: true,
  location: { lat: 43.65, lng: 51.16 },
  locationLabel: "Seeded incident",
  description: "Demo",
  video: null,
  evidenceId: null,
};
const real: LeakReport = {
  ...demo,
  analysis: { ...demo.analysis, provider: "openai" },
  isDemo: false,
  locationLabel: "Real submitted observation",
  evidenceId: "same-id",
};
const repository = getReportRepository();

describe("real dispatcher repository isolation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.key.mockReturnValue("dispatcher-key");
    mocks.local.list.mockResolvedValue([demo]);
    mocks.local.get.mockResolvedValue(demo);
    mocks.remote.list.mockResolvedValue([real]);
  });

  it("returns no seeded incidents while locked and loads neither repository", async () => {
    mocks.key.mockReturnValue("");
    expect(await repository.list()).toEqual([]);
    expect(mocks.local.list).not.toHaveBeenCalled();
    expect(mocks.remote.list).not.toHaveBeenCalled();
  });

  it("returns only remote reports without merging local fixtures", async () => {
    expect(await repository.list()).toEqual([real]);
    expect(mocks.remote.list).toHaveBeenCalledOnce();
    expect(mocks.local.list).not.toHaveBeenCalled();
  });

  it("keeps an empty shared workspace empty despite local demos", async () => {
    mocks.remote.list.mockResolvedValue([]);
    expect(await repository.list()).toEqual([]);
  });

  it("does not fall back to demos when remote loading fails", async () => {
    mocks.remote.list.mockRejectedValue(new Error("Unavailable"));
    await expect(repository.list()).rejects.toThrow("Unavailable");
    expect(mocks.local.list).not.toHaveBeenCalled();
  });

  it("gets the shared report even when a local fixture has the same id", async () => {
    mocks.remote.get.mockResolvedValue(real);
    expect(await repository.get(real.id)).toBe(real);
    expect(mocks.remote.get).toHaveBeenCalledWith(real.id);
    expect(mocks.local.get).not.toHaveBeenCalled();
  });

  it("does not resolve missing shared reports against demo fixtures", async () => {
    mocks.remote.get.mockResolvedValue(null);
    expect(await repository.get(demo.id)).toBeNull();
  });

  it("updates only the shared report status", async () => {
    const updated = { ...real, status: "IN_REVIEW" };
    mocks.remote.updateStatus.mockResolvedValue(updated);
    expect(await repository.updateStatus(real.id, "IN_REVIEW")).toBe(updated);
    expect(mocks.remote.updateStatus).toHaveBeenCalledWith(
      real.id,
      "IN_REVIEW",
    );
    expect(mocks.local.get).not.toHaveBeenCalled();
    expect(mocks.local.updateStatus).not.toHaveBeenCalled();
  });

  it("gets original shared evidence without consulting local fixtures", async () => {
    const evidence = new Blob(["original video"], { type: "video/webm" });
    mocks.remote.getEvidence.mockResolvedValue(evidence);
    expect(await repository.getEvidence(real.id)).toBe(evidence);
    expect(mocks.remote.getEvidence).toHaveBeenCalledWith(real.id);
    expect(mocks.local.get).not.toHaveBeenCalled();
    expect(mocks.local.getEvidence).not.toHaveBeenCalled();
  });

  it("preserves real report creation with the original evidence", async () => {
    const input: CreateReportInput = {
      ...real,
      video: {
        name: "video.webm",
        size: 8,
        type: "video/webm",
        duration: 6,
        width: 640,
        height: 480,
      },
    };
    const evidence = new Blob(["original"], { type: "video/webm" });
    mocks.remote.create.mockResolvedValue(real);
    expect(await repository.create(input, evidence)).toBe(real);
    expect(mocks.remote.create).toHaveBeenCalledWith(input, evidence);
    expect(mocks.local.create).not.toHaveBeenCalled();
  });

  it("preserves local demo creation without submitting it remotely", async () => {
    const input: CreateReportInput = {
      ...demo,
      video: {
        name: "demo.webm",
        size: 4,
        type: "video/webm",
        duration: 6,
        width: 640,
        height: 480,
      },
    };
    const evidence = new Blob(["demo"], { type: "video/webm" });
    mocks.local.create.mockResolvedValue(demo);
    expect(await repository.create(input, evidence)).toBe(demo);
    expect(mocks.local.create).toHaveBeenCalledWith(input, evidence);
    expect(mocks.remote.create).not.toHaveBeenCalled();
  });
});
