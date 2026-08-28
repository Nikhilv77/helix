"use client";

import { SignOutButton, useReverification, useUser } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  type LucideIcon
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ProfileAvatar } from "@/components/workspace/profile/profile-avatar";
import { ALL_PERSONAS, MAYA, personaById, type InterviewerPersona } from "@/lib/avatars/personas";
import {
  ApiClientError,
  deleteAccount,
  saveNotificationPreferences,
  saveWorkspaceAccent,
  saveWorkspaceTeacher
} from "@/lib/api/api-client";
import type { CandidateProfile } from "@/lib/shared/types";
import { useMayaVoice } from "@/lib/voice/use-maya-voice";
import { type WorkspaceAccent, WORKSPACE_ACCENT_CHANGE_EVENT } from "@/lib/workspace/accent";

const MANAGE_ORIGIN_KEY = "trailgrad:manage-origin";

const AvatarStage = dynamic(
  () => import("@/components/interview/voice/avatar-stage").then((module) => module.AvatarStage),
  { ssr: false, loading: () => null }
);

const accentOptions: Array<{
  value: WorkspaceAccent;
  label: string;
  color: string;
  dots: [string, string, string];
}> = [
  { value: "ember", label: "Ember", color: "#f26e01", dots: ["#f26e01", "#ff8b3d", "#efcf84"] },
  { value: "azure", label: "Azure", color: "#4f8cff", dots: ["#4f8cff", "#78a7ff", "#9b6dff"] },
  { value: "violet", label: "Violet", color: "#9b6dff", dots: ["#8153e6", "#9b6dff", "#d268c4"] },
  { value: "emerald", label: "Emerald", color: "#39d9a1", dots: ["#20b983", "#39d9a1", "#8be6bd"] },
  { value: "rose", label: "Rose", color: "#f0528a", dots: ["#d93b6d", "#f0528a", "#ff7a5b"] },
  { value: "mono", label: "Mono", color: "#d3d0c7", dots: ["#85837e", "#b2afa8", "#d3d0c7"] }
];

export function ManageAccount({ profile }: { profile: CandidateProfile }) {
  const { user } = useUser();
  const avatarRef = useRef<HTMLDivElement>(null);
  const [avatarDelta, setAvatarDelta] = useState({ x: -190, y: 310 });
  const [deleting, setDeleting] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [accent, setAccent] = useState<WorkspaceAccent>(profile.workspaceAccent);
  const [savingAccent, setSavingAccent] = useState<WorkspaceAccent | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState({
    teacherNotificationsEnabled: profile.teacherNotificationsEnabled,
    helpNotificationsEnabled: profile.helpNotificationsEnabled
  });
  const [savingPreference, setSavingPreference] = useState<
    "teacherNotificationsEnabled" | "helpNotificationsEnabled" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const name =
    profile.resume?.fullName?.trim() ||
    user?.fullName ||
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Your account";
  const avatarImage = profile.profileImage || user?.imageUrl || null;
  const deleteAccountWithReverification = useReverification(deleteAccount);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const target = avatarRef.current?.getBoundingClientRect();
      if (!target) return;

      const stored = window.sessionStorage.getItem(MANAGE_ORIGIN_KEY);
      window.sessionStorage.removeItem(MANAGE_ORIGIN_KEY);
      const origin = stored ? parseOrigin(stored) : null;
      const fallback = window.innerWidth < 768 ? { x: window.innerWidth - 36, y: 32 } : null;
      const from = origin ?? fallback;
      if (!from) return;

      setAvatarDelta({
        x: Math.round(from.x - (target.left + target.width / 2)),
        y: Math.round(from.y - (target.top + target.height / 2))
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const onDelete = async () => {
    if (deleting) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteAccountWithReverification();
      window.location.replace("/");
    } catch (caught) {
      setDeleting(false);
      setShowDeleteWarning(false);

      if (isReverificationCancelledError(caught)) {
        return;
      }

      setError(caught instanceof ApiClientError ? caught.message : "Could not delete account.");
    }
  };

  const onAccentChange = async (nextAccent: WorkspaceAccent) => {
    if (nextAccent === accent || savingAccent) return;

    const previousAccent = accent;
    setAccent(nextAccent);
    setSavingAccent(nextAccent);
    setError(null);
    window.dispatchEvent(new CustomEvent(WORKSPACE_ACCENT_CHANGE_EVENT, { detail: nextAccent }));

    try {
      await saveWorkspaceAccent(nextAccent);
    } catch (caught) {
      setAccent(previousAccent);
      window.dispatchEvent(
        new CustomEvent(WORKSPACE_ACCENT_CHANGE_EVENT, { detail: previousAccent })
      );
      setError(caught instanceof ApiClientError ? caught.message : "Could not save your theme.");
    } finally {
      setSavingAccent(null);
    }
  };

  const onNotificationPreferenceChange = async (
    key: "teacherNotificationsEnabled" | "helpNotificationsEnabled"
  ) => {
    if (savingPreference) return;
    const previous = notificationPreferences[key];
    const next = !previous;
    setNotificationPreferences((current) => ({ ...current, [key]: next }));
    setSavingPreference(key);
    setError(null);

    try {
      await saveNotificationPreferences({ [key]: next });
    } catch (caught) {
      setNotificationPreferences((current) => ({ ...current, [key]: previous }));
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Could not save your notification settings."
      );
    } finally {
      setSavingPreference(null);
    }
  };

  return (
    <section className="profile-theme relative mx-auto flex min-h-screen w-full max-w-[84rem] flex-col px-4 pb-20 pt-6 text-cream sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-4xl flex-col items-center justify-center py-10 text-center">
        <div
          ref={avatarRef}
          className="manage-avatar-arrive relative grid h-28 w-28 place-items-center rounded-full bg-cream p-1 shadow-[0_24px_80px_rgba(4,12,42,0.32)] sm:h-32 sm:w-32"
          style={
            {
              "--avatar-from-x": `${avatarDelta.x}px`,
              "--avatar-from-y": `${avatarDelta.y}px`
            } as CSSProperties
          }
        >
          <span
            aria-hidden
            className="manage-avatar-pulse absolute -inset-4 rounded-full border border-cream/20"
          />
          {avatarImage ? (
            <img
              src={avatarImage}
              alt={`${name} profile avatar`}
              className="relative h-full w-full rounded-full object-cover object-center"
            />
          ) : (
            <ProfileAvatar
              name={name}
              className="relative h-full w-full rounded-full object-cover object-center"
            />
          )}
        </div>

        <div className="mt-8 flex w-full flex-col">
          <p className="blueprint-label manage-sequence-line text-cream/42">Manage account</p>
          <h1 className="mt-4 text-[clamp(2.45rem,7vw,5rem)] font-semibold leading-[0.98] tracking-tight text-cream">
            <AnimatedWords text="So far, so good." delay={680} />
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-[clamp(1.1rem,2.4vw,1.55rem)] font-medium leading-8 text-cream/78">
            <AnimatedWords text="Hope you are enjoying Trailgrad." delay={1280} copy />
          </p>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-cream/62 sm:text-lg sm:leading-8">
            <AnimatedWords
              text="Keep your session simple, or permanently remove your account when you are sure."
              delay={2020}
              copy
            />
          </p>

          <section
            className="manage-action-line report-glass-card order-4 mx-auto mt-4 w-full max-w-6xl rounded-[1.5rem] p-5 text-left sm:p-6"
            style={{ "--line-delay": "3200ms" } as CSSProperties}
          >
            <h2 className="text-base font-semibold text-cream">Account actions</h2>
            <div className="mt-2 divide-y divide-white/[0.07]">
              <AccountActionRow
                icon={LogOut}
                title="Log out"
                description="End your current session on this device."
                accent
                action={
                  <SignOutButton redirectUrl="/">
                    <button
                      type="button"
                      className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-cream px-4 text-sm font-semibold text-[#171a16] transition hover:bg-white sm:w-auto sm:min-w-32"
                    >
                      Log out
                    </button>
                  </SignOutButton>
                }
              />
              <AccountActionRow
                icon={Trash2}
                title="Delete account"
                description="Permanently delete your account and all data."
                destructive
                action={
                  <button
                    type="button"
                    onClick={() => setShowDeleteWarning(true)}
                    className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-red-400/30 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-400/[0.08] sm:w-auto sm:min-w-32"
                  >
                    Delete account
                  </button>
                }
              />
            </div>
          </section>

          <ManageTeacherPicker
            initialTeacherId={profile.teacherId}
            onError={(message) => setError(message)}
          />

          <section
            className="manage-action-line report-glass-card order-2 mx-auto mt-4 w-full max-w-6xl rounded-[1.5rem] p-5 text-left sm:mt-4 sm:p-6"
            style={{ "--line-delay": "3340ms" } as CSSProperties}
          >
            <div>
              <h2 className="text-base font-semibold text-cream">Theme</h2>
              <p className="mt-1 text-sm leading-6 text-cream/52">
                Choose an accent color for your Trailgrad experience.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {accentOptions.map((option) => (
                <AccentThemeCard
                  key={option.value}
                  option={option}
                  selected={accent === option.value}
                  saving={savingAccent === option.value}
                  onSelect={() => void onAccentChange(option.value)}
                />
              ))}
            </div>
          </section>

          <section
            id="notifications"
            className="manage-action-line report-glass-card order-3 mx-auto mt-4 w-full max-w-6xl scroll-mt-24 rounded-[1.5rem] p-5 text-left sm:p-6"
            style={{ "--line-delay": "3420ms" } as CSSProperties}
          >
            <div>
              <h2 className="text-base font-semibold text-cream">Notifications</h2>
              <p className="mt-1 text-sm leading-6 text-cream/52">
                Choose which optional updates should reach your inbox. Your onboarding welcome and
                updates about requests you opened remain available.
              </p>
            </div>

            <div className="mt-4 divide-y divide-white/[0.07]">
              <NotificationPreferenceRow
                icon={Bell}
                title="Teacher coaching"
                description="One daily practice recommendation, with a second nudge only when unfinished work is waiting."
                enabled={notificationPreferences.teacherNotificationsEnabled}
                saving={savingPreference === "teacherNotificationsEnabled"}
                onToggle={() => void onNotificationPreferenceChange("teacherNotificationsEnabled")}
              />
              <NotificationPreferenceRow
                icon={Users}
                title="Peer help requests"
                description="Let learners ask for your help on questions you have already completed."
                enabled={notificationPreferences.helpNotificationsEnabled}
                saving={savingPreference === "helpNotificationsEnabled"}
                onToggle={() => void onNotificationPreferenceChange("helpNotificationsEnabled")}
              />
            </div>
          </section>

          {error ? (
            <p className="manage-action-line order-5 mx-auto mt-5 max-w-xl text-[0.9rem] leading-6 text-cream/72">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {showDeleteWarning ? (
        <DeleteAccountWarningModal
          deleting={deleting}
          onCancel={() => setShowDeleteWarning(false)}
          onConfirm={onDelete}
        />
      ) : null}
    </section>
  );
}

function ManageTeacherPicker({
  initialTeacherId,
  onError
}: {
  initialTeacherId: string | null;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const initialTeacher = personaById(initialTeacherId) ?? MAYA;
  const [index, setIndex] = useState(() => {
    const initialIndex = ALL_PERSONAS.findIndex((persona) => persona.id === initialTeacher.id);
    return initialIndex < 0 ? 0 : initialIndex;
  });
  const [savedTeacherId, setSavedTeacherId] = useState(initialTeacher.id);
  const [saving, setSaving] = useState(false);
  const { state, speak, stop } = useMayaVoice();

  const focused = ALL_PERSONAS[index] ?? MAYA;
  const previous = ALL_PERSONAS[(index - 1 + ALL_PERSONAS.length) % ALL_PERSONAS.length] ?? MAYA;
  const next = ALL_PERSONAS[(index + 1) % ALL_PERSONAS.length] ?? MAYA;
  const speaking = state === "loading" || state === "speaking";
  const selected = focused.id === savedTeacherId;

  const move = (direction: -1 | 1) => {
    stop();
    setIndex((current) => (current + direction + ALL_PERSONAS.length) % ALL_PERSONAS.length);
  };

  const saveTeacher = async () => {
    if (saving || selected) return;
    setSaving(true);
    onError(null);

    try {
      const saved = await saveWorkspaceTeacher(focused.id);
      setSavedTeacherId(saved.teacherId);
      router.refresh();
    } catch (caught) {
      onError(caught instanceof ApiClientError ? caught.message : "Could not save your teacher.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="manage-action-line report-glass-card order-1 mx-auto mt-10 w-full max-w-6xl rounded-[1.5rem] p-5 text-left sm:p-6"
      style={{ "--line-delay": "3280ms" } as CSSProperties}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <h2 className="text-base font-semibold text-cream">Your teacher</h2>
          <p className="mt-1 text-sm leading-6 text-cream/52">
            Choose who guides your practice and runs your interviews.
          </p>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/36">
          {savedTeacherId === focused.id ? `${focused.name} is with you` : "Previewing a change"}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="Previous teacher"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.045] text-cream/62 transition hover:bg-white/[0.09] hover:text-cream"
        >
          <ChevronLeft size={18} />
        </button>

        <TeacherSidePreview persona={previous} onClick={() => move(-1)} />

        <div className="w-full max-w-[17rem] text-center sm:max-w-[19rem]">
          <div className="relative mx-auto h-56 w-full overflow-hidden rounded-[1.35rem] bg-[#121316] shadow-[0_24px_60px_-42px_rgba(0,0,0,0.9)] sm:h-64">
            <AvatarStage
              agentTrack={null}
              state={speaking ? "speaking" : "listening"}
              url={focused.model}
              rig={focused.rig}
              framing="default"
              performanceProfile="preview"
              showStatus={false}
              feather={false}
              introducing={state === "speaking"}
            />

            <button
              type="button"
              onClick={() => (speaking ? stop() : void speak(focused.greeting, focused.id))}
              aria-label={speaking ? `Stop ${focused.name}` : `Hear ${focused.name}`}
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/38 text-cream/72 backdrop-blur-lg transition hover:bg-black/58 hover:text-cream"
            >
              {state === "loading" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : state === "unavailable" ? (
                <VolumeX size={15} />
              ) : (
                <Volume2 size={15} />
              )}
            </button>

            {selected ? (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--workspace-accent)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#111214]">
                <Check size={11} strokeWidth={2.6} /> Current
              </span>
            ) : null}
          </div>

          <div key={focused.id} className="step-in mt-4">
            <h3 className="text-[1.55rem] font-semibold leading-none tracking-[-0.03em] text-cream">
              {focused.name}
            </h3>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
              {focused.tagline}
            </p>
            <p className="mx-auto mt-3 min-h-12 max-w-sm text-sm leading-6 text-cream/54">
              {focused.manner}
            </p>
          </div>
        </div>

        <TeacherSidePreview persona={next} onClick={() => move(1)} />

        <button
          type="button"
          onClick={() => move(1)}
          aria-label="Next teacher"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.045] text-cream/62 transition hover:bg-white/[0.09] hover:text-cream"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={() => void saveTeacher()}
          disabled={saving || selected}
          className="inline-flex h-10 min-w-40 items-center justify-center rounded-lg bg-cream px-5 text-sm font-medium text-[#171a16] transition hover:bg-white disabled:cursor-default disabled:bg-white/[0.07] disabled:text-cream/38"
        >
          {saving
            ? "Saving teacher…"
            : selected
              ? `${focused.name} is selected`
              : `Choose ${focused.name}`}
        </button>
      </div>
    </section>
  );
}

function TeacherSidePreview({
  persona,
  onClick
}: {
  persona: InterviewerPersona;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Preview ${persona.name}`}
      className="group hidden w-28 shrink-0 text-center opacity-48 transition duration-300 hover:-translate-y-0.5 hover:opacity-80 sm:block lg:w-32"
    >
      <span className="block h-36 overflow-hidden rounded-[1.1rem] bg-white/[0.025] lg:h-40">
        <AvatarStage
          agentTrack={null}
          state="listening"
          url={persona.model}
          rig={persona.rig}
          framing="default"
          performanceProfile="preview"
          showStatus={false}
          feather={false}
          active={false}
        />
      </span>
      <span className="mt-2 block text-xs font-medium text-cream/60 group-hover:text-cream/82">
        {persona.name}
      </span>
    </button>
  );
}

function AccountActionRow({
  icon: Icon,
  title,
  description,
  action,
  accent = false,
  destructive = false
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: ReactNode;
  accent?: boolean;
  destructive?: boolean;
}) {
  const tone = destructive
    ? "border border-red-400/20 bg-red-400/[0.05] text-red-300"
    : accent
      ? "border border-[var(--workspace-accent-border)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]"
      : "border border-white/[0.1] bg-white/[0.05] text-cream/70";

  return (
    <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tone}`}>
          <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-cream">{title}</h3>
          <p className="mt-1 text-sm text-cream/48">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function NotificationPreferenceRow({
  icon: Icon,
  title,
  description,
  enabled,
  saving,
  onToggle
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  enabled: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-4 py-4 first:pt-2 last:pb-1">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-cream/62">
        <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-cream/88">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-5 text-cream/48">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${enabled ? "Disable" : "Enable"} ${title}`}
        disabled={saving}
        onClick={onToggle}
        className="relative h-7 w-12 shrink-0 rounded-full border border-white/[0.1] bg-white/[0.07] outline-none transition disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
      >
        <span
          aria-hidden="true"
          className={`absolute top-1 h-5 w-5 rounded-full transition-[left,background-color] duration-200 ${
            enabled ? "left-6 bg-[var(--workspace-accent)]" : "left-1 bg-cream/40"
          }`}
        />
      </button>
    </div>
  );
}

function AccentThemeCard({
  option,
  selected,
  saving,
  onSelect
}: {
  option: (typeof accentOptions)[number];
  selected: boolean;
  saving: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={saving}
      aria-pressed={selected}
      style={{ "--card-accent": option.color } as CSSProperties}
      className={`
        group relative min-w-0 rounded-[16px] border p-2.5 text-left
        transition-all duration-200
        disabled:cursor-wait disabled:opacity-60
        ${
          selected
            ? "border-[var(--card-accent)] bg-[#1a1b1f] shadow-[0_0_0_1px_var(--card-accent)]"
            : "border-white/[0.1] bg-[#191a1d] hover:border-white/[0.18] hover:bg-[#1b1c20]"
        }
      `}
    >
      {/* preview */}
      <div className="relative aspect-[1.32/1] overflow-hidden rounded-[11px] border border-white/[0.07] bg-[#0d0e10]">
        <div className="flex h-full">
          {/* empty accent sidebar */}
          <div
            className="relative w-[28%] shrink-0 border-r border-white/[0.06]"
            style={{
              background: `
                radial-gradient(
                  circle at 35% 22%,
                  color-mix(in srgb, var(--card-accent) 22%, transparent),
                  transparent 46%
                ),
                linear-gradient(
                  180deg,
                  color-mix(in srgb, var(--card-accent) 8%, #0b0c0e),
                  #0b0c0e 58%
                )
              `
            }}
          >
            <div className="absolute inset-0 bg-black/10" />

            <div
              className="absolute bottom-0 left-0 top-0 w-[2px] opacity-70"
              style={{
                background:
                  "linear-gradient(to bottom, transparent, var(--card-accent), transparent)"
              }}
            />
          </div>

          {/* dashboard */}
          <div className="relative flex-1 px-[11%] py-[13%]">
            {/* top */}
            <div className="flex items-center justify-between">
              <div className="h-[5px] w-[42%] rounded-full bg-[#96928b]" />

              <div className="h-[8px] w-[8px] rounded-full border border-white/[0.1] bg-white/[0.03]" />
            </div>

            {/* subtle accent line */}
            <div className="mt-[11%] h-[2px] w-[24%] rounded-full bg-[var(--card-accent)] opacity-90" />

            {/* main content */}
            <div className="mt-[16%]">
              <div className="h-[4px] w-[70%] rounded-full bg-white/[0.18]" />
              <div className="mt-[10%] h-[4px] w-[52%] rounded-full bg-white/[0.09]" />
            </div>

            {/* bottom row */}
            <div className="absolute bottom-[14%] left-[11%] right-[11%] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-[6px] w-[6px] rounded-full bg-[var(--card-accent)]" />
                <span className="h-[3px] w-8 rounded-full bg-white/[0.1]" />
              </div>

              <span className="h-[4px] w-[28%] rounded-full bg-white/[0.07]" />
            </div>
          </div>
        </div>

        {/* subtle accent wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            background: "linear-gradient(135deg, var(--card-accent), transparent 48%)"
          }}
        />

        {selected ? (
          <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[var(--card-accent)] text-[#101113] shadow-[0_4px_14px_rgba(0,0,0,0.4)]">
            <Check size={15} strokeWidth={2.6} aria-hidden="true" />
          </span>
        ) : null}
      </div>

      {/* footer */}
      <div className="mt-3 flex min-w-0 items-center justify-between gap-3 px-0.5 pb-0.5">
        <span className="truncate text-[14px] font-medium tracking-[-0.01em] text-cream">
          {option.label}
        </span>

        <div className="flex shrink-0 items-center gap-1.5">
          {option.dots.map((color) => (
            <span
              key={color}
              className="h-2 w-2 rounded-full ring-1 ring-white/[0.08]"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </button>
  );
}
function AnimatedWords({
  text,
  delay,
  copy = false
}: {
  text: string;
  delay: number;
  copy?: boolean;
}) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={copy ? "onboarding-word manage-copy-word" : "onboarding-word"}
          style={{ "--word-delay": `${delay + index * 58}ms` } as CSSProperties}
        >
          {word}
          {index < words.length - 1 ? "\u00A0" : ""}
        </span>
      ))}
    </>
  );
}

function parseOrigin(value: string): { x: number; y: number } | null {
  try {
    const parsed = JSON.parse(value) as { x?: unknown; y?: unknown };
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

function DeleteAccountWarningModal({
  deleting,
  onCancel,
  onConfirm
}: {
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (typeof document === "undefined") return null;

  const close = () => {
    if (deleting) return;
    setVisible(false);
    window.setTimeout(onCancel, 180);
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center px-5">
      <button
        type="button"
        aria-label="Close delete account warning"
        className={`absolute inset-0 bg-[#050814]/48 backdrop-blur-md transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={close}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-warning-title"
        className={`relative w-full max-w-md rounded-2xl border border-cream/20 bg-[#151619] p-6 text-cream outline-none transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.97] opacity-0"
        }`}
      >
        <p
          id="delete-account-warning-title"
          className="text-center text-[1.55rem] font-medium leading-tight"
        >
          Delete account forever?
        </p>
        <p className="mx-auto mt-4 max-w-sm text-center text-[0.98rem] leading-7 text-cream/68">
          This removes your Trailgrad profile, progress, interviews, and Clerk account. You cannot
          undo this later.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={close}
            disabled={deleting}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-cream/20 bg-cream/[0.035] px-5 text-[0.95rem] font-medium text-cream/82 transition hover:bg-cream/[0.07] hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#ffe3d0] px-5 text-[0.95rem] font-medium text-[#251815] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.8} />
            {deleting ? "Deleting" : "Delete forever"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ManageBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden overflow-hidden text-cream xl:block"
    >
      <svg
        className="absolute left-0 top-20 h-32 w-52 opacity-[0.075] 2xl:left-5"
        viewBox="0 0 230 150"
        fill="none"
      >
        <rect x="18" y="24" width="160" height="68" rx="14" stroke="currentColor" />
        <circle cx="42" cy="48" r="5" fill="currentColor" fillOpacity="0.42" />
        <path d="M61 45h78M61 64h104" stroke="currentColor" strokeLinecap="round" />
        <path d="M28 116h178" stroke="currentColor" strokeLinecap="round" strokeDasharray="7 12" />
      </svg>

      <svg
        className="absolute left-8 top-[20rem] h-40 w-60 opacity-[0.06] 2xl:left-16"
        viewBox="0 0 260 180"
        fill="none"
      >
        <rect x="22" y="22" width="176" height="62" rx="15" stroke="currentColor" />
        <rect x="58" y="106" width="172" height="52" rx="13" stroke="currentColor" />
        <circle cx="48" cy="48" r="5" fill="currentColor" fillOpacity="0.42" />
        <circle cx="84" cy="130" r="5" fill="#9be8c1" fillOpacity="0.46" />
        <path d="M68 45h88M68 61h112M104 128h78M104 143h52" stroke="currentColor" />
        <path d="M198 53h28v78H230" stroke="currentColor" strokeDasharray="5 9" />
      </svg>

      <svg
        className="absolute left-0 top-[38rem] h-24 w-64 opacity-[0.052] 2xl:left-10"
        viewBox="0 0 300 120"
        fill="none"
      >
        <path d="M18 86h50m178 0h36" stroke="currentColor" strokeLinecap="round" />
        {Array.from({ length: 14 }, (_, item) => (
          <line
            key={item}
            x1={84 + item * 10}
            x2={84 + item * 10}
            y1={86 - ((item % 6) + 2) * 5}
            y2={86 + ((item % 6) + 2) * 5}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.2"
          />
        ))}
        <path d="M72 24h150M72 42h96M72 60h122" stroke="currentColor" strokeOpacity="0.72" />
        <rect x="50" y="8" width="190" height="64" rx="14" stroke="currentColor" />
      </svg>

      <svg
        className="absolute right-0 top-[6.5rem] h-36 w-60 opacity-[0.075] 2xl:right-8"
        viewBox="0 0 280 180"
        fill="none"
      >
        <path d="M18 92h24m196 0h24" stroke="currentColor" />
        {Array.from({ length: 12 }, (_, item) => (
          <line
            key={item}
            x1={52 + item * 15}
            x2={52 + item * 15}
            y1={92 - ((item % 5) + 2) * 7}
            y2={92 + ((item % 5) + 2) * 7}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.4"
          />
        ))}
        <circle cx="140" cy="92" r="74" stroke="currentColor" />
      </svg>

      <svg
        className="absolute right-5 top-[19rem] h-44 w-64 opacity-[0.06] 2xl:right-16"
        viewBox="0 0 300 200"
        fill="none"
      >
        <rect x="56" y="18" width="176" height="58" rx="14" stroke="currentColor" />
        <rect x="32" y="112" width="142" height="54" rx="14" stroke="currentColor" />
        <circle cx="82" cy="47" r="5" fill="#9be8c1" fillOpacity="0.5" />
        <circle cx="58" cy="138" r="5" fill="currentColor" fillOpacity="0.4" />
        <path d="M104 44h76M104 58h96M80 136h68M80 151h42" stroke="currentColor" />
        <path d="M146 76v36M146 94h92" stroke="currentColor" strokeDasharray="5 9" />
        <path d="M236 94l12-10M236 94l12 10" stroke="currentColor" strokeLinecap="round" />
      </svg>

      <svg
        className="absolute right-0 top-[36rem] h-32 w-64 opacity-[0.052] 2xl:right-12"
        viewBox="0 0 300 150"
        fill="none"
      >
        <path d="M72 32h156M72 52h104M72 72h132" stroke="currentColor" />
        <rect x="48" y="14" width="204" height="78" rx="16" stroke="currentColor" />
        <path
          d="M34 124 C 74 88, 108 88, 148 116 S 218 146, 266 92"
          stroke="#9be8c1"
          strokeOpacity="0.55"
          strokeDasharray="5 9"
        />
        <circle cx="148" cy="116" r="6" fill="currentColor" fillOpacity="0.35" />
        <circle cx="218" cy="122" r="6" fill="currentColor" fillOpacity="0.26" />
      </svg>

      <svg
        className="absolute left-20 top-[51rem] h-24 w-44 opacity-[0.05] 2xl:left-32"
        viewBox="0 0 180 120"
        fill="none"
      >
        {Array.from({ length: 18 }, (_, item) => (
          <circle
            key={item}
            cx={24 + (item % 6) * 24}
            cy={26 + Math.floor(item / 6) * 28}
            r="3"
            fill="currentColor"
            fillOpacity={item % 4 === 0 ? "0.48" : "0.24"}
          />
        ))}
        <path d="M28 96h124" stroke="currentColor" strokeDasharray="6 10" />
      </svg>

      <svg
        className="absolute right-16 top-[50rem] h-24 w-52 opacity-[0.05] 2xl:right-32"
        viewBox="0 0 210 110"
        fill="none"
      >
        <path d="M28 34h154M28 56h112M28 78h132" stroke="currentColor" />
        <path d="M16 20h178v76H16z" stroke="currentColor" />
        <path d="M54 20v76M118 20v76" stroke="currentColor" strokeOpacity="0.55" />
      </svg>

      <svg
        className="absolute left-2 top-[57rem] h-32 w-60 opacity-[0.05] 2xl:left-14"
        viewBox="0 0 270 150"
        fill="none"
      >
        <rect x="42" y="18" width="176" height="58" rx="14" stroke="currentColor" />
        <path d="M68 44h96M68 58h124" stroke="currentColor" />
        <path
          d="M30 120 C 70 82, 110 86, 146 110 S 214 144, 246 78"
          stroke="#9be8c1"
          strokeOpacity="0.48"
          strokeDasharray="5 9"
        />
        <circle cx="146" cy="110" r="6" fill="currentColor" fillOpacity="0.32" />
        <circle cx="214" cy="116" r="6" fill="currentColor" fillOpacity="0.24" />
      </svg>

      <svg
        className="absolute bottom-8 right-8 h-24 w-44 opacity-[0.06] 2xl:right-24"
        viewBox="0 0 180 120"
        fill="none"
      >
        <path d="M24 28h132v64H24z" stroke="currentColor" />
        <path d="M56 28v64M100 28v64M24 58h132" stroke="currentColor" strokeOpacity="0.58" />
        <circle cx="42" cy="44" r="5" fill="currentColor" fillOpacity="0.46" />
        <circle cx="80" cy="76" r="5" fill="#9be8c1" fillOpacity="0.52" />
        <circle cx="124" cy="44" r="5" fill="currentColor" fillOpacity="0.34" />
      </svg>
    </div>
  );
}
