import { AlertCircle } from "lucide-react";
export function ErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm leading-relaxed text-red-800"
    >
      <AlertCircle size={17} className="mt-0.5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-display text-base font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        {description}
      </p>
    </div>
  );
}
