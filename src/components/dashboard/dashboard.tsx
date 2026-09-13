"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Droplets,
  LayoutDashboard,
  MapPin,
  RefreshCw,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import type { Risk } from "@/domain/analysis";
import type { LeakReport, ReportStatus } from "@/domain/report";
import { getReportRepository } from "@/lib/reports";
import { RISK_META } from "@/lib/presentation";
import { Brand } from "../brand";
import { DemoNotice } from "../demo-notice";
import { AktauMap } from "../map/aktau-map";
import { ErrorNotice } from "../ui";
import { IncidentList } from "./incident-list";
import { ReportDetails } from "./report-details";

export function Dashboard() {
  const params = useSearchParams();
  const [reports, setReports] = useState<LeakReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [risk, setRisk] = useState<Risk | "ALL">("ALL");
  const [status, setStatus] = useState<ReportStatus | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(
    params.get("report"),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const details = useRef<HTMLDivElement>(null);
  const loadRequest = useRef(0);
  const loadReports = useCallback((signal?: AbortSignal) => {
    const request = ++loadRequest.current;
    return getReportRepository()
      .list()
      .then((data) => {
        if (!signal?.aborted && request === loadRequest.current) {
          setReports(data);
          setError(null);
        }
      })
      .catch((failure) => {
        if (!signal?.aborted && request === loadRequest.current)
          setError(
            failure instanceof Error
              ? failure.message
              : "Reports could not be loaded. Please try again.",
          );
      })
      .finally(() => {
        if (!signal?.aborted && request === loadRequest.current)
          setLoading(false);
      });
  }, []);
  function refresh() {
    setLoading(true);
    setError(null);
    void loadReports();
  }
  useEffect(() => {
    const controller = new AbortController();
    void loadReports(controller.signal);
    const onFocus = () => {
      setLoading(true);
      void loadReports(controller.signal);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [loadReports]);
  const filtered = reports.filter(
    (report) =>
      (risk === "ALL" || report.analysis.leakRisk === risk) &&
      (status === "ALL" || report.status === status),
  );
  const selected =
    filtered.find((report) => report.id === selectedId) ?? filtered[0] ?? null;
  const highCount = reports.filter(
    (report) =>
      report.analysis.leakRisk === "HIGH" && report.status !== "RESOLVED",
  ).length;
  const newCount = reports.filter((report) => report.status === "NEW").length;
  const resolvedCount = reports.filter(
    (report) => report.status === "RESOLVED",
  ).length;
  function select(id: string) {
    setSelectedId(id);
    if (window.innerWidth < 1280)
      details.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function update(report: LeakReport) {
    loadRequest.current++;
    setLoading(false);
    setReports((previous) =>
      previous.map((item) => (item.id === report.id ? report : item)),
    );
    setNotice(`Report ${report.id}: status saved.`);
  }
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="flex min-h-19 items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-7">
            <Brand />
            <span className="hidden h-7 w-px bg-line md:block" />
            <span className="hidden items-center gap-2 text-xs text-muted md:flex">
              <LayoutDashboard size={15} /> Dispatcher workspace
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-1.5 text-[11px] text-muted sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-green" /> Local demo
            </span>
            <Link
              href="/scan"
              className="btn btn-secondary !min-h-9 !px-3 !py-2 !text-xs"
            >
              <ScanLine size={14} /> New scan <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1800px] px-5 py-7 sm:px-8">
        <div className="mb-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow mb-2 text-green">Aktau water watch</p>
            <h1 className="text-[28px] font-bold tracking-[-1px] sm:text-[32px]">
              A city view. A clearer response.
            </h1>
            <p className="mt-2 text-xs text-muted">
              Review observations, assess the evidence and track inspection
              status.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary w-fit !min-h-10 !py-2 !text-xs"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw size={14} />{" "}
            {loading ? "Refreshing…" : "Refresh reports"}
          </button>
        </div>
        <DemoNotice compact mode="workspace" />
        <div className="my-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              icon: ClipboardList,
              label: "Total reports",
              value: reports.length,
              note: "Samples + local reports",
              color: "bg-[#eaf0e5] text-green",
            },
            {
              icon: TriangleAlert,
              label: "High risk · open",
              value: highCount,
              note: "Prioritise evidence review",
              color: "bg-[#f8ebe5] text-[#a85b39]",
            },
            {
              icon: Droplets,
              label: "Awaiting review",
              value: newCount,
              note: "New observations",
              color: "bg-[#e7eff0] text-[#4d7780]",
            },
            {
              icon: CheckCircle2,
              label: "Resolved",
              value: resolvedCount,
              note: "Marked resolved in demo",
              color: "bg-[#edf0e6] text-[#6b7850]",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-start justify-between gap-2 rounded-xl border border-line bg-white px-4 py-4 sm:px-5"
            >
              <div>
                <p className="text-[10px] font-medium text-muted sm:text-[11px]">
                  {stat.label}
                </p>
                <p className="my-2 font-display text-[27px] leading-none font-bold tracking-[-1px]">
                  {loading && reports.length === 0
                    ? "—"
                    : stat.value.toString().padStart(2, "0")}
                </p>
                <p className="text-[9px] text-muted">{stat.note}</p>
              </div>
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${stat.color}`}
              >
                <stat.icon size={18} strokeWidth={1.7} />
              </span>
            </div>
          ))}
        </div>
        {error && (
          <div className="mb-5">
            <ErrorNotice message={error} />
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-[#c9dbc6] bg-soft px-4 py-3 text-xs text-green"
          >
            {notice}
          </div>
        )}
        <div className="grid items-start gap-4 lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)_320px]">
          <IncidentList
            reports={filtered}
            selectedId={selected?.id ?? null}
            risk={risk}
            status={status}
            onRisk={setRisk}
            onStatus={setStatus}
            onSelect={select}
            loading={loading && reports.length === 0}
          />
          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <div className="flex h-15 items-center justify-between px-5">
              <h2 className="flex items-center gap-2 text-xs font-bold">
                <MapPin size={15} className="text-green" /> Incident map
              </h2>
              <span className="text-[10px] text-muted">Aktau, KZ</span>
            </div>
            <div
              className="map-shell h-[410px] border-y border-line lg:h-[612px]"
              aria-label="Map of reported incidents in Aktau"
            >
              <AktauMap
                reports={filtered}
                selectedId={selected?.id}
                onSelect={select}
              />
            </div>
            <div className="flex h-12 flex-wrap items-center justify-between gap-2 px-4 text-[9px] text-muted">
              <span className="flex gap-3">
                {(["LOW", "MEDIUM", "HIGH"] as const).map((level) => (
                  <span key={level} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: RISK_META[level].markerColor }}
                    />
                    {level.charAt(0) + level.slice(1).toLowerCase()}
                  </span>
                ))}
              </span>
              <span>© OpenStreetMap</span>
            </div>
          </section>
          <div
            ref={details}
            className="min-w-0 scroll-mt-5 lg:col-span-2 xl:col-span-1"
          >
            {selected ? (
              <ReportDetails
                key={`${selected.id}:${selected.updatedAt}`}
                report={selected}
                onUpdated={update}
              />
            ) : (
              <section className="panel flex min-h-72 flex-col items-center justify-center px-6 text-center">
                <ClipboardList size={25} className="mb-4 text-muted" />
                <h2 className="text-sm font-bold">Select a report</h2>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Matching incident details and evidence will appear here.
                </p>
              </section>
            )}
          </div>
        </div>
        <footer className="mt-6 flex flex-col justify-between gap-2 text-[10px] text-muted sm:flex-row">
          <p>LeakProof · Community signals. Human decisions.</p>
          <p>Demo workspace · No connection to city services</p>
        </footer>
      </main>
    </div>
  );
}
