import { submitReport } from "@/lib/reports/server";
import { readReportJson, reportEndpoint } from "@/lib/reports/server-errors";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  return reportEndpoint(
    async () => ({ report: await submitReport(await readReportJson(request)) }),
    201,
  );
}
