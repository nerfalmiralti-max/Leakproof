import { listReports } from "@/lib/reports/server";
import { requireDispatcher, reportEndpoint } from "@/lib/reports/server-errors";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return reportEndpoint(async () => {
    requireDispatcher(request);
    return { reports: await listReports() };
  });
}
