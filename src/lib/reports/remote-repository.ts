import type { ReportRepository } from "@/domain/report";
import { realCreateReportSchema, reportSchema, statusSchema } from "./schemas";
import { z } from "zod";

const KEY = "leakproof-dispatcher-key";
export function getDispatcherKey() {
  return typeof window === "undefined"
    ? ""
    : (sessionStorage.getItem(KEY) ?? "");
}
export function setDispatcherKey(key: string) {
  if (key) sessionStorage.setItem(KEY, key);
  else sessionStorage.removeItem(KEY);
}

async function api(path: string, init?: RequestInit, dispatcher = false) {
  const headers = new Headers(init?.headers);
  if (dispatcher) {
    const key = getDispatcherKey();
    if (!key) throw new Error("Unlock the dispatcher workspace first.");
    headers.set("Authorization", `Bearer ${key}`);
  }
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, cache: "no-store" });
  } catch {
    throw new Error(
      "Network error. The operation was not confirmed; please try again.",
    );
  }
  if (!response.ok) {
    if (response.status === 401 && dispatcher) setDispatcherKey("");
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "The report service is unavailable. Please try again.",
    );
  }
  return response.json();
}
export async function getSignedEvidenceUrl(id: string) {
  const data = await api(
    `/api/dispatcher/reports/${encodeURIComponent(id)}/evidence`,
    undefined,
    true,
  );
  return z.object({ url: z.url(), expiresIn: z.number() }).parse(data).url;
}
export const remoteRepository: ReportRepository = {
  async list() {
    const body = await api("/api/dispatcher/reports", undefined, true);
    return z.array(reportSchema).parse(body.reports);
  },
  async get(id) {
    return (await this.list()).find((report) => report.id === id) ?? null;
  },
  async create(raw, evidence) {
    const input = realCreateReportSchema.parse(raw);
    if (
      !(evidence instanceof Blob) ||
      evidence.size !== input.video.size ||
      evidence.type !== input.video.type
    )
      throw new Error("Original video does not match the report metadata.");
    const upload = z.object({ ticket: z.string(), uploadUrl: z.url() }).parse(
      await api("/api/reports/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
    // The URL authorizes only one server-chosen object, without an anon/service key.
    const body = new FormData();
    body.append("cacheControl", "0");
    body.append("", evidence, input.video.name);
    let uploaded: Response;
    try {
      uploaded = await fetch(upload.uploadUrl, { method: "PUT", body });
    } catch {
      throw new Error(
        "Video upload failed. No report was submitted. Please try again.",
      );
    }
    if (!uploaded.ok)
      throw new Error(
        "Video upload failed. No report was submitted. Please try again.",
      );
    const result = await api("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: upload.ticket }),
    });
    return reportSchema.parse(result.report);
  },
  async updateStatus(id, status) {
    statusSchema.parse(status);
    const result = await api(
      `/api/dispatcher/reports/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
      true,
    );
    return reportSchema.parse(result.report);
  },
  async getEvidence(id) {
    const response = await fetch(await getSignedEvidenceUrl(id), {
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok)
      throw new Error(
        "Video evidence is unavailable. Refresh the report and try again.",
      );
    return response.blob();
  },
};
