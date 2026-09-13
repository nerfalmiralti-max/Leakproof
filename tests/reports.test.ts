import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CreateReportInput, ReportStatus } from "@/domain/report";
import { createDemoResult } from "@/lib/analysis/demo";
import { getIndexedDBRepository as getReportRepository } from "@/lib/reports/indexeddb-repository";

const DB_NAME = "leakproof";

const input = (
  description = "Water flowing beside the curb",
): CreateReportInput => ({
  analysis: createDemoResult("HIGH"),
  location: { lat: 43.651, lng: 51.162 },
  locationLabel: "14th Microdistrict",
  description,
  video: {
    name: "evidence.mp4",
    size: 5,
    type: "video/mp4",
    duration: 7,
    width: 1280,
    height: 720,
  },
});

const deleteDatabase = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Test database deletion was blocked"));
  });

describe("IndexedDB report repository", () => {
  beforeEach(deleteDatabase);
  afterEach(deleteDatabase);

  it("seeds explicit Aktau demo incidents once", async () => {
    const repository = getReportRepository();

    const [first, second] = await Promise.all([
      repository.list(),
      repository.list(),
    ]);

    expect(first).toHaveLength(6);
    expect(second).toHaveLength(6);
    expect(
      first.every(
        (report) =>
          report.isDemo && report.video === null && report.evidenceId === null,
      ),
    ).toBe(true);
    expect(new Set(first.map((report) => report.analysis.leakRisk))).toEqual(
      new Set(["LOW", "MEDIUM", "HIGH"]),
    );
    expect(
      first.every((report) => Math.abs(report.location.lat - 43.65) < 0.08),
    ).toBe(true);
    expect(
      first.every((report) => Math.abs(report.location.lng - 51.16) < 0.08),
    ).toBe(true);
  });

  it("does not overwrite edits to seeded fixture statuses", async () => {
    const repository = getReportRepository();
    const seeded = (await repository.list())[0];

    await repository.updateStatus(seeded.id, "RESOLVED");
    const afterReopen = await repository.list();

    expect(afterReopen.find((report) => report.id === seeded.id)?.status).toBe(
      "RESOLVED",
    );
  });

  it("creates a report and its original evidence atomically", async () => {
    const repository = getReportRepository();
    const evidence = new Blob(["video"], { type: "video/mp4" });

    const report = await repository.create(input(), evidence);

    expect(report).toMatchObject({
      isDemo: true,
      status: "NEW",
      description: input().description,
    });
    expect(report.evidenceId).toBe(report.id);
    await expect(repository.getEvidence(report.id)).resolves.toEqual(evidence);
    await expect(repository.get(report.id)).resolves.toEqual(report);
  });

  it("preserves concurrent creates and status changes across repository reopen", async () => {
    const repository = getReportRepository();
    const [one, two] = await Promise.all([
      repository.create(
        input("First"),
        new Blob(["12345"], { type: "video/mp4" }),
      ),
      repository.create(
        input("Second"),
        new Blob(["67890"], { type: "video/mp4" }),
      ),
    ]);
    await Promise.all([
      repository.updateStatus(one.id, "IN_REVIEW"),
      repository.updateStatus(two.id, "ACCEPTED"),
    ]);

    const reopened = getReportRepository();
    expect((await reopened.get(one.id))?.status).toBe("IN_REVIEW");
    expect((await reopened.get(two.id))?.status).toBe("ACCEPTED");
    expect(await reopened.getEvidence(one.id)).toEqual(
      new Blob(["12345"], { type: "video/mp4" }),
    );
  });

  it.each([
    [{ ...input(), location: { lat: 95, lng: 51 } }, new Blob(["12345"])],
    [{ ...input(), locationLabel: "" }, new Blob(["12345"])],
    [
      { ...input(), video: { ...input().video, duration: 2 } },
      new Blob(["12345"]),
    ],
    [
      { ...input(), analysis: { ...input().analysis, waterConfidence: 2 } },
      new Blob(["12345"]),
    ],
    [input(), new Blob([])],
  ])(
    "rejects malformed create input without partial persistence",
    async (badInput, evidence) => {
      const repository = getReportRepository();
      const before = await repository.list();

      await expect(
        repository.create(badInput as CreateReportInput, evidence),
      ).rejects.toThrow(/invalid|empty|match/i);

      expect(await repository.list()).toEqual(before);
    },
  );

  it("rejects invalid status values and missing reports", async () => {
    const repository = getReportRepository();

    await expect(repository.updateStatus("missing", "NEW")).rejects.toThrow(
      /not found/i,
    );
    await expect(
      repository.updateStatus("missing", "QUEUED" as ReportStatus),
    ).rejects.toThrow(/status/i);
  });

  it("surfaces malformed persisted report data", async () => {
    const repository = getReportRepository();
    await repository.list();
    const openRequest = indexedDB.open(DB_NAME);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });
    const transaction = database.transaction("reports", "readwrite");
    transaction.objectStore("reports").put({ id: "broken", status: "MAYBE" });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();

    await expect(repository.get("broken")).rejects.toThrow(
      /stored report.*invalid/i,
    );
  });

  it("surfaces storage failures instead of falling back to volatile data", async () => {
    const originalIndexedDB = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: undefined,
    });

    try {
      await expect(getReportRepository().list()).rejects.toThrow(
        /LeakProof storage failed while listing reports/i,
      );
    } finally {
      Object.defineProperty(globalThis, "indexedDB", {
        configurable: true,
        value: originalIndexedDB,
      });
    }
  });
});
