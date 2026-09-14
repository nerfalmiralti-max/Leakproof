import { z } from "zod";

const risk = z.enum(["NO_WATER", "UNCERTAIN", "LOW", "MEDIUM", "HIGH"]);
const probability = z.number().finite().min(0).max(1).nullable();
export const analysisResultSchema = z
  .object({
    waterDetected: z.boolean(),
    waterConfidence: probability,
    activeFlowProbability: probability,
    persistentSource: z.boolean().nullable(),
    spreadingDetected: z.boolean().nullable(),
    leakRisk: risk,
    explanation: z.string().min(1).max(1000),
    recommendation: z.string().min(1).max(1000),
    provider: z.enum(["demo", "openai"]),
    scenario: risk.nullable(),
    quality: z.enum(["GOOD", "POOR"]).optional(),
    waterEvidence: z.enum(["NONE", "WEAK", "MODERATE", "STRONG"]).optional(),
    activeFlow: z.enum(["NO", "UNCERTAIN", "YES"]).optional(),
    // Optional for historical saved reports; new provider responses require it.
    sourceType: z
      .enum(["CONTROLLED_SOURCE", "UNCERTAIN_SOURCE", "SUSPICIOUS_SOURCE"])
      .optional(),
  })
  .strict()
  .superRefine((result, context) => {
    const fail = (message: string) =>
      context.addIssue({ code: "custom", message });
    if (result.provider === "demo") {
      if (
        result.scenario === null ||
        (result.leakRisk !== result.scenario && result.leakRisk !== "UNCERTAIN")
      )
        fail("Risk must match the demo scenario unless quality is uncertain.");
    } else {
      if (
        result.scenario !== null ||
        result.waterConfidence !== null ||
        result.activeFlowProbability !== null
      )
        fail(
          "Real analysis cannot contain demo scenarios or uncalibrated probabilities.",
        );
      if (!result.quality || !result.waterEvidence || !result.activeFlow)
        fail("Real analysis requires categorical evidence.");
    }
    const downstream = [
      result.activeFlowProbability,
      result.persistentSource,
      result.spreadingDetected,
    ];
    if (result.leakRisk === "NO_WATER" && result.waterDetected)
      fail("No-water results cannot claim water detection.");
    if (result.leakRisk === "NO_WATER" || result.leakRisk === "UNCERTAIN") {
      if (
        !(
          result.leakRisk === "UNCERTAIN" &&
          result.sourceType === "UNCERTAIN_SOURCE" &&
          result.quality === "GOOD" &&
          result.waterDetected &&
          ["MODERATE", "STRONG"].includes(result.waterEvidence ?? "")
        ) &&
        (downstream.some((value) => value !== null) ||
          result.activeFlow === "YES")
      )
        fail("Unassessed results cannot contain downstream evidence.");
    } else {
      if (
        result.provider === "openai" &&
        (result.sourceType === "UNCERTAIN_SOURCE" ||
          (result.sourceType === "CONTROLLED_SOURCE" &&
            result.leakRisk !== "LOW"))
      )
        fail("Risk must respect source assessment.");
      if (!result.waterDetected)
        fail("Actionable results require water evidence.");
      if (
        result.provider === "demo" &&
        downstream.some((value) => value === null)
      )
        fail("Actionable demo results require complete water evidence.");
      if (
        result.provider === "openai" &&
        (result.quality !== "GOOD" ||
          !["MODERATE", "STRONG"].includes(result.waterEvidence ?? "") ||
          result.activeFlow === "UNCERTAIN")
      )
        fail(
          "Actionable real results require usable quality and sufficient evidence.",
        );
    }
  });
