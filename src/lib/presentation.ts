import type { AnalysisResult, Risk } from "@/domain/analysis";
import type { ReportStatus } from "@/domain/report";

type RiskPresentation = {
  label: string;
  className: string;
  markerColor: string;
  headline: string;
};

type StatusPresentation = {
  label: string;
  className: string;
};

export const RISK_META: Record<Risk, RiskPresentation> = {
  NO_WATER: {
    label: "No water detected",
    className: "border border-slate-300 bg-slate-100 text-slate-900",
    markerColor: "#475569",
    headline: "No reliable water evidence detected",
  },
  UNCERTAIN: {
    label: "Uncertain",
    className: "border border-amber-300 bg-amber-100 text-amber-950",
    markerColor: "#b45309",
    headline: "A clearer recording is needed",
  },
  LOW: {
    label: "Low risk",
    className: "border border-emerald-300 bg-emerald-100 text-emerald-950",
    markerColor: "#047857",
    headline: "Contained water observation",
  },
  MEDIUM: {
    label: "Medium risk",
    className: "border border-orange-300 bg-orange-100 text-orange-950",
    markerColor: "#c2410c",
    headline: "Active flow may need inspection",
  },
  HIGH: {
    label: "High risk",
    className: "border border-red-300 bg-red-100 text-red-950",
    markerColor: "#b91c1c",
    headline: "Prompt inspection is recommended",
  },
};

export const STATUS_META: Record<ReportStatus, StatusPresentation> = {
  NEW: {
    label: "New",
    className: "border border-sky-300 bg-sky-100 text-sky-950",
  },
  IN_REVIEW: {
    label: "In review",
    className: "border border-amber-300 bg-amber-100 text-amber-950",
  },
  ACCEPTED: {
    label: "Accepted",
    className: "border border-emerald-300 bg-emerald-100 text-emerald-950",
  },
  RESOLVED: {
    label: "Resolved",
    className: "border border-slate-300 bg-slate-100 text-slate-900",
  },
};

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function canReport(result: AnalysisResult): boolean {
  return (
    result.leakRisk === "LOW" ||
    result.leakRisk === "MEDIUM" ||
    result.leakRisk === "HIGH"
  );
}
