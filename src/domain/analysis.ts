export type Risk = "NO_WATER" | "UNCERTAIN" | "LOW" | "MEDIUM" | "HIGH";

export type DemoScenario = Risk;

export type AnalysisStage =
  "frames" | "quality" | "water" | "movement" | "source" | "risk";
export type AnalysisMode = "demo" | "openai";
export type Signal = "NO" | "UNCERTAIN" | "YES";
export type WaterEvidence = "NONE" | "WEAK" | "MODERATE" | "STRONG";
export type SourceType =
  "CONTROLLED_SOURCE" | "UNCERTAIN_SOURCE" | "SUSPICIOUS_SOURCE";

export interface AnalysisResult {
  waterDetected: boolean;
  waterConfidence: number | null;
  activeFlowProbability: number | null;
  persistentSource: boolean | null;
  spreadingDetected: boolean | null;
  leakRisk: Risk;
  explanation: string;
  recommendation: string;
  provider: AnalysisMode;
  scenario: DemoScenario | null;
  waterEvidence?: WaterEvidence;
  activeFlow?: Signal;
  quality?: "GOOD" | "POOR";
  sourceType?: SourceType;
}
