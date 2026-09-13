import "server-only";
import type { AnalysisMode } from "@/domain/analysis";

// Server use only. Never return or expose a key through this configuration.
export function getAnalysisMode(): AnalysisMode {
  const mode = process.env.ANALYSIS_PROVIDER ?? "demo";
  if (mode !== "demo" && mode !== "openai")
    throw new Error("ANALYSIS_PROVIDER must be demo or openai.");
  return mode;
}
