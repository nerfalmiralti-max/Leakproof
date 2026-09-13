import { analysisRequestSchema } from "@/lib/analysis/request-schema";
import { getAnalysisMode } from "@/lib/analysis/config";
import {
  analyseFramesOnServer,
  AnalysisServiceError,
} from "@/lib/analysis/openai-server";
import { uncertainResult } from "@/lib/analysis/scoring";

export const runtime = "nodejs";
export const maxDuration = 40;
const MAX_BODY = 2_200_000;

async function readLimitedJson(request: Request): Promise<unknown> {
  if (!request.body)
    throw new AnalysisServiceError(
      "invalid_input",
      "No video frames were supplied.",
      400,
    );
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new AnalysisServiceError(
          "too_large",
          "The video frames are too large. Try a smaller recording.",
          413,
        );
      }
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof AnalysisServiceError) throw error;
    throw new AnalysisServiceError(
      "invalid_input",
      "The video frame request is invalid.",
      400,
    );
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const headers = { "Cache-Control": "no-store", "X-Request-Id": requestId };
  try {
    const origin = request.headers.get("origin");
    // Next may construct request.url with its internal hostname behind a proxy.
    // Compare the browser origin with the actual public HTTP Host instead.
    if (
      origin &&
      new URL(origin).host !==
        (request.headers.get("host") ?? new URL(request.url).host)
    )
      throw new AnalysisServiceError(
        "invalid_origin",
        "Analysis must be started from LeakProof.",
        403,
      );
    if (getAnalysisMode() !== "openai")
      throw new AnalysisServiceError(
        "disabled",
        "Real analysis is disabled. Select a labelled demo scenario in the scan page.",
        503,
      );
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new AnalysisServiceError(
        "invalid_input",
        "Expected video frames in JSON format.",
        415,
      );
    if (Number(request.headers.get("content-length")) > MAX_BODY)
      throw new AnalysisServiceError(
        "too_large",
        "The video frames are too large.",
        413,
      );
    const parsed = analysisRequestSchema.safeParse(
      await readLimitedJson(request),
    );
    if (!parsed.success)
      throw new AnalysisServiceError(
        "invalid_input",
        "The recording or extracted frames are invalid. Choose another video.",
        400,
      );
    // Reject non-JPEG payloads before an external call. The provider still validates image decoding.
    for (const frame of parsed.data.frames) {
      const bytes = Buffer.from(
        frame.image.slice("data:image/jpeg;base64,".length),
        "base64",
      );
      if (
        bytes.length < 100 ||
        bytes[bytes.length - 2] !== 0xff ||
        bytes[bytes.length - 1] !== 0xd9
      )
        throw new AnalysisServiceError(
          "invalid_input",
          "An extracted image could not be read. Choose another video.",
          400,
        );
    }
    const result =
      Math.min(parsed.data.video.width, parsed.data.video.height) < 320
        ? uncertainResult()
        : await analyseFramesOnServer(parsed.data.frames, request.signal);
    return Response.json({ result }, { headers });
  } catch (error) {
    const failure =
      error instanceof AnalysisServiceError
        ? error
        : new AnalysisServiceError(
            "configuration",
            "Analysis is unavailable. Check the server configuration.",
            503,
          );
    console.error("LeakProof analysis failed", {
      requestId,
      code: failure.code,
    });
    return Response.json(
      { error: failure.message, code: failure.code },
      { status: failure.status, headers },
    );
  }
}
