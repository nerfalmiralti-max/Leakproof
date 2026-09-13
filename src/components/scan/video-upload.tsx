"use client";

import { useRef } from "react";
import {
  Camera,
  Check,
  FileVideo,
  ScanLine,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import type { DemoScenario } from "@/domain/analysis";
import type { VideoMetadata } from "@/domain/report";
import { DEMO_SCENARIOS } from "@/lib/analysis/demo";
import { ErrorNotice } from "../ui";

export type SelectedVideo = {
  file: File;
  metadata: VideoMetadata;
  url: string;
};
type Props = {
  mode: "demo" | "openai";
  selected: SelectedVideo | null;
  loading: boolean;
  error: string | null;
  scenario: DemoScenario;
  onScenario: (scenario: DemoScenario) => void;
  onFile: (file: File) => void;
  onRemove: () => void;
  onAnalyze: () => void;
  onError: (error: string) => void;
};

export function VideoUpload({
  mode,
  selected,
  loading,
  error,
  scenario,
  onScenario,
  onFile,
  onRemove,
  onAnalyze,
  onError,
}: Props) {
  const upload = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onFile(file);
  }
  return (
    <div className="grid items-start gap-7 lg:grid-cols-[1fr_280px]">
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="text-base font-bold">Your video</h2>
          <span className="rounded bg-paper px-2 py-1 text-[10px] font-medium text-muted">
            5–10 SECONDS
          </span>
        </div>
        <div className="space-y-5 p-5 sm:p-6">
          <input
            ref={upload}
            id="video-upload"
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
            className="sr-only"
            aria-label="Choose video file"
            onChange={selectFile}
            disabled={loading}
          />
          <input
            ref={camera}
            id="video-capture"
            type="file"
            accept="video/*"
            capture="environment"
            className="sr-only"
            aria-label="Record video"
            onChange={selectFile}
            disabled={loading}
          />
          {selected ? (
            <div>
              <video
                key={selected.url}
                src={selected.url}
                controls
                playsInline
                preload="metadata"
                className="aspect-video max-h-80 w-full rounded-xl bg-[#152c27] object-contain"
                aria-label="Selected video preview"
                onError={() =>
                  onError(
                    "This browser cannot play the video. Try an MP4 (H.264) or WebM recording.",
                  )
                }
              />
              <div className="mt-3 flex items-center gap-3 rounded-lg bg-paper p-3">
                <FileVideo size={19} className="shrink-0 text-green" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {selected.metadata.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {selected.metadata.duration.toFixed(1)} sec ·{" "}
                    {(selected.file.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                    {selected.metadata.width} × {selected.metadata.height}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRemove}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-white hover:text-red-700"
                  aria-label="Remove video"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file && !loading) onFile(file);
              }}
              className="flex min-h-[276px] flex-col items-center justify-center rounded-xl border border-dashed border-[#bbccbb] bg-[#f8faf6] px-5 py-8 text-center"
            >
              <span className="mb-5 grid h-15 w-15 place-items-center rounded-2xl border border-[#dae4d4] bg-soft text-green">
                <Upload size={25} strokeWidth={1.6} />
              </span>
              <h3 className="text-lg font-bold tracking-[-.5px]">
                {loading ? "Checking your video…" : "Start with what you see"}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Choose a short video or record one on your phone.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  className="btn btn-primary !min-h-10 !py-2 !text-xs"
                  disabled={loading}
                  onClick={() => upload.current?.click()}
                >
                  <Upload size={15} /> Choose video
                </button>
                <button
                  type="button"
                  className="btn btn-secondary !min-h-10 !py-2 !text-xs"
                  disabled={loading}
                  onClick={() => camera.current?.click()}
                >
                  <Camera size={15} /> Record video
                </button>
              </div>
              <p className="mt-4 text-[10px] text-muted">
                MP4, WebM or MOV · Up to 50 MB · Or drag a video here
              </p>
            </div>
          )}
          <ErrorNotice message={error} />
          {mode === "demo" && (
            <div className="rounded-xl border border-[#dedfc9] bg-[#fafaf0] p-4">
              <label
                htmlFor="demo-scenario"
                className="flex items-center justify-between text-xs font-semibold"
              >
                Demo scenario
                <span className="rounded border border-[#d7d9bb] px-1.5 py-0.5 text-[9px] tracking-wider text-[#6c703e]">
                  SIMULATED
                </span>
              </label>
              <select
                id="demo-scenario"
                className="field mt-3"
                value={scenario}
                onChange={(event) =>
                  onScenario(event.target.value as DemoScenario)
                }
              >
                {DEMO_SCENARIOS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] leading-relaxed text-[#6e735d]">
                This choice controls the demo result. Your video is not analysed
                by AI. Low resolution can still return an uncertain result.
              </p>
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!selected || loading}
            onClick={onAnalyze}
          >
            <ScanLine size={17} />{" "}
            {mode === "demo" ? "Run demo analysis" : "Analyse video"}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted">
            <ShieldCheck size={13} />{" "}
            {mode === "demo"
              ? "Your video stays on this device."
              : "Only 6 frames are sent for analysis. No video or audio upload."}
          </p>
        </div>
      </section>
      <aside className="rounded-xl border border-line bg-[#edf1e8] p-6">
        <span className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-white text-green">
          <Camera size={20} />
        </span>
        <h2 className="text-sm font-bold">A clearer video helps</h2>
        <ul className="mt-5 space-y-4 text-xs leading-relaxed text-muted">
          {[
            "Hold your phone steady for 5–10 seconds.",
            "Include the suspected source and surrounding ground.",
            "Use daylight and avoid zooming in too far.",
            "Keep a safe distance from traffic and open drains.",
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2">
              <Check size={14} className="mt-0.5 shrink-0 text-green" />
              {tip}
            </li>
          ))}
        </ul>
        <div className="mt-6 border-t border-[#d6dfcd] pt-4 text-[11px] leading-relaxed text-muted">
          Water on the ground can have many causes. LeakProof helps organise
          evidence for a person to review.
        </div>
      </aside>
    </div>
  );
}
