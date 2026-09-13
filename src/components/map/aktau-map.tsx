"use client";
import dynamic from "next/dynamic";
import { Map } from "lucide-react";
import type { Coordinates, LeakReport } from "@/domain/report";
export type AktauMapProps = {
  reports?: LeakReport[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  pin?: Coordinates | null;
  onPin?: (point: Coordinates) => void;
  preview?: boolean;
};
const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-64 items-center justify-center gap-2 text-sm text-muted">
      <Map size={18} /> Loading Aktau map…
    </div>
  ),
});
export function AktauMap(props: AktauMapProps) {
  return <LeafletMap {...props} />;
}
