import { Check, Droplets, Focus, MoveUpRight, ScanLine } from "lucide-react";
import type { AnalysisStage } from "@/domain/analysis";

const STAGES = [
  {
    id: "water",
    label: "Checking for water",
    detail: "Establishing whether there is water evidence",
    icon: Droplets,
  },
  {
    id: "movement",
    label: "Analysing movement",
    detail: "Reviewing signs of sustained water flow",
    icon: MoveUpRight,
  },
  {
    id: "source",
    label: "Checking persistent source",
    detail: "Checking whether water returns to one area",
    icon: Focus,
  },
  {
    id: "risk",
    label: "Estimating risk",
    detail: "Putting the available evidence together",
    icon: ScanLine,
  },
] as const;

export function AnalysisProgress({
  stage,
  mode = "demo",
  onCancel,
}: {
  stage: AnalysisStage;
  mode?: "demo" | "openai";
  onCancel: () => void;
}) {
  const stages =
    mode === "demo"
      ? STAGES
      : [
          {
            id: "frames",
            label: "Preparing representative frames",
            detail: "Extracting six moments on your device",
            icon: ScanLine,
          },
          {
            id: "quality",
            label: "Reviewing quality and water evidence",
            detail:
              "If usable, comparing movement, source and spreading together",
            icon: Droplets,
          },
          {
            id: "risk",
            label: "Applying evidence rules",
            detail: "Calculating a conservative assessment",
            icon: Focus,
          },
        ];
  const current = Math.max(
    0,
    stages.findIndex((item) => item.id === stage),
  );
  return (
    <section className="panel mx-auto max-w-2xl px-6 py-8 sm:px-10">
      <div className="mb-7 text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-soft text-green">
          <ScanLine size={27} strokeWidth={1.5} />
        </span>
        <h2 className="text-xl font-bold">Building an evidence summary</h2>
        <p className="mt-2 text-xs text-muted">
          {mode === "demo"
            ? "Running the selected demonstration scenario"
            : "Reviewing sampled frames; this cannot establish the cause of water"}
        </p>
      </div>
      <ol className="space-y-3" aria-label="Analysis stages">
        {stages.map((item, index) => (
          <li
            key={item.id}
            aria-current={current === index ? "step" : undefined}
            className={`relative flex items-center gap-4 overflow-hidden rounded-xl border p-4 ${index <= current ? "border-[#c9dbc6] bg-[#f5f8ef]" : "border-line bg-white text-muted"}`}
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${index < current ? "bg-green text-white" : "bg-white text-green"}`}
            >
              {index < current ? <Check size={17} /> : <item.icon size={18} />}
            </span>
            <div>
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-1 text-[11px] text-muted">{item.detail}</p>
            </div>
            {current === index && (
              <span className="analysis-bar absolute inset-x-0 bottom-0 h-0.5 bg-green" />
            )}
          </li>
        ))}
      </ol>
      <p className="sr-only" role="status" aria-live="polite">
        {stages[current].label}
      </p>
      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted">
        When water cannot be established, further risk assessment stops.
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="btn btn-secondary mt-5 w-full !text-xs"
      >
        Cancel analysis
      </button>
    </section>
  );
}
