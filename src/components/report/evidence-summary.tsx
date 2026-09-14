import { Droplets, Focus, MoveUpRight, Expand } from "lucide-react";
import type { AnalysisResult } from "@/domain/analysis";
import { RISK_META } from "@/lib/presentation";

export function RiskBadge({ result }: { result: AnalysisResult }) {
  const meta = RISK_META[result.leakRisk];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold tracking-wide ${meta.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

export function EvidenceSummary({
  result,
  compact = false,
}: {
  result: AnalysisResult;
  compact?: boolean;
}) {
  if (result.leakRisk === "NO_WATER")
    return (
      <div className="rounded-xl border border-line bg-paper p-5">
        <Droplets size={22} className="mb-3 text-muted" />
        <p className="text-sm font-semibold">
          No reliable water evidence detected.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Movement, source and spreading checks were not performed. There is no
          risk estimate to show.
        </p>
      </div>
    );
  if (
    result.leakRisk === "UNCERTAIN" &&
    !(
      result.waterDetected &&
      result.quality === "GOOD" &&
      result.sourceType === "UNCERTAIN_SOURCE"
    )
  )
    return (
      <div className="rounded-xl border border-[#e8ddbd] bg-[#fbf8ef] p-5">
        <Focus size={22} className="mb-3 text-[#887637]" />
        <p className="text-sm font-semibold">
          Evidence is insufficient for a reliable assessment.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Record again in better light, keep the camera steady and include the
          surrounding area.
        </p>
      </div>
    );
  const booleanText = (value: boolean | null) =>
    value === null ? "Not assessed" : value ? "Detected" : "Not detected";
  const signals =
    result.provider === "openai"
      ? [
          {
            icon: Droplets,
            label: "Water evidence",
            value: result.waterEvidence === "STRONG" ? "Strong" : "Moderate",
            hint: "Categorical visual evidence",
          },
          {
            icon: MoveUpRight,
            label: "Active flow",
            value:
              result.activeFlow === "YES"
                ? "Signs observed"
                : result.activeFlow === "NO"
                  ? "Not observed"
                  : "Unknown",
            hint: "Across sampled moments",
          },
          {
            icon: Focus,
            label: "Source assessment",
            value:
              result.sourceType === "CONTROLLED_SOURCE"
                ? "Controlled source"
                : result.sourceType === "SUSPICIOUS_SOURCE"
                  ? "Suspicious source"
                  : result.sourceType === "UNCERTAIN_SOURCE"
                    ? "Uncertain source"
                    : "Not assessed",
            hint: "Visible origin, not pipe diagnosis",
          },
          {
            icon: Expand,
            label: "Spreading",
            value: booleanText(result.spreadingDetected),
            hint: "Expanding wet area",
          },
        ]
      : [
          {
            icon: Droplets,
            label: "Water detected",
            value: result.waterDetected ? "Yes" : "No",
            hint: result.waterDetected
              ? `${Math.round((result.waterConfidence ?? 0) * 100)}% demo confidence`
              : "No reliable evidence",
          },
          {
            icon: MoveUpRight,
            label: "Active flow probability",
            value:
              result.activeFlowProbability === null
                ? "Not assessed"
                : `${Math.round(result.activeFlowProbability * 100)}%`,
            hint: "Simulated probability",
          },
          {
            icon: Focus,
            label: "Persistent source",
            value: booleanText(result.persistentSource),
            hint: "Water from one area",
          },
          {
            icon: Expand,
            label: "Spreading",
            value: booleanText(result.spreadingDetected),
            hint: "Expanding wet area",
          },
        ];
  return (
    <dl className={`grid grid-cols-2 ${compact ? "gap-2" : "gap-3"}`}>
      {signals.map((signal) => (
        <div
          key={signal.label}
          className={`rounded-xl border border-line bg-[#fafbf8] ${compact ? "p-3" : "p-4"}`}
        >
          <dt className="flex items-start gap-1.5 text-[10px] text-muted">
            <signal.icon size={13} className="shrink-0" />
            {signal.label}
          </dt>
          <dd
            className={`mt-3 font-display font-bold tracking-[-.4px] ${compact ? "text-sm" : "text-lg"}`}
          >
            {signal.value}
          </dd>
          <dd className="mt-1 text-[9px] text-muted">{signal.hint}</dd>
        </div>
      ))}
    </dl>
  );
}
