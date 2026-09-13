import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export class ReportServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireDispatcher(request: Request) {
  const expected = process.env.DISPATCHER_ACCESS_KEY;
  const supplied = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (
    !expected ||
    !supplied ||
    !timingSafeEqual(
      createHash("sha256").update(expected).digest(),
      createHash("sha256").update(supplied).digest(),
    )
  ) {
    throw new ReportServiceError(
      401,
      "Unlock the dispatcher workspace with a valid access key.",
    );
  }
}
export async function readReportJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ReportServiceError(415, "Expected report metadata as JSON.");
  if (Number(request.headers.get("content-length")) > 32_768)
    throw new ReportServiceError(413, "Report metadata is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new ReportServiceError(400, "Report metadata is missing.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 32_768) {
        await reader.cancel();
        throw new ReportServiceError(413, "Report metadata is too large.");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}
export async function reportEndpoint(
  action: () => Promise<unknown>,
  status = 200,
) {
  const headers = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  };
  try {
    return Response.json(await action(), { status, headers });
  } catch (error) {
    const known = error instanceof ReportServiceError;
    const invalid = error instanceof z.ZodError || error instanceof SyntaxError;
    return Response.json(
      {
        error: known
          ? error.message
          : invalid
            ? "Invalid report data."
            : "Report service unavailable. Please try again.",
      },
      {
        status: known ? error.status : invalid ? 400 : 502,
        headers,
      },
    );
  }
}
