import { z } from "zod";
import { analysisResultSchema } from "@/lib/analysis/result-schema";
export const statusSchema = z.enum([
  "NEW",
  "IN_REVIEW",
  "ACCEPTED",
  "RESOLVED",
]);
const analysisSchema = analysisResultSchema;

export const coordinatesSchema = z
  .object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
  })
  .strict();

export const videoSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    size: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024),
    type: z.enum(["video/mp4", "video/webm", "video/quicktime"]),
    duration: z.number().finite().min(5).max(10),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

export const createReportSchema = z
  .object({
    analysis: analysisSchema.refine(
      (analysis) => ["LOW", "MEDIUM", "HIGH"].includes(analysis.leakRisk),
      "Only actionable analysis results can be reported.",
    ),
    location: coordinatesSchema,
    locationLabel: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1_000),
    video: videoSchema,
  })
  .strict();

export const reportSchema = z
  .object({
    id: z.string().trim().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    status: statusSchema,
    analysis: analysisSchema,
    location: coordinatesSchema,
    locationLabel: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1_000),
    video: videoSchema.nullable(),
    isDemo: z.boolean(),
    evidenceId: z.string().trim().min(1).nullable(),
  })
  .strict()
  .superRefine((report, context) => {
    if (report.isDemo && report.analysis.provider !== "demo") {
      context.addIssue({
        code: "custom",
        message: "Demo reports must use demo analysis.",
      });
    }
    if (
      !report.isDemo &&
      (report.video === null || report.evidenceId === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Citizen reports require video evidence metadata.",
      });
    }
  });

export const realCreateReportSchema = createReportSchema
  .refine(
    (input) => input.analysis.provider === "openai",
    "Demo reports cannot be submitted remotely.",
  )
  .refine(({ analysis }) => {
    const yes = [
      analysis.activeFlow === "YES",
      analysis.persistentSource === true,
      analysis.spreadingDetected === true,
    ].filter(Boolean).length;
    const expected =
      analysis.waterEvidence === "STRONG" && yes === 3
        ? "HIGH"
        : yes > 0
          ? "MEDIUM"
          : "LOW";
    return (
      analysis.leakRisk === expected &&
      !(
        analysis.persistentSource === null &&
        analysis.spreadingDetected === null
      )
    );
  }, "Risk must agree with the validated categorical evidence.");
