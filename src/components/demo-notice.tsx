import { FlaskConical } from "lucide-react";
export function DemoNotice({
  compact = false,
  mode = "demo",
}: {
  compact?: boolean;
  mode?: "demo" | "openai" | "workspace";
}) {
  const text =
    mode === "openai"
      ? "Visual analysis. Six sampled frames are sent to OpenAI when you run analysis. The full video and location are not sent. No automatic demo fallback."
      : mode === "workspace"
        ? "Unlock to view shared citizen reports. DEMO incidents use simulated analysis and stay on this device. No city service is automatically notified."
        : compact
          ? "Demo mode. Simulated analysis · reports stay in this browser."
          : "Demo mode. Analysis uses a selected scenario, not video pixels. Reports stay in this browser and are not sent to city services.";
  return (
    <div
      className={`flex gap-2.5 rounded-lg border border-[#dddcbf] bg-[#f7f6e9] text-[#686237] ${compact ? "px-3 py-2 text-xs" : "p-4 text-[13px] leading-relaxed"}`}
    >
      <FlaskConical size={16} className="mt-0.5 shrink-0" />
      <p>{text}</p>
    </div>
  );
}
