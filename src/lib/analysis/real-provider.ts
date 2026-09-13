import type {
  AnalysisInput,
  AnalysisOptions,
  AnalysisProvider,
} from "./provider";
import { extractVideoFrames } from "./frames";
import { analysisResultSchema } from "./result-schema";
import { validateVideoMetadata } from "@/lib/video";

export class RealAnalysisProvider implements AnalysisProvider {
  async analyze(input: AnalysisInput, options?: AnalysisOptions) {
    const error = validateVideoMetadata(input.video);
    if (error) throw new Error(error);
    options?.onStage?.("frames");
    const frames = await extractVideoFrames(
      input.source,
      input.video,
      options?.signal,
    );
    if (options?.signal?.aborted)
      throw new DOMException("Analysis cancelled.", "AbortError");
    options?.onStage?.("quality");
    const timeout = AbortSignal.timeout(35_000);
    let response: Response;
    try {
      response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: input.video, frames }),
        signal: options?.signal
          ? AbortSignal.any([options.signal, timeout])
          : timeout,
      });
    } catch {
      if (options?.signal?.aborted)
        throw new DOMException("Analysis cancelled.", "AbortError");
      throw new Error(
        timeout.aborted
          ? "Analysis timed out. Please try again."
          : "The analysis service could not be reached. Check your connection and try again.",
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error(
        "The service returned an unusable response. Please try again.",
      );
    }
    if (!response.ok) {
      const message =
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : "Analysis could not be completed. Please try again.";
      throw new Error(message);
    }
    const parsed = analysisResultSchema.safeParse(
      typeof body === "object" && body !== null && "result" in body
        ? body.result
        : null,
    );
    if (!parsed.success || parsed.data.provider !== "openai")
      throw new Error(
        "The service returned an invalid assessment. Please try again.",
      );
    if (
      parsed.data.leakRisk !== "NO_WATER" &&
      parsed.data.leakRisk !== "UNCERTAIN"
    )
      options?.onStage?.("risk");
    return parsed.data;
  }
}
