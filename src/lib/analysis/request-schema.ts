import { z } from "zod";
import { validateVideoMetadata } from "@/lib/video";

export const analysisRequestSchema = z
  .object({
    video: z
      .object({
        name: z.string().min(1).max(255),
        type: z.enum(["video/mp4", "video/webm", "video/quicktime"]),
        size: z
          .number()
          .int()
          .positive()
          .max(50 * 1024 * 1024),
        duration: z.number().min(5).max(10),
        width: z.number().int().positive().max(16384),
        height: z.number().int().positive().max(16384),
      })
      .strict(),
    frames: z
      .array(
        z
          .object({
            time: z.number().min(0).max(10),
            image: z
              .string()
              .max(350_000)
              .regex(/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/),
          })
          .strict(),
      )
      .length(6),
  })
  .strict()
  .superRefine((input, context) => {
    if (validateVideoMetadata(input.video))
      context.addIssue({ code: "custom", message: "Invalid video metadata." });
    input.frames.forEach((frame, index) => {
      const expected = 0.1 + ((input.video.duration - 0.2) * index) / 5;
      if (Math.abs(frame.time - expected) > 0.05)
        context.addIssue({
          code: "custom",
          message: "Frames must cover the video in chronological order.",
        });
    });
  });
