import { prepareReportUpload } from "@/lib/reports/server";
import { readReportJson, reportEndpoint } from "@/lib/reports/server-errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return reportEndpoint(async () =>
    prepareReportUpload(await readReportJson(request)),
  );
}
