import { MapPin } from "lucide-react";
import { Brand } from "./brand";
export function SiteFooter() {
  return (
    <footer className="border-t border-line py-7">
      <div className="page-width flex flex-col items-start justify-between gap-5 text-xs text-muted sm:flex-row sm:items-center">
        <Brand />
        <p>Built for the water we share.</p>
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={13} /> Aktau, Kazakhstan{" "}
          <span className="ml-3 rounded border border-line px-2 py-1 text-[10px]">
            ECO HACKATHON · DEMO
          </span>
        </span>
      </div>
    </footer>
  );
}
