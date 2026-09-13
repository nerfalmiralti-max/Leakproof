import { statusSchema, createReportSchema, reportSchema } from "./schemas";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { z } from "zod";

import type {
  CreateReportInput,
  LeakReport,
  ReportRepository,
  ReportStatus,
} from "@/domain/report";
import { createDemoResult } from "@/lib/analysis/demo";

const DB_NAME = "leakproof";
const DB_VERSION = 1;

interface LeakProofDatabase extends DBSchema {
  reports: {
    key: string;
    value: LeakReport;
    indexes: { "by-created-at": string };
  };
  evidence: {
    key: string;
    value: Blob;
  };
}

const seedDefinitions: Array<{
  id: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  status: ReportStatus;
  createdAt: string;
  location: { lat: number; lng: number };
  locationLabel: string;
  description: string;
}> = [
  {
    id: "demo-aktau-14-microdistrict",
    risk: "HIGH",
    status: "NEW",
    createdAt: "2026-09-13T06:25:00.000Z",
    location: { lat: 43.6488, lng: 51.1515 },
    locationLabel: "14th Microdistrict",
    description:
      "Demo fixture: spreading water near the residential access road.",
  },
  {
    id: "demo-aktau-seafront-north",
    risk: "MEDIUM",
    status: "IN_REVIEW",
    createdAt: "2026-09-13T05:10:00.000Z",
    location: { lat: 43.6368, lng: 51.1684 },
    locationLabel: "Northern seafront promenade",
    description: "Demo fixture: steady curbside flow beside the promenade.",
  },
  {
    id: "demo-aktau-12-microdistrict",
    risk: "LOW",
    status: "ACCEPTED",
    createdAt: "2026-09-12T15:45:00.000Z",
    location: { lat: 43.6571, lng: 51.1462 },
    locationLabel: "12th Microdistrict",
    description:
      "Demo fixture: a small contained wet patch near a service lane.",
  },
  {
    id: "demo-aktau-seafront-south",
    risk: "HIGH",
    status: "IN_REVIEW",
    createdAt: "2026-09-12T11:20:00.000Z",
    location: { lat: 43.6259, lng: 51.1813 },
    locationLabel: "Southern seafront road",
    description:
      "Demo fixture: persistent flow spreading across a pedestrian crossing.",
  },
  {
    id: "demo-aktau-7-microdistrict",
    risk: "MEDIUM",
    status: "RESOLVED",
    createdAt: "2026-09-11T08:05:00.000Z",
    location: { lat: 43.6643, lng: 51.1722 },
    locationLabel: "7th Microdistrict",
    description: "Demo fixture: active water along the edge of a parking area.",
  },
  {
    id: "demo-aktau-5-microdistrict",
    risk: "LOW",
    status: "NEW",
    createdAt: "2026-09-10T13:35:00.000Z",
    location: { lat: 43.6701, lng: 51.1348 },
    locationLabel: "5th Microdistrict",
    description: "Demo fixture: limited standing water by a landscaped verge.",
  },
];

function issueSummary(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(" ");
}

function parseCreateInput(input: CreateReportInput): CreateReportInput {
  const parsed = createReportSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(`Invalid report input: ${issueSummary(parsed.error)}`);
  return parsed.data;
}

function parseStoredReport(value: unknown): LeakReport {
  const parsed = reportSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      `Stored report data is invalid: ${issueSummary(parsed.error)}`,
    );
  return parsed.data;
}

function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `report-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function seedReport(definition: (typeof seedDefinitions)[number]): LeakReport {
  return {
    id: definition.id,
    createdAt: definition.createdAt,
    updatedAt: definition.createdAt,
    status: definition.status,
    analysis: createDemoResult(definition.risk),
    location: definition.location,
    locationLabel: definition.locationLabel,
    description: definition.description,
    video: null,
    isDemo: true,
    evidenceId: null,
  };
}

async function openDatabase(): Promise<IDBPDatabase<LeakProofDatabase>> {
  const database = await openDB<LeakProofDatabase>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("reports")) {
        const reports = db.createObjectStore("reports", { keyPath: "id" });
        reports.createIndex("by-created-at", "createdAt");
      }
      if (!db.objectStoreNames.contains("evidence")) {
        db.createObjectStore("evidence");
      }
    },
  });

  try {
    const transaction = database.transaction("reports", "readwrite");
    for (const definition of seedDefinitions) {
      if (!(await transaction.store.get(definition.id))) {
        await transaction.store.put(seedReport(definition));
      }
    }
    await transaction.done;
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

async function withDatabase<T>(
  operation: string,
  callback: (database: IDBPDatabase<LeakProofDatabase>) => Promise<T>,
): Promise<T> {
  let database: IDBPDatabase<LeakProofDatabase> | undefined;
  try {
    database = await openDatabase();
    return await callback(database);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`LeakProof storage failed while ${operation}: ${message}`, {
      cause: error,
    });
  } finally {
    database?.close();
  }
}

const repository: ReportRepository = {
  async list() {
    return withDatabase("listing reports", async (database) => {
      const values = await database.getAll("reports");
      return values
        .map(parseStoredReport)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    });
  },

  async get(id) {
    if (!id.trim()) throw new Error("Invalid report id.");
    return withDatabase("reading a report", async (database) => {
      const value = await database.get("reports", id);
      return value === undefined ? null : parseStoredReport(value);
    });
  },

  async create(input, evidence) {
    const parsedInput = parseCreateInput(input);
    if (parsedInput.analysis.provider !== "demo")
      throw new Error("Real reports must be submitted to shared storage.");
    if (!(evidence instanceof Blob) || evidence.size <= 0) {
      throw new Error("Invalid evidence: the video evidence is empty.");
    }
    if (evidence.size !== parsedInput.video.size) {
      throw new Error(
        "Invalid evidence: video metadata size does not match the original file.",
      );
    }

    return withDatabase("creating a report", async (database) => {
      const timestamp = new Date().toISOString();
      const id = createId();
      const report: LeakReport = {
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
        status: "NEW",
        analysis: parsedInput.analysis,
        location: parsedInput.location,
        locationLabel: parsedInput.locationLabel,
        description: parsedInput.description,
        video: parsedInput.video,
        isDemo: true,
        evidenceId: id,
      };
      const transaction = database.transaction(
        ["reports", "evidence"],
        "readwrite",
      );
      await transaction.objectStore("reports").add(report);
      await transaction.objectStore("evidence").add(evidence, id);
      await transaction.done;
      return parseStoredReport(report);
    });
  },

  async updateStatus(id, status) {
    if (!id.trim()) throw new Error("Invalid report id.");
    const parsedStatus = statusSchema.safeParse(status);
    if (!parsedStatus.success) throw new Error("Invalid report status.");

    return withDatabase("updating report status", async (database) => {
      const transaction = database.transaction("reports", "readwrite");
      const stored = await transaction.store.get(id);
      if (!stored) {
        await transaction.done;
        throw new Error(`Report ${id} was not found.`);
      }
      const report = parseStoredReport(stored);
      const updated: LeakReport = {
        ...report,
        status: parsedStatus.data,
        updatedAt: new Date().toISOString(),
      };
      await transaction.store.put(updated);
      await transaction.done;
      return parseStoredReport(updated);
    });
  },

  async getEvidence(id) {
    if (!id.trim()) throw new Error("Invalid evidence id.");
    return withDatabase("reading report evidence", async (database) => {
      const evidence = await database.get("evidence", id);
      if (evidence === undefined) return null;
      if (!(evidence instanceof Blob))
        throw new Error("Stored report evidence is invalid.");
      return evidence;
    });
  },
};

export function getIndexedDBRepository(): ReportRepository {
  return repository;
}
