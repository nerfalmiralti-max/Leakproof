import { ChevronRight, MapPin, SlidersHorizontal } from "lucide-react";
import type { Risk } from "@/domain/analysis";
import type { LeakReport, ReportStatus } from "@/domain/report";
import { RISK_META, STATUS_META } from "@/lib/presentation";
import { RiskBadge } from "../report/evidence-summary";
import { EmptyState } from "../ui";

type Props = {
  reports: LeakReport[];
  selectedId: string | null;
  risk: Risk | "ALL";
  status: ReportStatus | "ALL";
  onRisk: (risk: Risk | "ALL") => void;
  onStatus: (status: ReportStatus | "ALL") => void;
  onSelect: (id: string) => void;
  loading: boolean;
  locked: boolean;
};

export function IncidentList({
  reports,
  selectedId,
  risk,
  status,
  onRisk,
  onStatus,
  onSelect,
  loading,
  locked,
}: Props) {
  return (
    <section
      className="flex min-h-0 flex-col rounded-xl border border-line bg-white lg:h-[720px]"
      aria-label="Incident list"
    >
      <div className="border-b border-line p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-bold">
            Incident reports{" "}
            <span className="ml-1.5 rounded bg-paper px-1.5 py-0.5 font-sans text-xs text-muted">
              {locked ? "—" : reports.length}
            </span>
          </h2>
          <SlidersHorizontal size={15} className="text-muted" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="risk-filter"
              className="mb-1.5 block text-[10px] text-muted"
            >
              Risk level
            </label>
            <select
              id="risk-filter"
              className="field !min-h-9 !px-2 !py-1 !text-xs"
              value={risk}
              onChange={(event) => onRisk(event.target.value as Risk | "ALL")}
            >
              <option value="ALL">All risks</option>
              {(["HIGH", "MEDIUM", "LOW"] as const).map((value) => (
                <option key={value} value={value}>
                  {RISK_META[value].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="status-filter"
              className="mb-1.5 block text-[10px] text-muted"
            >
              Status
            </label>
            <select
              id="status-filter"
              className="field !min-h-9 !px-2 !py-1 !text-xs"
              value={status}
              onChange={(event) =>
                onStatus(event.target.value as ReportStatus | "ALL")
              }
            >
              <option value="ALL">All statuses</option>
              {(Object.keys(STATUS_META) as ReportStatus[]).map((value) => (
                <option key={value} value={value}>
                  {STATUS_META[value].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="max-h-[450px] overflow-y-auto lg:max-h-none lg:flex-1">
        {loading ? (
          <div role="status" className="p-8 text-center text-xs text-muted">
            Loading reports…
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            title={
              locked
                ? "Reports not loaded"
                : risk === "ALL" && status === "ALL"
                  ? "No shared reports yet"
                  : "No matching reports"
            }
            description={
              locked
                ? "The dispatcher workspace is protected."
                : risk === "ALL" && status === "ALL"
                  ? "Real submitted observations will appear here."
                  : "Try another risk level or status to see more reports."
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {reports.map((report) => (
              <li key={report.id}>
                <button
                  type="button"
                  onClick={() => onSelect(report.id)}
                  aria-pressed={selectedId === report.id}
                  className={`relative block w-full px-5 py-4 text-left transition-colors hover:bg-paper ${selectedId === report.id ? "bg-[#edf3e8] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-green" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <RiskBadge result={report.analysis} />
                    <span className="text-[9px] font-medium text-muted">
                      SHARED
                    </span>
                  </div>
                  <h3 className="mt-3 flex items-start justify-between gap-2 text-[13px] leading-relaxed font-bold">
                    <span className="line-clamp-2">{report.locationLabel}</span>
                    <ChevronRight
                      size={15}
                      className="mt-1 shrink-0 text-muted"
                    />
                  </h3>
                  <p className="mt-1 flex items-center gap-1 font-mono text-[9px] text-muted">
                    <MapPin size={10} />
                    {report.location.lat.toFixed(4)},{" "}
                    {report.location.lng.toFixed(4)}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${STATUS_META[report.status].className}`}
                    >
                      {STATUS_META[report.status].label}
                    </span>
                    <span className="truncate font-mono text-[9px] text-muted">
                      {report.id.slice(0, 14)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-line px-5 py-3 text-[10px] text-muted">
        {locked
          ? "Protected workspace · Reports not loaded"
          : `${reports.length} matching shared reports`}
      </div>
    </section>
  );
}
