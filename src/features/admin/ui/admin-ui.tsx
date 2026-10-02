import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DocumentTitle } from "@/components/document-title";

/** The admin page frame: same width, gutters, and type scale as Reports and Interviews. */
export function AdminPage({
  title,
  description,
  actions,
  children
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="admin-page mx-auto flex min-h-screen w-full max-w-[84rem] flex-col px-4 pb-20 pt-6 text-cream sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
      <DocumentTitle title={`${title} · Admin`} />
      <header className="flex flex-col gap-5 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.02em] text-cream sm:text-[2rem]">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-cream/55">{description}</p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

/** Time-window switcher. Each option is a link, so the window lives in the URL. */
export function RangeTabs({
  options,
  current,
  href
}: {
  options: ReadonlyArray<{ value: number; label: string }>;
  current: number;
  href: (value: number) => string;
}) {
  return (
    <nav aria-label="Time window" className="admin-tabs inline-flex rounded-xl p-1">
      {options.map((option) => (
        <Link
          key={option.value}
          href={href(option.value)}
          aria-current={option.value === current ? "page" : undefined}
          className="admin-tab rounded-lg px-3 py-1.5 text-[13px] font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminCard({
  title,
  description,
  aside,
  children,
  className = ""
}: {
  title?: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-[#17181b] p-5 sm:p-6 ${className}`}>
      {title ? (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-cream">{title}</h2>
            {description ? (
              <p className="mt-1 text-[13px] leading-5 text-cream/50">{description}</p>
            ) : null}
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** A headline number. The icon sits in an outlined tile, as everywhere else. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-2xl bg-[#17181b] p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-cream/55">{label}</p>
        {Icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.1] text-[var(--workspace-accent)]">
            <Icon size={17} strokeWidth={1.5} aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-cream">
        {value}
      </p>
      {hint ? <p className="mt-2.5 text-[13px] leading-5 text-cream/45">{hint}</p> : null}
    </div>
  );
}

export function StatGrid({ children, columns = 4 }: { children: ReactNode; columns?: 3 | 4 | 6 }) {
  const grid =
    columns === 6
      ? "sm:grid-cols-3 xl:grid-cols-6"
      : columns === 3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-2 xl:grid-cols-4";
  return <div className={`grid gap-3 ${grid}`}>{children}</div>;
}

/** Labelled horizontal bars for a ranked breakdown (roles, rounds, statuses). */
export function BarList({
  items,
  format = formatNumber,
  empty = "Nothing yet."
}: {
  items: Array<{ label: string; value: number; hint?: string }>;
  format?: (value: number) => string;
  empty?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (!items.length) return <EmptyNote>{empty}</EmptyNote>;
  return (
    <ul className="space-y-3.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="truncate text-cream/72">{item.label}</span>
            <span className="shrink-0 font-medium tabular-nums text-cream">
              {format(item.value)}
              {item.hint ? <span className="ml-1.5 font-normal text-cream/42">{item.hint}</span> : null}
            </span>
          </div>
          <div className="admin-bar-track mt-1.5 h-1.5 overflow-hidden rounded-full">
            <span
              className="block h-full rounded-full bg-[var(--workspace-accent)]"
              style={{ width: `${Math.max(item.value > 0 ? 2 : 0, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Each step shows its share of the first step and the drop from the step before. */
export function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const first = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1]!.value : null;
        const share = step.value / first;
        return (
          <li key={step.label} className="grid gap-x-5 gap-y-1.5 sm:grid-cols-[13rem_minmax(0,1fr)_7.5rem] sm:items-center">
            <span className="text-[14px] text-cream/72">{step.label}</span>
            <div className="admin-bar-track h-6 overflow-hidden rounded-md">
              <span
                className="block h-full rounded-md bg-[var(--workspace-accent)]"
                style={{ width: `${Math.max(step.value > 0 ? 1 : 0, share * 100)}%`, opacity: 1 - index * 0.1 }}
              />
            </div>
            <span className="text-[14px] tabular-nums text-cream sm:text-right">
              <span className="font-medium">{formatNumber(step.value)}</span>
              <span className="ml-1.5 text-cream/45">
                {previous === null ? "100%" : previous ? formatPercent(step.value / previous) : "—"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function PersonAvatar({
  name,
  imageUrl,
  size = "h-9 w-9"
}: {
  name: string;
  imageUrl: string | null;
  size?: string;
}) {
  if (imageUrl) {
    // Clerk-hosted avatars; a plain img avoids adding Clerk's host to next/image.
    return <img src={imageUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full border border-white/[0.1] text-[13px] font-medium text-cream/72`}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[14px] text-cream/45">{children}</p>;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDay(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  });
}

/** "3 days ago" for anything older than today; dates are UTC days. */
export function formatRelativeDay(value: string | null, now = new Date()): string {
  if (!value) return "Never";
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((today - Date.parse(`${value.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDay(value);
}

/** Role and track keys as people say them. */
export function readableLabel(value: string | null | undefined): string {
  if (!value || value === "Not set") return "Not set";
  const known: Record<string, string> = {
    "ai-ml": "AI/ML",
    backend: "Backend",
    frontend: "Frontend",
    fullstack: "Full stack",
    data: "Data",
    pm: "Product",
    fresher: "Fresher",
    "0-2": "0–2 years",
    "3-5": "3–5 years",
    "5-plus": "5+ years"
  };
  if (known[value]) return known[value];
  const words = value.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
