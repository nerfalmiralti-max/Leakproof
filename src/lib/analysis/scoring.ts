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
    // Validate citation values in the gate so unusable numeric citations
    // downgrade water evidence instead of becoming a provider error.
    waterSupportingFrames: z.array(z.number()).max(6),
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

export const waterGateEvidenceSchema = visionEvidenceSchema.pick({
  quality: true,
  qualityIssues: true,
  waterDetected: true,
  waterEvidence: true,
  waterSupportingFrames: true,
});

export const temporalEvidenceSchema = z
  .object({
    activeFlow: signal,
    activeFlowSupportingFrames: frames,
    persistentSource: signal,
    persistentSourceSupportingFrames: frames,
    spreading: signal,
    spreadingSupportingFrames: frames,
  })
  .strict();

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

// A null result means credible water passed the gate; temporal analysis may run.
export function scoreWaterGate(raw: unknown): AnalysisResult | null {
  const data = waterGateEvidenceSchema.parse(raw);
  if (
    data.quality === "POOR" ||
    data.qualityIssues.some((issue) => issue !== "AMBIGUOUS")
  )
    return uncertainResult();
  const waterFrames = data.waterSupportingFrames.filter(
    (index) => Number.isInteger(index) && index >= 0 && index <= 5,
  );
  const hasWaterSupport = supported("YES", waterFrames, 2) === "YES";
  if (
    !data.waterDetected ||
    data.waterEvidence === "NONE" ||
    data.waterEvidence === "WEAK" ||
    !hasWaterSupport
  ) {
    return {
      ...uncertainResult(),
      quality: "GOOD",
      waterEvidence: data.waterEvidence === "NONE" ? "NONE" : "WEAK",
      activeFlow: "UNCERTAIN",
      leakRisk: "NO_WATER",
      explanation:
        "No reliable water evidence detected. Further flow, source and spreading assessment was not used.",
      recommendation: recommendations.NO_WATER,
    };
  }
  // Ambiguity alone cannot establish water on an otherwise usable recording.
  // Preserve the existing quality handling after water passes the gate.
  if (data.qualityIssues.length > 0) return uncertainResult();
  return null;
}

export function scoreEvidence(raw: unknown): AnalysisResult {
  const data = visionEvidenceSchema.parse(raw);
  const gateResult = scoreWaterGate({
    quality: data.quality,
    qualityIssues: data.qualityIssues,
    waterDetected: data.waterDetected,
    waterEvidence: data.waterEvidence,
    waterSupportingFrames: data.waterSupportingFrames,
  });
  if (gateResult) return gateResult;
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
