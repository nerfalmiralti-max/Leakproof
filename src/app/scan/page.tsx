import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ScanFlow } from "@/components/scan/scan-flow";
import { getAnalysisMode } from "@/lib/analysis/config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Check a possible leak" };
export default function ScanPage() {
  return (
    <>
      <SiteHeader active="scan" />
      <main id="main" className="min-h-[calc(100vh-200px)]">
        <ScanFlow mode={getAnalysisMode()} />
      </main>
      <SiteFooter />
    </>
  );
}
