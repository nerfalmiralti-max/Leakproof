import { signEvidence } from "@/lib/reports/server";
import { requireDispatcher, reportEndpoint } from "@/lib/reports/server-errors";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return reportEndpoint(async () => {
    requireDispatcher(request);
    return signEvidence((await context.params).id);
  });
}
