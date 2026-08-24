import { Check, Save, Target } from "lucide-react";
import type { ReactNode } from "react";
import { statTones } from "./candidate-profile-editor-data";

/* ------------------------------------------------------------------ parts */

export function Card({
  icon: Icon,
  title,
  subtitle,
  action,
  tone = "cream",
  size = "default",
  children
}: {
  icon: typeof Target;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  tone?: keyof typeof statTones;
  size?: "default" | "large";
  children: ReactNode;
}) {
  const large = size === "large";

  return (
    <section className="surface overflow-hidden p-0">
      <div
        className={[
          "flex flex-wrap items-start gap-3.5",
          large ? "px-6 pt-6 sm:px-7 sm:pt-7" : "px-5 pt-5 sm:px-6 sm:pt-6"
        ].join(" ")}
      >
        <span
          className={[
            "grid shrink-0 place-items-center",
            large ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-xl",
            statTones[tone]
          ].join(" ")}
        >
          <Icon size={large ? 19 : 17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className={[
              "font-semibold tracking-tight text-cream",
              large ? "text-xl sm:text-2xl" : "text-[15px]"
            ].join(" ")}
          >
            {title}
          </h2>
          {subtitle ? (
            <p
              className={[
                "mt-1 max-w-xl text-cream/40",
                large ? "text-sm leading-6" : "text-xs leading-5"
              ].join(" ")}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div
        className={[
          large ? "px-6 pb-6 pt-6 sm:px-7 sm:pb-7" : "px-5 pb-5 pt-5 sm:px-6 sm:pb-6"
        ].join(" ")}
      >
        {children}
      </div>
    </section>
  );
}

export function Tag({ children, size = "md" }: { children: ReactNode; size?: "sm" | "md" }) {
  return (
    <span
      className={[
        "rounded-full bg-white/[0.065] text-cream/68 shadow-soft-inset",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action
}: {
  icon: typeof Target;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-white/[0.035] px-5 py-8 text-center shadow-soft-inset">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[0.06] text-cream/55 shadow-soft-inset">
        <Icon size={17} />
      </span>
      <p className="mt-3.5 text-sm font-semibold text-cream/85">{title}</p>
      <p className="mt-1.5 max-w-sm text-xs leading-5 text-cream/40">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function SaveBar({
  saving,
  error,
  onSave
}: {
  saving: boolean;
  error: string | null;
  onSave: () => void;
}) {
  return (
    // Sticky rather than fixed: the workspace offsets content for its sidebar,
    // and a viewport-fixed bar would sit under it on desktop.
    <div className="sticky bottom-4 z-30 mt-8">
      <div className="profile-glass flex flex-col gap-3 rounded-3xl border border-white/[0.08] p-4 sm:flex-row sm:items-center">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#efcf84]/12 text-[#f4dda6] shadow-soft-inset">
          <Save size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-cream">Unsaved changes</p>
          {error ? (
            <p role="alert" className="mt-0.5 text-xs text-[#ffc2c2]">
              {error}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-cream/38">
              Trailgrad uses this from your next round onward.
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cream px-6 text-sm font-semibold text-blueprint transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blueprint/25 border-t-blueprint" />
          ) : (
            <Save size={15} />
          )}
          {saving ? "Saving" : "Save memory"}
        </button>
      </div>
    </div>
  );
}

export function SavedFooter() {
  return (
    <div className="mt-8 flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#71d6a5]/12 text-[#9be8c1] shadow-soft-inset">
        <Check size={15} />
      </span>
      <p className="text-xs text-cream/40">
        Interview memory is up to date. Only you can see this information.
      </p>
    </div>
  );
}
