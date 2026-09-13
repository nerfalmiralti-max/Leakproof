import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/dashboard";
export const metadata: Metadata = {
  title: "Dispatcher dashboard",
  robots: { index: false, follow: false },
};
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main
          id="main"
          className="grid min-h-screen place-items-center text-sm text-muted"
        >
          Loading dispatcher workspace…
        </main>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
