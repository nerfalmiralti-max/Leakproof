import Link from "next/link";
import { ArrowUpRight, Check, MapPin, Plus } from "lucide-react";
import type { LeakReport } from "@/domain/report";
import { RiskBadge } from "./evidence-summary";

export function ReportCreated({
  report,
  onReset,
}: {
  report: LeakReport;
  onReset: () => void;
}) {
  return (
    <section className="panel mx-auto max-w-xl px-6 py-10 text-center sm:px-10">
      <span className="mx-auto mb-6 grid h-17 w-17 place-items-center rounded-full bg-soft text-green">
        <Check size={30} strokeWidth={1.8} />
      </span>
      <p className="eyebrow mb-3 text-green">Report created</p>
      <h2 className="text-[29px] leading-tight font-bold tracking-[-1px]">
        Your observation
        <br />
        is on the map.
      </h2>
      <p className="mx-auto mt-4 max-w-sm text-[13px] leading-relaxed text-muted">
        Your report and video have been saved on this device. You can review
        them in the dispatcher dashboard.
      </p>
      <div className="my-7 rounded-xl border border-line bg-paper p-5 text-left">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="max-w-full break-all font-mono text-xs font-medium">
            {report.id}
          </span>
          <RiskBadge result={report.analysis} />
        </div>
        <p className="mt-4 flex items-start gap-2 break-words text-xs text-muted">
          <MapPin size={15} className="shrink-0" />
          {report.locationLabel}
        </p>
        <div className="mt-4 flex items-center gap-2 text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full bg-green" />
          New · Awaiting demo review
        </div>
      </div>
      <Link
        href={`/dashboard?report=${encodeURIComponent(report.id)}`}
        className="btn btn-primary w-full"
      >
        View report in dashboard <ArrowUpRight size={17} />
      </Link>
      <button
        type="button"
        onClick={onReset}
        className="btn btn-secondary mt-3 w-full"
      >
        <Plus size={16} /> Check another video
      </button>
      <p className="mt-6 text-[10px] leading-relaxed text-muted">
        No city service has been notified. Reports are visible only in this
        browser and may be lost if browser data is cleared.
      </p>
    </section>
  );
}
