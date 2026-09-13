"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import type {
  AnalysisResult as Result,
  AnalysisStage,
  DemoScenario,
  AnalysisMode,
} from "@/domain/analysis";
import type { LeakReport } from "@/domain/report";
import { analyzeLeakVideo } from "@/lib/analysis/provider";
import {
  readVideoMetadata,
  validateVideoFile,
  validateVideoMetadata,
} from "@/lib/video";
import { DemoNotice } from "../demo-notice";
import { VideoUpload, type SelectedVideo } from "./video-upload";
import { AnalysisProgress } from "./analysis-progress";
import { AnalysisResult } from "./analysis-result";
import { ReportForm } from "../report/report-form";
import { ReportCreated } from "../report/report-created";

type Step = "upload" | "analysing" | "result" | "report" | "created";
const TITLES: Record<Step, { title: string; description: string }> = {
  upload: {
    title: "A better look starts here.",
    description: "Capture what you noticed. We’ll help organise the next step.",
  },
  analysing: {
    title: "From video to useful evidence.",
    description: "A careful assessment starts by establishing what is visible.",
  },
  result: {
    title: "Here’s the assessment.",
    description: "Evidence to guide attention, with room for uncertainty.",
  },
  report: {
    title: "Give your observation a place.",
    description: "The right location makes a report useful.",
  },
  created: {
    title: "A small action, recorded.",
    description: "Thank you for looking out for the water we share.",
  },
};

export function ScanFlow({ mode }: { mode: AnalysisMode }) {
  const [step, setStep] = useState<Step>("upload");
  const [selected, setSelected] = useState<SelectedVideo | null>(null);
  const [scenario, setScenario] = useState<DemoScenario>("UNCERTAIN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<AnalysisStage>("water");
  const [result, setResult] = useState<Result | null>(null);
  const [report, setReport] = useState<LeakReport | null>(null);
  const operation = useRef<AbortController | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const url = selected?.url;
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    if (step !== "upload") {
      title.current?.focus({ preventScroll: true });
      title.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [step]);

  async function chooseFile(file: File) {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setSelected(null);
    setError(null);
    setLoading(true);
    try {
      const fileError = validateVideoFile(file);
      if (fileError) throw new Error(fileError);
      const metadata = await readVideoMetadata(file, controller.signal);
      const metadataError = validateVideoMetadata(metadata);
      if (metadataError) throw new Error(metadataError);
      if (!controller.signal.aborted)
        setSelected({ file, metadata, url: URL.createObjectURL(file) });
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "This video could not be opened. Choose another recording.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  function reset() {
    operation.current?.abort();
    setSelected(null);
    setResult(null);
    setReport(null);
    setError(null);
    setLoading(false);
    setStep("upload");
  }
  async function analyze() {
    if (!selected) return;
    const controller = new AbortController();
    operation.current?.abort();
    operation.current = controller;
    setError(null);
    setStage(mode === "openai" ? "frames" : "water");
    setStep("analysing");
    try {
      const assessment = await analyzeLeakVideo(
        { video: selected.metadata, source: selected.file, scenario },
        { mode, signal: controller.signal, onStage: setStage },
      );
      if (!controller.signal.aborted) {
        setResult(assessment);
        setStep("result");
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Analysis could not finish. Please try again.",
        );
        setStep("upload");
      }
    }
  }
  const activeStep =
    step === "upload" ? 0 : step === "analysing" || step === "result" ? 1 : 2;
  return (
    <div className="mx-auto w-[calc(100%-40px)] max-w-[1010px] py-8 sm:py-10">
      <Link
        href="/"
        className="mb-8 inline-flex min-h-8 items-center gap-2 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft size={14} /> Back to home
      </Link>
      <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div>
          <p className="eyebrow mb-3 text-green">Community water reporting</p>
          <h1
            ref={title}
            tabIndex={-1}
            className="scroll-mt-6 text-[28px] leading-tight font-bold tracking-[-1.2px] outline-none sm:text-[35px]"
          >
            {TITLES[step].title}
          </h1>
          <p className="mt-3 text-[13px] text-muted">
            {TITLES[step].description}
          </p>
        </div>
        <ol
          className="flex shrink-0 items-center gap-3"
          aria-label="Report progress"
        >
          {["Video", "Assessment", "Location"].map((label, index) => (
            <li
              key={label}
              aria-current={activeStep === index ? "step" : undefined}
              className="flex items-center gap-2"
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${index <= activeStep ? "bg-green text-white" : "border border-line text-muted"}`}
              >
                {index < activeStep || step === "created" ? (
                  <Check size={12} />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={`text-[10px] ${index === activeStep ? "font-semibold" : "text-muted"}`}
              >
                {label}
              </span>
              {index < 2 && <span className="ml-1 h-px w-3 bg-line" />}
            </li>
          ))}
        </ol>
      </div>
      <div className="mb-6">
        <DemoNotice compact mode={mode} />
      </div>
      <div className="enter" key={step}>
        {step === "upload" && (
          <VideoUpload
            mode={mode}
            selected={selected}
            loading={loading}
            error={error}
            scenario={scenario}
            onScenario={setScenario}
            onFile={chooseFile}
            onRemove={() => {
              setSelected(null);
              setError(null);
            }}
            onAnalyze={analyze}
            onError={(message) => {
              setSelected(null);
              setError(message);
            }}
          />
        )}
        {step === "analysing" && (
          <AnalysisProgress
            mode={mode}
            stage={stage}
            onCancel={() => {
              operation.current?.abort();
              setStep("upload");
            }}
          />
        )}
        {step === "result" && result && (
          <AnalysisResult
            result={result}
            onReport={() => setStep("report")}
            onReset={reset}
          />
        )}
        {step === "report" && result && selected && (
          <ReportForm
            result={result}
            selected={selected}
            onBack={() => setStep("result")}
            onCreated={(created) => {
              setReport(created);
              setStep("created");
            }}
          />
        )}
        {step === "created" && report && (
          <ReportCreated report={report} onReset={reset} />
        )}
      </div>
    </div>
  );
}
