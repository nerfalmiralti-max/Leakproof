"use client";
import { useRef, useState } from "react";
import { Check, ClipboardCheck, MapPin, Save } from "lucide-react";
import type { LeakReport, ReportStatus } from "@/domain/report";
import { formatDate, STATUS_META } from "@/lib/presentation";
import { getReportRepository } from "@/lib/reports";
import { EvidenceSummary, RiskBadge } from "../report/evidence-summary";
import { ErrorNotice } from "../ui";
import { VideoEvidence } from "./video-evidence";

export function ReportDetails({
  report,
  onUpdated,
}: {
  report: LeakReport;
  onUpdated: (report: LeakReport) => void;
}) {
  const [status, setStatus] = useState(report.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  async function updateStatus(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || status === report.status) return;
    lock.current = true;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await getReportRepository().updateStatus(
        report.id,
        status,
      );
      onUpdated(updated);
      setSaved(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The status could not be saved. Try again.",
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-white lg:h-[720px] lg:overflow-y-auto"
      aria-label="Selected report details"
    >
      <div className="sticky top-0 z-10 border-b border-line bg-white px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Report details</h2>
          <span className="rounded border border-line px-1.5 py-0.5 text-[9px] font-medium text-muted">
            {report.isDemo ? "DEMO INCIDENT" : "CITIZEN REPORT"}
          </span>
        </div>
      </div>
      <div className="space-y-5 p-5">
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <RiskBadge result={report.analysis} />
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${STATUS_META[report.status].className}`}
            >
              {STATUS_META[report.status].label}
            </span>
          </div>
          <h3 className="text-lg leading-snug font-bold tracking-[-.5px]">
            {report.locationLabel}
          </h3>
          <p className="mt-2 break-all font-mono text-[10px] text-muted">
            {report.id}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
            <MapPin size={12} /> {report.location.lat.toFixed(5)},{" "}
            {report.location.lng.toFixed(5)}
          </p>
          <p className="mt-1 text-[10px] text-muted">
            Created {formatDate(report.createdAt)}
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-xs font-bold">Video evidence</h3>
          <VideoEvidence key={report.id} report={report} />
        </div>
        {report.description && (
          <div>
            <h3 className="mb-2 text-xs font-bold">Observation notes</h3>
            <p className="break-words text-xs leading-relaxed text-muted">
              {report.description}
            </p>
          </div>
        )}
        <div className="border-t border-line pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-bold">
              <ClipboardCheck size={14} /> AI evidence summary
            </h3>
            <span className="text-[9px] font-bold tracking-wide text-[#807842]">
              {report.analysis.provider === "demo" ? "DEMO" : "VISUAL"}
            </span>
          </div>
          <EvidenceSummary result={report.analysis} compact />
          <p className="mt-3 text-[11px] leading-[1.7] text-muted">
            {report.analysis.explanation}
          </p>
          <p className="mt-3 rounded-lg bg-soft p-3 text-[11px] leading-relaxed text-[#566448]">
            {report.analysis.recommendation}
          </p>
        </div>
        <form onSubmit={updateStatus} className="border-t border-line pt-5">
          <label
            htmlFor="report-status"
            className="mb-2 block text-xs font-bold"
          >
            Update report status
          </label>
          <select
            id="report-status"
            className="field !text-xs"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ReportStatus);
              setSaved(false);
            }}
            disabled={saving}
          >
            {(Object.keys(STATUS_META) as ReportStatus[]).map((value) => (
              <option key={value} value={value}>
                {STATUS_META[value].label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="btn btn-primary mt-3 w-full !min-h-10 !py-2 !text-xs"
            disabled={saving || status === report.status}
          >
            <Save size={14} /> {saving ? "Saving…" : "Save status"}
          </button>
          <div className="mt-3">
            <ErrorNotice message={error} />
          </div>
          {saved && (
            <p
              role="status"
              className="mt-2 flex items-center gap-1 text-[11px] text-green"
            >
              <Check size={13} /> Status saved on this device.
            </p>
          )}
          <p className="mt-3 text-[10px] leading-relaxed text-muted">
            Status changes are for this demo only. No inspection team is
            dispatched.
          </p>
        </form>
      </div>
    </section>
  );
}
