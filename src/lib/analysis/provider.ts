import type {
  AnalysisResult,
  AnalysisStage,
  DemoScenario,
  AnalysisMode,
} from "@/domain/analysis";
import type { VideoMetadata } from "@/domain/report";
import { validateVideoMetadata } from "@/lib/video";

import { createDemoResult } from "./demo";

export type AnalysisInput = {
  video: VideoMetadata;
  scenario: DemoScenario;
  source: Blob;
};

export type AnalysisOptions = {
  mode?: AnalysisMode;
  signal?: AbortSignal;
  onStage?: (stage: AnalysisStage) => void;
};

export interface AnalysisProvider {
  analyze(
    input: AnalysisInput,
    options?: AnalysisOptions,
  ): Promise<AnalysisResult>;
}

const SCENARIOS = new Set<DemoScenario>([
  "NO_WATER",
  "UNCERTAIN",
  "LOW",
  "MEDIUM",
  "HIGH",
]);
const STAGE_DELAY_MS = 600;

function abortError(): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException("The analysis was cancelled.", "AbortError");
  }
  const error = new Error("The analysis was cancelled.");
  error.name = "AbortError";
  return error;
}

function waitForStage(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, STAGE_DELAY_MS);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

async function executeStage(
  stage: AnalysisStage,
  options?: AnalysisOptions,
): Promise<void> {
  if (options?.signal?.aborted) throw abortError();
  options?.onStage?.(stage);
  await waitForStage(options?.signal);
}

export class DemoAnalysisProvider implements AnalysisProvider {
  async analyze(
    input: AnalysisInput,
    options?: AnalysisOptions,
  ): Promise<AnalysisResult> {
    if (!SCENARIOS.has(input.scenario))
      throw new Error("Invalid demo analysis scenario.");
    const metadataError = validateVideoMetadata(input.video);
    if (metadataError) throw new Error(metadataError);
    if (!(input.source instanceof Blob) || input.source.size <= 0) {
      throw new Error("The source video is empty or invalid.");
    }
    if (input.source.size !== input.video.size) {
      throw new Error("The source video size does not match its metadata.");
    }
    if (options?.signal?.aborted) throw abortError();

    await executeStage("water", options);

    if (Math.min(input.video.width, input.video.height) < 320) {
      return { ...createDemoResult("UNCERTAIN"), scenario: input.scenario };
    }

    if (input.scenario === "NO_WATER" || input.scenario === "UNCERTAIN") {
      return createDemoResult(input.scenario);
    }

    await executeStage("movement", options);
    await executeStage("source", options);
    await executeStage("risk", options);
    return createDemoResult(input.scenario);
  }
}

const demoAnalysisProvider: AnalysisProvider = new DemoAnalysisProvider();

export async function analyzeLeakVideo(
  input: AnalysisInput,
  options?: AnalysisOptions,
): Promise<AnalysisResult> {
  if (options?.mode === "openai") {
    const { RealAnalysisProvider } = await import("./real-provider");
    return new RealAnalysisProvider().analyze(input, options);
  }
  return demoAnalysisProvider.analyze(input, options);
}
