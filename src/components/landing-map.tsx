"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Layers2, MapPin } from "lucide-react";
import { AktauMap } from "./map/aktau-map";
import type { LeakReport } from "@/domain/report";
import { getReportRepository } from "@/lib/reports";
export function LandingMap() {
  const [reports, setReports] = useState<LeakReport[]>([]);
  useEffect(() => {
    let active = true;
    getReportRepository()
      .list()
      .then((data) => {
        if (active) setReports(data.filter((report) => report.isDemo));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="relative min-h-[380px] overflow-hidden rounded-[22px] border border-[#d5dfd3] bg-[#e7ede3] lg:h-[472px]">
      <div className="map-shell landing-map">
        <AktauMap reports={reports} preview />
      </div>
      <div className="pointer-events-none absolute inset-x-5 top-5 z-10 flex items-center justify-between">
        <span className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium shadow-sm">
          <MapPin size={14} className="text-green" /> Aktau, Kazakhstan
        </span>
        <span className="rounded-md bg-ink px-2 py-1.5 text-[9px] font-bold tracking-widest text-white">
          DEMO MAP
        </span>
      </div>
      <Link
        href="/dashboard"
        className="absolute bottom-5 left-5 right-5 z-10 flex items-center gap-3.5 rounded-xl border border-white bg-white p-4 shadow-[0_8px_30px_#173e3610] transition-colors hover:bg-paper"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-soft text-green">
          <Layers2 size={20} />
        </span>
        <span className="flex-1">
          <span className="block text-[13px] font-semibold">
            A clearer picture for the city
          </span>
          <span className="mt-1 block text-[11px] text-muted">
            Open the protected dispatcher workspace
          </span>
        </span>
        <ArrowUpRight size={20} />
      </Link>
      <div className="pointer-events-none absolute bottom-[113px] left-8 z-10 rotate-[-14deg] font-display text-xs italic tracking-[.18em] text-[#577c7e]">
        Caspian Sea
      </div>
    </div>
  );
}
