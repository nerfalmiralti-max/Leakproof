import Link from "next/link";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="LeakProof home"
      className={`inline-flex shrink-0 items-center gap-2.5 ${light ? "text-white" : "text-ink"}`}
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-xl ${light ? "bg-lime text-ink" : "bg-green text-lime"}`}
      >
        <svg
          width="24"
          height="26"
          viewBox="0 0 32 36"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M16 2C12 9 3 18 3 24a13 13 0 0 0 26 0C29 18 20 9 16 2Z"
            stroke="currentColor"
            strokeWidth="2.3"
          />
          <path
            d="m10 23 4 4 8-9"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="font-display text-[21px] font-extrabold tracking-[-.8px]">
        LeakProof<span className="ml-0.5 text-green">.</span>
      </span>
    </Link>
  );
}
