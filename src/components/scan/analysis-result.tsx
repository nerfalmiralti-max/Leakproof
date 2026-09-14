import { ArrowRight, RotateCcw, ShieldCheck } from "lucide-react";
import type { AnalysisResult as Result } from "@/domain/analysis";
import { canReport, RISK_META } from "@/lib/presentation";
import { EvidenceSummary, RiskBadge } from "../report/evidence-summary";

export function AnalysisResult({
  result,
  onReport,
  onReset,
}: {
  result: Result;
  onReport: () => void;
  onReset: () => void;
}) {
  const reportable = canReport(result);
  return (
    <section className="panel mx-auto max-w-2xl overflow-hidden">
      <div className="border-b border-line px-6 py-6 sm:px-8">
        <div className="mb-4 flex items-center justify-between">
          <span className="eyebrow text-muted">
            {result.provider === "demo"
              ? "Demo assessment"
              : "Visual assessment"}
          </span>
          <RiskBadge result={result} />
        </div>
        <h2 className="text-2xl leading-snug font-bold tracking-[-.7px]">
          {result.provider === "openai" &&
          result.sourceType === "CONTROLLED_SOURCE" &&
          result.leakRisk === "LOW"
            ? "Expected water source detected"
            : RISK_META[result.leakRisk].headline}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {result.provider === "demo" && result.scenario
            ? `Simulated result · Scenario: ${RISK_META[result.scenario].label}`
            : "Six sampled frames · No calibrated probability estimate"}
        </p>
      </div>
      <div className="space-y-6 p-6 sm:p-8">
        <EvidenceSummary result={result} />
        {reportable && (
          <div className="flex items-center justify-between border-y border-line py-4">
            <p className="text-sm font-semibold">Leak risk</p>
            <RiskBadge result={result} />
          </div>
        )}
        <div>
          <h3 className="mb-2 text-sm font-bold">What the evidence suggests</h3>
          <p className="text-[13px] leading-relaxed text-muted">
            {result.explanation}
          </p>
        </div>
        <div className="rounded-xl bg-soft p-4">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold">
            <ShieldCheck size={16} /> Recommended next step
          </h3>
          <p className="text-xs leading-relaxed text-[#53614e]">
            {result.recommendation}
          </p>
        </div>
        <div className="space-y-2">
          {reportable && (
            <button
              type="button"
              onClick={onReport}
              className="btn btn-primary w-full"
            >
              {result.leakRisk === "LOW"
                ? "Add a report for review"
                : "Report for inspection"}
              <ArrowRight size={17} />
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className={`btn w-full ${reportable ? "btn-secondary" : "btn-primary"}`}
          >
            <RotateCcw size={16} />
            {result.leakRisk === "UNCERTAIN"
              ? "Record again"
              : "Check another video"}
          </button>
        </div>
        <p className="text-center text-[10px] leading-relaxed text-muted">
          This assessment is not a diagnosis. A person must inspect the location
          to determine the cause.
        </p>
      </div>
    </section>
  );
}
