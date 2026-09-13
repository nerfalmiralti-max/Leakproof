import { updateReportStatus } from "@/lib/reports/server";
import {
  requireDispatcher,
  readReportJson,
  reportEndpoint,
} from "@/lib/reports/server-errors";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return reportEndpoint(async () => {
    requireDispatcher(request);
    return {
      report: await updateReportStatus(
        (await context.params).id,
        await readReportJson(request),
      ),
    };
  });
}
