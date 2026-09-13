import Link from "next/link";
import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import { Brand } from "./brand";

export function SiteHeader({ active = "home" }: { active?: "home" | "scan" }) {
  return (
    <header className="border-b border-line bg-paper/95">
      <div className="page-width flex h-21 items-center justify-between gap-4">
        <Brand />
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-7 text-[13px] font-medium"
        >
          <Link
            href="/#how-it-works"
            className="hidden text-muted transition-colors hover:text-ink md:block"
          >
            How it works
          </Link>
          <Link href="/dashboard" className="flex items-center gap-2 text-ink">
            <LayoutDashboard size={15} className="md:hidden" />
            <span className="hidden sm:inline">Dispatcher dashboard</span>
            <span className="sm:hidden">Dashboard</span>
            <ArrowUpRight size={15} className="hidden sm:block" />
          </Link>
          {active === "home" && (
            <Link
              href="/scan"
              className="btn btn-primary hidden !min-h-10 !px-4 !py-2 sm:inline-flex"
            >
              Start a scan <ArrowUpRight size={16} />
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
