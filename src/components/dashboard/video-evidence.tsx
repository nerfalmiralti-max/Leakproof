"use client";
import { useEffect, useState } from "react";
import { Video, VideoOff } from "lucide-react";
import type { LeakReport } from "@/domain/report";
import { getReportRepository } from "@/lib/reports";
import { getSignedEvidenceUrl } from "@/lib/reports/remote-repository";

export function VideoEvidence({ report }: { report: LeakReport }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!report.evidenceId) return;
    let active = true;
    let objectUrl: string | undefined;
    (report.isDemo
      ? getReportRepository().getEvidence(report.evidenceId)
      : getSignedEvidenceUrl(report.evidenceId)
    )
      .then((blob) => {
        if (!active) return;
        if (!blob) {
          setError("The original video evidence is unavailable.");
          return;
        }
        if (typeof blob === "string") setUrl(blob);
        else {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch((failure) => {
        if (active)
          setError(
            failure instanceof Error
              ? failure.message
              : "Video evidence could not be loaded.",
          );
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [report.evidenceId, report.isDemo]);
  if (report.isDemo && !report.evidenceId)
    return (
      <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-line bg-paper p-4 text-center">
        <VideoOff size={21} strokeWidth={1.5} className="mb-2 text-muted" />
        <p className="text-xs font-medium">Illustrative incident</p>
        <p className="mt-1 max-w-48 text-[10px] leading-relaxed text-muted">
          This sample has no video. A report you create includes the original
          recording.
        </p>
      </div>
    );
  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-4 text-xs text-red-800">
        {error}
      </p>
    );
  if (!url)
    return (
      <div
        role="status"
        className="flex min-h-32 items-center justify-center gap-2 rounded-lg bg-paper text-xs text-muted"
      >
        <Video size={16} /> Loading video evidence…
      </div>
    );
  return (
    <div>
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded-lg bg-[#152c27] object-contain"
        aria-label="Report video evidence"
        onError={() =>
          setError(
            "This browser cannot play this recording. Try opening it in the browser used to record it.",
          )
        }
      />
      <p className="mt-2 truncate text-[10px] text-muted">
        {report.video?.name} · {report.video?.duration.toFixed(1)} sec ·
        Original local recording
      </p>
    </div>
  );
}
