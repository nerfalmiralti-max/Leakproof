import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import type { CreateReportInput, LeakReport } from "@/domain/report";
import { realCreateReportSchema, reportSchema, statusSchema } from "./schemas";
import { getSupabase } from "./server-client";
import { ReportServiceError } from "./server-errors";

const BUCKET = "report-evidence";
const idSchema = z.uuid();
const ticketSchema = z
  .object({ id: idSchema, expires: z.number(), input: realCreateReportSchema })
  .strict();
const extension = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};
function evidencePath(id: string, input: CreateReportInput) {
  return `reports/${id}/evidence.${extension[input.video.type as keyof typeof extension]}`;
}
function sign(value: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new ReportServiceError(
      503,
      "Reports are not configured. Contact the operator.",
    );
  return createHmac("sha256", key)
    .update("leakproof-report-upload:" + value)
    .digest();
}
function parseTicket(raw: unknown) {
  const token = z.string().max(24_000).parse(raw);
  const [payload, signature, extra] = token.split(".");
  const received = Buffer.from(signature ?? "", "base64url");
  const expected = sign(payload);
  if (
    extra ||
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw new ReportServiceError(400, "Invalid upload receipt.");
  const ticket = ticketSchema.parse(
    JSON.parse(Buffer.from(payload, "base64url").toString()),
  );
  if (ticket.expires < Date.now())
    throw new ReportServiceError(400, "Upload receipt expired. Submit again.");
  return ticket;
}
// Storage paths stay server-side; the public domain contract uses the report ID.
function toReport(row: Record<string, unknown>): LeakReport {
  return reportSchema.parse({
    id: row.id,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    status: row.status,
    analysis: row.analysis,
    location: { lat: row.latitude, lng: row.longitude },
    locationLabel: row.location_label,
    description: row.description,
    video: {
      name: row.video_name,
      size: row.video_size,
      type: row.video_type,
      duration: row.video_duration,
      width: row.video_width,
      height: row.video_height,
    },
    isDemo: false,
    evidenceId: row.id,
  });
}
export async function prepareReportUpload(raw: unknown) {
  const input = realCreateReportSchema.parse(raw);
  const db = getSupabase();
  const id = randomUUID();
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUploadUrl(evidencePath(id, input), { upsert: false });
  if (error || !data)
    throw new ReportServiceError(
      502,
      "Could not prepare the video upload. No report was submitted.",
    );
  const payload = Buffer.from(
    JSON.stringify({ id, input, expires: Date.now() + 15 * 60_000 }),
  ).toString("base64url");
  return {
    ticket: payload + "." + sign(payload).toString("base64url"),
    uploadUrl: data.signedUrl,
  };
}
export async function submitReport(raw: unknown) {
  const { ticket: rawTicket } = z
    .object({ ticket: z.string() })
    .strict()
    .parse(raw);
  const { id, input } = parseTicket(rawTicket);
  const db = getSupabase();
  const existing = await db
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (existing.error)
    throw new ReportServiceError(
      502,
      "Could not verify report submission. Please try again.",
    );
  if (existing.data) return toReport(existing.data);
  const path = evidencePath(id, input);
  const storage = db.storage.from(BUCKET);
  const { data: video, error: downloadError } = await storage.download(path);
  if (downloadError || !video)
    throw new ReportServiceError(
      400,
      "The original video upload is missing or failed. No report was submitted.",
    );
  try {
    if (video.size > 50 * 1024 * 1024)
      throw new ReportServiceError(413, "Video exceeds 50 MB.");
    if (video.size !== input.video.size)
      throw new ReportServiceError(
        400,
        "Uploaded video size does not match the report.",
      );
    const detected = await fileTypeFromBuffer(
      new Uint8Array(await video.slice(0, 8192).arrayBuffer()),
    );
    if (detected?.mime !== input.video.type)
      throw new ReportServiceError(
        415,
        "The uploaded file is not the declared MP4, WebM or QuickTime video.",
      );
    const now = new Date().toISOString();
    const row = {
      id,
      created_at: now,
      updated_at: now,
      status: "NEW",
      risk: input.analysis.leakRisk,
      analysis: input.analysis,
      latitude: input.location.lat,
      longitude: input.location.lng,
      location_label: input.locationLabel,
      description: input.description,
      video_name: input.video.name,
      video_size: input.video.size,
      video_type: input.video.type,
      video_duration: input.video.duration,
      video_width: input.video.width,
      video_height: input.video.height,
      evidence_path: path,
      is_demo: false,
    };
    const { error } = await db.from("reports").insert(row);
    if (error)
      throw new ReportServiceError(
        502,
        "Report could not be saved. Please try again.",
      );
    return toReport(row);
  } catch (error) {
    // A concurrent/retried insert may have succeeded. Never delete committed evidence.
    const check = await db
      .from("reports")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (check.data) return toReport(check.data);
    if (!check.error) {
      const cleanup = await storage.remove([path]);
      if (cleanup.error)
        console.error("LeakProof evidence cleanup failed", { reportId: id });
    } else
      console.error("LeakProof evidence cleanup deferred", { reportId: id });
    throw error;
  }
}
export async function listReports() {
  const db = getSupabase();
  const reports: LeakReport[] = [];
  // Page through the provider's row limit, so refresh does not silently omit older reports.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("reports")
      .select("*")
      .eq("is_demo", false)
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    if (error || !data)
      throw new ReportServiceError(502, "Reports could not be loaded.");
    reports.push(...data.map(toReport));
    if (data.length < 500) return reports;
  }
}
export async function updateReportStatus(id: string, raw: unknown) {
  idSchema.parse(id);
  const { status } = z.object({ status: statusSchema }).strict().parse(raw);
  const { data, error } = await getSupabase()
    .from("reports")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_demo", false)
    .select("*")
    .maybeSingle();
  if (error) throw new ReportServiceError(502, "Status could not be saved.");
  if (!data) throw new ReportServiceError(404, "Report not found.");
  return toReport(data);
}
export async function signEvidence(id: string) {
  idSchema.parse(id);
  const db = getSupabase();
  const { data: row, error } = await db
    .from("reports")
    .select("evidence_path")
    .eq("id", id)
    .eq("is_demo", false)
    .maybeSingle();
  if (error) throw new ReportServiceError(502, "Evidence could not be loaded.");
  if (!row?.evidence_path)
    throw new ReportServiceError(404, "Video evidence not found.");
  const { data, error: signError } = await db.storage
    .from(BUCKET)
    .createSignedUrl(row.evidence_path, 300);
  if (signError || !data)
    throw new ReportServiceError(
      502,
      "Video evidence is unavailable. Refresh and try again.",
    );
  return { url: data.signedUrl, expiresIn: 300 };
}
