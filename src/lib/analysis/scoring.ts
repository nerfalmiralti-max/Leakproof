import { z } from "zod";
import type { AnalysisResult, Risk, Signal } from "@/domain/analysis";

const signal = z.enum(["NO", "UNCERTAIN", "YES"]);
const frames = z.array(z.number().int().min(0).max(5)).max(6);
export const visionEvidenceSchema = z
  .object({
    quality: z.enum(["GOOD", "POOR"]),
    qualityIssues: z
      .array(
        z.enum([
          "BLUR",
          "DARKNESS",
          "CAMERA_MOTION",
          "OBSTRUCTION",
          "FRAMING",
          "AMBIGUOUS",
        ]),
      )
      .max(6),
    waterDetected: z.boolean(),
    waterEvidence: z.enum(["NONE", "WEAK", "MODERATE", "STRONG"]),
    activeFlow: signal,
    persistentSource: signal,
    spreading: signal,
    activeFlowFrames: frames,
    persistentSourceFrames: frames,
    spreadingFrames: frames,
    evidence: z.array(z.string().max(180)).max(4),
  })
  .strict();
export type VisionEvidence = z.infer<typeof visionEvidenceSchema>;

const recommendations: Record<Risk, string> = {
  NO_WATER:
    "No reliable water evidence detected. Try another recording if you still suspect a problem.",
  UNCERTAIN:
    "Evidence is insufficient. Record again with a steady camera, in good light, keeping the suspected source and surrounding ground visible.",
  LOW: "No urgent signs were identified. Monitor the area and record again if conditions change.",
  MEDIUM:
    "Possible active water flow detected. Consider submitting the location for inspection.",
  HIGH: "Multiple signs of active water flow detected. Submit the location for inspection. The cause requires a human inspection.",
};

export function uncertainResult(): AnalysisResult {
  return {
    provider: "openai",
    scenario: null,
    quality: "POOR",
    waterDetected: false,
    waterEvidence: "WEAK",
    waterConfidence: null,
    activeFlowProbability: null,
    activeFlow: "UNCERTAIN",
    persistentSource: null,
    spreadingDetected: null,
    leakRisk: "UNCERTAIN",
    explanation: "Evidence is insufficient for a reliable assessment.",
    recommendation: recommendations.UNCERTAIN,
  };
}

function supported(value: Signal, indices: number[], minimum: number): Signal {
  if (value !== "YES") return value;
  const unique = [...new Set(indices)];
  // Require observations separated across at least half the sampled interval.
  return unique.length >= minimum &&
    Math.max(...unique) - Math.min(...unique) >= 3
    ? "YES"
    : "UNCERTAIN";
}

export function scoreEvidence(raw: unknown): AnalysisResult {
  const data = visionEvidenceSchema.parse(raw);
  if (data.quality === "POOR" || data.qualityIssues.length > 0)
    return uncertainResult();
  if (
    !data.waterDetected ||
    data.waterEvidence === "NONE" ||
    data.waterEvidence === "WEAK"
  ) {
    return {
      ...uncertainResult(),
      quality: "GOOD",
      waterEvidence: data.waterEvidence,
      activeFlow: "UNCERTAIN",
      leakRisk: "NO_WATER",
      explanation:
        "No reliable water evidence detected. Further flow, source and spreading assessment was not used.",
      recommendation: recommendations.NO_WATER,
    };
  }
  const activeFlow = supported(data.activeFlow, data.activeFlowFrames, 3);
  const source = supported(
    data.persistentSource,
    data.persistentSourceFrames,
    3,
  );
  const spreading = supported(data.spreading, data.spreadingFrames, 2);
  const signals = [activeFlow, source, spreading];
  if (
    activeFlow === "UNCERTAIN" ||
    signals.filter((value) => value === "UNCERTAIN").length >= 2
  ) {
    return {
      ...uncertainResult(),
      quality: "GOOD",
      waterDetected: true,
      waterEvidence: data.waterEvidence,
      explanation:
        "Water is visible, but temporal evidence is insufficient to assess sustained flow reliably.",
    };
  }
  const yesCount = signals.filter((value) => value === "YES").length;
  const leakRisk: Risk =
    data.waterEvidence === "STRONG" && yesCount === 3
      ? "HIGH"
      : yesCount > 0
        ? "MEDIUM"
        : "LOW";
  const sentences = ["Water is visible in the sampled frames."];
  if (activeFlow === "YES")
    sentences.push("Sustained water movement appears across several moments.");
  if (source === "YES")
    sentences.push(
      "Water appears to emerge consistently from one visible region.",
    );
  if (spreading === "YES")
    sentences.push("The visible wet area appears to spread over time.");
  if (yesCount === 0)
    sentences.push(
      "The sampled frames do not show strong signs of persistent active flow.",
    );
  if (signals.includes("UNCERTAIN"))
    sentences.push("Some visual signals remain unclear.");
  sentences.push("The cause cannot be established from these images.");
  return {
    provider: "openai",
    scenario: null,
    quality: "GOOD",
    waterDetected: true,
    waterEvidence: data.waterEvidence,
    waterConfidence: null,
    activeFlowProbability: null,
    activeFlow,
    persistentSource: source === "UNCERTAIN" ? null : source === "YES",
    spreadingDetected: spreading === "UNCERTAIN" ? null : spreading === "YES",
    leakRisk,
    explanation: sentences.join(" "),
    recommendation: recommendations[leakRisk],
  };
}
