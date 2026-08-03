"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Blocks,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Code2,
  Database,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Lightbulb,
  PackageCheck,
  Pencil,
  Plus,
  Quote,
  Save,
  Sparkles,
  Target,
  Trash2,
  TriangleAlert,
  Upload
} from "lucide-react";
import { ApiClientError, saveProfile } from "@/lib/api-client";
import type {
  CandidateProfile,
  CandidateProfileInput,
  CandidateStory,
  Level,
  Role
} from "@/lib/types";

const roleOptions: Array<{ value: Role; label: string; detail: string; icon: typeof Code2 }> = [
  { value: "backend", label: "Backend", detail: "APIs, data, reliability", icon: Database },
  { value: "frontend", label: "Frontend", detail: "UI systems, state, performance", icon: Code2 },
  { value: "fullstack", label: "Full-stack", detail: "Product systems end to end", icon: Blocks },
  { value: "data", label: "Data", detail: "Pipelines, analytics, platforms", icon: BarChart3 },
  {
    value: "ai-ml",
    label: "AI / ML",
    detail: "Models, evaluation, production",
    icon: BrainCircuit
  },
  { value: "pm", label: "Product", detail: "Strategy, discovery, execution", icon: PackageCheck }
];

const levelOptions: Array<{ value: Level; label: string; detail: string }> = [
  { value: "fresher", label: "Fresher", detail: "Student or first role" },
  { value: "0-2", label: "0–2 years", detail: "Early career" },
  { value: "3-5", label: "3–5 years", detail: "Owns meaningful scope" },
  { value: "5-plus", label: "5+ years", detail: "Leads systems or teams" }
];

const focusOptions = [
  "Technical depth",
  "System design",
  "Coding",
  "Communication",
  "Ownership",
  "Impact",
  "Leadership",
  "Behavioral stories"
];

type TabId = "overview" | "target" | "signal" | "stories" | "resume";

const tabs: Array<{ id: TabId; label: string; icon: typeof Target }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "target", label: "Target", icon: Target },
  { id: "signal", label: "Signal", icon: Sparkles },
  { id: "stories", label: "Stories", icon: BriefcaseBusiness },
  { id: "resume", label: "Resume evidence", icon: BadgeCheck }
];

/** One input treatment for the page, so nothing drifts field to field. */
const fieldClass =
  "w-full rounded-xl border border-white/12 bg-[#0f2258]/55 text-cream outline-none transition placeholder:text-cream/25 hover:border-white/20 focus:border-cream/45 focus:bg-[#0f2258]/75 focus:ring-4 focus:ring-cream/[0.07]";

export function CandidateProfileEditor({ initialProfile }: { initialProfile: CandidateProfile }) {
  const [profile, setProfile] = useState<CandidateProfileInput>(toInput(initialProfile));
  const [saved, setSaved] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("overview");

  const baseline = useMemo(() => toInput(saved), [saved]);
  const changed = useMemo(
    () => ({
      target:
        profile.targetRole !== baseline.targetRole ||
        profile.level !== baseline.level ||
        profile.targetCompany !== baseline.targetCompany ||
        profile.targetDate !== baseline.targetDate,
      signal:
        profile.headline !== baseline.headline ||
        profile.context !== baseline.context ||
        JSON.stringify(profile.focusAreas) !== JSON.stringify(baseline.focusAreas),
      stories: JSON.stringify(profile.stories) !== JSON.stringify(baseline.stories)
    }),
    [baseline, profile]
  );
  const dirty = changed.target || changed.signal || changed.stories;
  const resume = saved.resume;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const next = await saveProfile(profile);
      setSaved(next);
      setProfile(toInput(next));
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Your interview profile could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  function update(patch: Partial<CandidateProfileInput>) {
    setProfile((current) => ({ ...current, ...patch }));
  }

  function toggleFocus(area: string) {
    setProfile((current) => ({
      ...current,
      focusAreas: current.focusAreas.includes(area)
        ? current.focusAreas.filter((item) => item !== area)
        : [...current.focusAreas, area].slice(0, 8)
    }));
  }

  function addStory() {
    setProfile((current) => ({
      ...current,
      stories: [
        ...current.stories,
        { id: crypto.randomUUID(), title: "", situation: "", action: "", outcome: "", skills: [] }
      ].slice(0, 8)
    }));
  }

  function updateStory(id: string, patch: Partial<CandidateStory>) {
    setProfile((current) => ({
      ...current,
      stories: current.stories.map((story) => (story.id === id ? { ...story, ...patch } : story))
    }));
  }

  function removeStory(id: string) {
    setProfile((current) => ({
      ...current,
      stories: current.stories.filter((story) => story.id !== id)
    }));
  }

  return (
    <div className="pb-32">
      <ProfileHero profile={profile} saved={saved} />

      <div className="mx-auto w-full max-w-[86rem] px-5 sm:px-8">
        <TabBar active={tab} changed={changed} onSelect={setTab} />

        <div className="pt-7">
          {tab === "overview" ? (
            <OverviewTab profile={profile} saved={saved} onOpen={setTab} />
          ) : null}
          {tab === "target" ? <TargetTab profile={profile} onChange={update} /> : null}
          {tab === "signal" ? (
            <SignalTab profile={profile} onChange={update} onToggleFocus={toggleFocus} />
          ) : null}
          {tab === "stories" ? (
            <StoriesTab
              stories={profile.stories}
              onAdd={addStory}
              onChange={updateStory}
              onRemove={removeStory}
            />
          ) : null}
          {tab === "resume" ? <ResumeTab resume={resume} /> : null}
        </div>

        {dirty ? (
          <SaveBar saving={saving} error={error} onSave={() => void submit()} />
        ) : (
          <SavedFooter />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

function ProfileHero({
  profile,
  saved
}: {
  profile: CandidateProfileInput;
  saved: CandidateProfile;
}) {
  const resume = saved.resume;
  const name = resume?.fullName?.trim() || "Your interview profile";
  const role = roleOptions.find((option) => option.value === profile.targetRole);
  const level = levelOptions.find((option) => option.value === profile.level);
  const days = daysUntil(profile.targetDate);

  return (
    <header className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[#7ea0ff]/12 blur-3xl"
      />
      <div className="relative mx-auto w-full max-w-[86rem] px-5 pb-7 pt-9 sm:px-8 lg:pt-12">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/16 bg-gradient-to-br from-white/[0.16] to-white/[0.04] text-xl font-semibold text-cream shadow-[0_12px_36px_rgba(7,18,58,0.35)] sm:h-[4.5rem] sm:w-[4.5rem]">
              {initials(name)}
            </span>
            <div className="min-w-0">
              <p className="blueprint-label text-cream/38">Interview memory</p>
              <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-cream sm:text-[2rem]">
                {name}
              </h1>
              <p className="mt-1.5 line-clamp-2 max-w-xl text-sm leading-6 text-cream/50">
                {profile.headline || "Add a headline so Helix can frame your rounds."}
              </p>
            </div>
          </div>

          <Link
            href="/interview"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-blueprint shadow-[0_12px_30px_rgba(7,18,58,0.3)] transition hover:bg-white sm:w-auto"
          >
            Start practice <ArrowRight size={15} />
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <HeroChip icon={Target} label={role?.label ?? "No role set"} muted={!role} />
          <HeroChip icon={BarChart3} label={level?.label ?? "No level set"} muted={!level} />
          {profile.targetCompany ? (
            <HeroChip icon={Building2} label={profile.targetCompany} />
          ) : null}
          {days !== null ? (
            <HeroChip
              icon={CalendarDays}
              label={days <= 0 ? "Interview today" : `${days} days to interview`}
              tone="mint"
            />
          ) : null}
        </div>

        {/* Two-up on phones: stacked, these four pushed the tabs a full screen down. */}
        <dl className="mt-7 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/[0.08] pt-6 sm:gap-x-8 lg:grid-cols-4">
          <MemoryStat value={saved.completeness} />
          <HeroStat
            icon={BadgeCheck}
            label="Resume"
            value={resume ? `${resume.confidence}% verified` : "Not uploaded"}
            hint={resume?.fileName ?? "Upload to ground your rounds"}
            tone={resume ? "mint" : "muted"}
          />
          <HeroStat
            icon={BriefcaseBusiness}
            label="Evidence"
            value={`${resume?.experience.length ?? 0} roles · ${profile.stories.length} stories`}
            hint={`${resume?.skills.length ?? 0} supported skills`}
          />
          <HeroStat
            icon={Lightbulb}
            label="Questions"
            value={String(resume?.practiceQuestions.length ?? 0)}
            hint="Drawn from your own evidence"
          />
        </dl>
      </div>
    </header>
  );
}

function HeroChip({
  icon: Icon,
  label,
  muted = false,
  tone
}: {
  icon: typeof Target;
  label: string;
  muted?: boolean;
  tone?: "mint";
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        tone === "mint"
          ? "border-[#9be8c1]/25 bg-[#71d6a5]/10 text-[#b5efd2]"
          : muted
            ? "border-white/10 bg-white/[0.03] text-cream/35"
            : "border-white/12 bg-white/[0.055] text-cream/75"
      ].join(" ")}
    >
      <Icon size={13} className="shrink-0 opacity-70" />
      {label}
    </span>
  );
}

function MemoryStat({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <Ring value={value} />
      <div className="min-w-0">
        <dt className="text-[10px] uppercase tracking-[0.12em] text-cream/35">Memory</dt>
        <dd className="mt-1 truncate text-sm font-semibold text-cream">
          {value >= 100 ? "Complete" : `${value}%`}
        </dd>
        <p className="mt-0.5 hidden text-[11px] text-cream/38 sm:block">
          {value >= 100 ? "Helix has what it needs" : "Fill the gaps below"}
        </p>
      </div>
    </div>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  hint,
  tone
}: {
  icon: typeof Target;
  label: string;
  value: string;
  hint: string;
  tone?: "mint" | "muted";
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <span
        className={[
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl border sm:h-11 sm:w-11",
          tone === "mint"
            ? "border-[#9be8c1]/25 bg-[#71d6a5]/10 text-[#9be8c1]"
            : tone === "muted"
              ? "border-white/10 bg-white/[0.04] text-cream/40"
              : "border-white/12 bg-white/[0.055] text-cream/70"
        ].join(" ")}
      >
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <dt className="text-[10px] uppercase tracking-[0.12em] text-cream/35">{label}</dt>
        <dd className="mt-1 truncate text-sm font-semibold text-cream">{value}</dd>
        <p className="mt-0.5 hidden truncate text-[11px] text-cream/38 sm:block">{hint}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- tabs */

function TabBar({
  active,
  changed,
  onSelect
}: {
  active: TabId;
  changed: { target: boolean; signal: boolean; stories: boolean };
  onSelect: (tab: TabId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Profile sections"
      className="thin-scroll -mx-5 flex gap-1 overflow-x-auto border-b border-white/[0.08] px-5 sm:mx-0 sm:px-0"
    >
      {tabs.map((item) => {
        const Icon = item.icon;
        const selected = active === item.id;
        const unsaved = item.id in changed && changed[item.id as keyof typeof changed];

        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onSelect(item.id)}
            className={[
              "relative -mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-cream/50",
              selected
                ? "border-cream text-cream"
                : "border-transparent text-cream/45 hover:border-white/20 hover:text-cream/80"
            ].join(" ")}
          >
            <Icon size={15} className="shrink-0" />
            {item.label}
            {unsaved ? (
              <span
                aria-label="Unsaved changes"
                className="h-1.5 w-1.5 rounded-full bg-[#efcf84]"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- overview */

function OverviewTab({
  profile,
  saved,
  onOpen
}: {
  profile: CandidateProfileInput;
  saved: CandidateProfile;
  onOpen: (tab: TabId) => void;
}) {
  const resume = saved.resume;
  const role = roleOptions.find((option) => option.value === profile.targetRole);
  const level = levelOptions.find((option) => option.value === profile.level);
  const checklist = [
    { label: "Target role", done: Boolean(profile.targetRole), tab: "target" as TabId },
    { label: "Experience level", done: Boolean(profile.level), tab: "target" as TabId },
    { label: "Headline", done: profile.headline.trim().length >= 8, tab: "signal" as TabId },
    {
      label: "Experience context",
      done: profile.context.trim().length >= 20,
      tab: "signal" as TabId
    },
    { label: "Focus areas", done: profile.focusAreas.length > 0, tab: "signal" as TabId },
    { label: "At least one story", done: profile.stories.length > 0, tab: "stories" as TabId }
  ];
  const remaining = checklist.filter((item) => !item.done);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-4">
        <Card
          icon={Sparkles}
          title="How Helix reads you"
          action={<EditLink onClick={() => onOpen("signal")} />}
        >
          {/* Capped for readability: full-width prose on a 1500px screen is a wall. */}
          <p className="max-w-[68ch] text-[15px] leading-7 text-cream/72">
            {profile.context ||
              "Nothing here yet. Describe the systems you built and what you owned."}
          </p>
          {profile.focusAreas.length ? (
            <div className="mt-6 border-t border-white/[0.07] pt-5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-cream/35">Current focus</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.focusAreas.map((area) => (
                  <Tag key={area}>{area}</Tag>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card
          icon={BriefcaseBusiness}
          title="Story bank"
          subtitle={`${profile.stories.length} of 8 stories`}
          action={<EditLink label="Manage" onClick={() => onOpen("stories")} />}
        >
          {profile.stories.length === 0 ? (
            <EmptyState
              icon={Plus}
              title="No stories yet"
              body="One complete story makes technical follow-ups noticeably sharper."
              action={
                <button
                  type="button"
                  onClick={() => onOpen("stories")}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/16 bg-white/[0.05] px-4 text-xs font-semibold text-cream transition hover:bg-white/[0.1]"
                >
                  <Plus size={14} /> Add a story
                </button>
              }
            />
          ) : (
            <ul className="divide-y divide-white/[0.07]">
              {profile.stories.map((story, index) => (
                <li key={story.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/12 bg-white/[0.05] font-mono text-[10px] text-cream/45">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-cream">
                      {story.title || "Untitled story"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-cream/45">
                      {story.outcome || story.situation || "No detail captured yet."}
                    </p>
                    {story.skills.length ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {story.skills.slice(0, 5).map((skill) => (
                          <Tag key={skill} size="sm">
                            {skill}
                          </Tag>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4">
        <Card icon={Target} title="Target" action={<EditLink onClick={() => onOpen("target")} />}>
          <dl className="divide-y divide-white/[0.07]">
            <Row label="Role" value={role?.label} />
            <Row label="Level" value={level?.label} />
            <Row label="Company" value={profile.targetCompany || undefined} />
            <Row label="Interview date" value={formatDate(profile.targetDate)} />
          </dl>
        </Card>

        {remaining.length ? (
          <Card icon={Check} title="Finish your profile" subtitle={`${remaining.length} left`}>
            <ul className="space-y-1">
              {checklist.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => onOpen(item.tab)}
                    disabled={item.done}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition enabled:hover:bg-white/[0.05] disabled:cursor-default"
                  >
                    <span
                      className={[
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                        item.done
                          ? "border-[#9be8c1]/30 bg-[#71d6a5]/12 text-[#9be8c1]"
                          : "border-white/16 text-transparent"
                      ].join(" ")}
                    >
                      <Check size={11} />
                    </span>
                    <span className={item.done ? "text-sm text-cream/40" : "text-sm text-cream/80"}>
                      {item.label}
                    </span>
                    {!item.done ? (
                      <ChevronRight size={14} className="ml-auto shrink-0 text-cream/30" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <ResumeStatusCard resume={resume} onOpen={() => onOpen("resume")} />
      </div>
    </div>
  );
}

function ResumeStatusCard({
  resume,
  onOpen
}: {
  resume: CandidateProfile["resume"];
  onOpen: () => void;
}) {
  return (
    <Card
      icon={BadgeCheck}
      title="Verified resume"
      tone={resume ? "mint" : undefined}
      action={resume ? <EditLink label="View" onClick={onOpen} /> : undefined}
    >
      {resume ? (
        <>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/12 bg-white/[0.05] text-cream/70">
              <FileText size={17} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-cream">{resume.fileName}</p>
              <p className="mt-0.5 text-xs text-cream/38">
                {resume.confidence}% confidence · {formatTimestamp(resume.uploadedAt)}
              </p>
            </div>
          </div>
          {resume.warnings.length ? (
            <div className="mt-5 rounded-xl border border-[#efcf84]/20 bg-[#efcf84]/[0.06] p-3.5">
              <p className="flex items-center gap-2 text-[11px] font-semibold text-[#f4dda6]">
                <TriangleAlert size={13} /> Helix will challenge these
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {resume.warnings.slice(0, 2).map((warning) => (
                  <li key={warning} className="text-[11px] leading-5 text-cream/50">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={Upload}
          title="No resume on file"
          body="Helix asks sharper questions when it can quote your resume."
        />
      )}
      <Link
        href="/onboarding?replace=resume"
        className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/16 bg-white/[0.045] text-xs font-semibold text-cream/80 transition hover:border-white/28 hover:bg-white/[0.09] hover:text-cream"
      >
        <Upload size={14} /> {resume ? "Replace resume" : "Upload resume"}
      </Link>
    </Card>
  );
}

/* ----------------------------------------------------------------- target */

function TargetTab({
  profile,
  onChange
}: {
  profile: CandidateProfileInput;
  onChange: (patch: Partial<CandidateProfileInput>) => void;
}) {
  return (
    <div className="grid gap-4">
      <Card
        icon={Target}
        title="Which role are you interviewing for?"
        subtitle="Sets the evidence Helix looks for, not just the question labels."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roleOptions.map((option) => {
            const Icon = option.icon;
            const active = profile.targetRole === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ targetRole: option.value })}
                className={[
                  "group flex min-h-[6.5rem] flex-col rounded-2xl border p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-cream/60",
                  active
                    ? "border-cream bg-cream text-blueprint shadow-[0_16px_40px_rgba(7,18,58,0.3)]"
                    : "border-white/12 bg-white/[0.035] text-cream hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.075]"
                ].join(" ")}
              >
                <span className="flex items-center justify-between">
                  <Icon size={19} className={active ? "text-blueprint" : "text-cream/45"} />
                  {active ? <Check size={15} /> : null}
                </span>
                <span className="mt-auto block pt-5 text-sm font-semibold">{option.label}</span>
                <span
                  className={[
                    "mt-1 block text-[11px] leading-4",
                    active ? "text-blueprint/60" : "text-cream/38"
                  ].join(" ")}
                >
                  {option.detail}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card
          icon={BarChart3}
          title="Experience level"
          subtitle="Changes depth, ownership expectations, and follow-up pressure."
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {levelOptions.map((option) => {
              const active = profile.level === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ level: option.value })}
                  className={[
                    "flex items-center gap-3 rounded-xl border px-4 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-cream/60",
                    active
                      ? "border-cream bg-cream text-blueprint"
                      : "border-white/12 bg-white/[0.035] text-cream hover:border-white/25 hover:bg-white/[0.075]"
                  ].join(" ")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span
                      className={[
                        "mt-0.5 block text-[11px]",
                        active ? "text-blueprint/60" : "text-cream/38"
                      ].join(" ")}
                    >
                      {option.detail}
                    </span>
                  </span>
                  {active ? <Check size={15} className="shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </Card>

        <Card icon={CalendarDays} title="The interview itself" subtitle="Both optional.">
          <div className="space-y-5">
            <Field label="Target company">
              <span className="relative block">
                <Building2
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cream/30"
                />
                <input
                  value={profile.targetCompany}
                  onChange={(event) => onChange({ targetCompany: event.target.value })}
                  placeholder="Stripe, Figma, a startup…"
                  maxLength={100}
                  className={`${fieldClass} min-h-12 pl-11 pr-4`}
                />
              </span>
            </Field>
            <Field label="Interview date">
              <span className="relative block">
                <CalendarDays
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cream/30"
                />
                <input
                  type="date"
                  value={profile.targetDate ?? ""}
                  onChange={(event) => onChange({ targetDate: event.target.value || null })}
                  className={`${fieldClass} min-h-12 pl-11 pr-4`}
                />
              </span>
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- signal */

function SignalTab({
  profile,
  onChange,
  onToggleFocus
}: {
  profile: CandidateProfileInput;
  onChange: (patch: Partial<CandidateProfileInput>) => void;
  onToggleFocus: (area: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
      <Card
        icon={Sparkles}
        title="What you have actually done"
        subtitle="Helix quotes this back at you under pressure, so keep it specific and defensible."
      >
        <div className="space-y-6">
          <Field label="Professional headline" counter={`${profile.headline.length} / 140`}>
            <input
              value={profile.headline}
              onChange={(event) => onChange({ headline: event.target.value })}
              placeholder="Full-stack engineer building reliable fintech workflows"
              maxLength={140}
              className={`${fieldClass} min-h-12 px-4`}
            />
          </Field>
          <Field label="Experience context" counter={`${profile.context.length} / 1600`}>
            <textarea
              value={profile.context}
              onChange={(event) => onChange({ context: event.target.value })}
              rows={10}
              maxLength={1600}
              placeholder="Name the systems you built, your ownership, scale, difficult decisions, and measurable outcomes."
              className={`${fieldClass} thin-scroll resize-y px-4 py-3.5 leading-7`}
            />
          </Field>
        </div>
      </Card>

      <Card
        icon={Lightbulb}
        title="Current focus"
        subtitle="What the next rounds should press on."
        action={
          <span className="font-mono text-[10px] text-cream/32">
            {profile.focusAreas.length} / 8
          </span>
        }
      >
        <div className="flex flex-wrap gap-2">
          {focusOptions.map((area) => {
            const active = profile.focusAreas.includes(area);
            return (
              <button
                key={area}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleFocus(area)}
                className={[
                  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-cream/60",
                  active
                    ? "border-cream bg-cream text-blueprint"
                    : "border-white/12 bg-white/[0.045] text-cream/62 hover:border-white/28 hover:bg-white/[0.09] hover:text-cream"
                ].join(" ")}
              >
                {area}
                {active ? <Check size={13} /> : null}
              </button>
            );
          })}
        </div>
        <p className="mt-5 border-t border-white/[0.07] pt-4 text-xs leading-5 text-cream/38">
          Helix weights these when it decides what to probe next, and your reports score the same
          competencies.
        </p>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- stories */

function StoriesTab({
  stories,
  onAdd,
  onChange,
  onRemove
}: {
  stories: CandidateStory[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<CandidateStory>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <Card
        icon={BriefcaseBusiness}
        title="Evidence worth reusing"
        subtitle="Keep each story factual. Helix will challenge the weak links during an interview."
        action={
          stories.length > 0 && stories.length < 8 ? (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/16 bg-white/[0.05] px-4 text-xs font-semibold text-cream/80 transition hover:border-white/28 hover:bg-white/[0.09] hover:text-cream"
            >
              <Plus size={14} /> Add story
            </button>
          ) : undefined
        }
      >
        {stories.length === 0 ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/16 bg-white/[0.02] text-center transition hover:border-cream/35 hover:bg-white/[0.05]"
          >
            <span className="grid h-12 w-12 place-items-center rounded-xl border border-white/14 bg-white/[0.06] text-cream/70">
              <Plus size={19} />
            </span>
            <span className="mt-4 font-semibold text-cream">Add your first project story</span>
            <span className="mt-1 text-sm text-cream/38">Situation, your action, the outcome.</span>
          </button>
        ) : (
          <div className="space-y-4">
            {stories.map((story, index) => (
              <StoryEditor
                key={story.id}
                story={story}
                index={index}
                onChange={onChange}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StoryEditor({
  story,
  index,
  onChange,
  onRemove
}: {
  story: CandidateStory;
  index: number;
  onChange: (id: string, patch: Partial<CandidateStory>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <article className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-white/18 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/12 bg-white/[0.05] font-mono text-[11px] text-cream/45">
          {String(index + 1).padStart(2, "0")}
        </span>
        <input
          value={story.title}
          onChange={(event) => onChange(story.id, { title: event.target.value })}
          placeholder="Project or accomplishment"
          maxLength={100}
          className="min-h-10 min-w-0 flex-1 border-b border-white/12 bg-transparent text-base font-semibold text-cream outline-none transition placeholder:text-cream/28 focus:border-cream/50"
        />
        <button
          type="button"
          title="Remove story"
          aria-label={`Remove story ${index + 1}`}
          onClick={() => onRemove(story.id)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-cream/30 opacity-0 transition hover:bg-[#ff9898]/10 hover:text-[#ffc2c2] focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-5 grid gap-3.5 lg:grid-cols-3">
        <StoryField
          label="Situation"
          value={story.situation}
          placeholder="What was at stake?"
          onChange={(value) => onChange(story.id, { situation: value })}
        />
        <StoryField
          label="Your action"
          value={story.action}
          placeholder="What did you decide or build?"
          onChange={(value) => onChange(story.id, { action: value })}
        />
        <StoryField
          label="Outcome"
          value={story.outcome}
          placeholder="What measurably changed?"
          onChange={(value) => onChange(story.id, { outcome: value })}
        />
      </div>
      <label className="mt-3.5 block">
        <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.12em] text-cream/35">
          Skills
        </span>
        <input
          value={story.skills.join(", ")}
          onChange={(event) =>
            onChange(story.id, {
              skills: event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 6)
            })
          }
          placeholder="React, API design, leadership"
          className={`${fieldClass} min-h-11 px-4 text-sm`}
        />
      </label>
    </article>
  );
}

function StoryField({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.12em] text-cream/35">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        maxLength={800}
        placeholder={placeholder}
        className={`${fieldClass} thin-scroll resize-y px-3.5 py-3 text-sm leading-6`}
      />
    </label>
  );
}

/* ----------------------------------------------------------------- resume */

function ResumeTab({ resume }: { resume: CandidateProfile["resume"] }) {
  if (!resume) {
    return (
      <Card icon={BadgeCheck} title="No verified resume yet">
        <EmptyState
          icon={Upload}
          title="Nothing to show"
          body="Upload a resume and Helix will extract the evidence it can trace back to the document."
          action={
            <Link
              href="/onboarding?replace=resume"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-cream px-4 text-xs font-semibold text-blueprint transition hover:bg-white"
            >
              <Upload size={14} /> Upload resume
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-4">
        <Card
          icon={BriefcaseBusiness}
          title="Experience timeline"
          subtitle="Every entry was traced back to a line in your file."
          tone="mint"
        >
          {resume.experience.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title="Project-led profile"
              body="No professional role was verified, so Helix anchors rounds to your projects."
            />
          ) : (
            <ol className="relative space-y-6 border-l border-white/10 pl-6">
              {resume.experience.map((entry) => (
                <li key={`${entry.organization}-${entry.role}`} className="relative">
                  <span className="absolute -left-[1.72rem] top-1.5 grid h-3 w-3 place-items-center rounded-full border-2 border-[#9be8c1]/50 bg-[#102764]" />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-cream">
                      {entry.role || "Role not listed"}
                    </h3>
                    <span className="font-mono text-[10px] text-cream/40">{entry.period}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-cream/60">{entry.organization}</p>
                  {entry.summary ? (
                    <p className="mt-2.5 text-xs leading-6 text-cream/45">{entry.summary}</p>
                  ) : null}
                  {entry.achievements.length ? (
                    <ul className="mt-3 space-y-1.5">
                      {entry.achievements.map((achievement) => (
                        <li
                          key={achievement}
                          className="flex gap-2.5 text-xs leading-5 text-cream/52"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#9be8c1]/60" />
                          {achievement}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {entry.skills.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {entry.skills.slice(0, 8).map((skill) => (
                        <Tag key={skill} size="sm">
                          {skill}
                        </Tag>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card icon={Sparkles} title="Supported skills" subtitle={`${resume.skills.length} found`}>
          <div className="flex flex-wrap gap-2">
            {resume.skills.map((skill) => (
              <Tag key={skill}>{skill}</Tag>
            ))}
            {resume.skills.length === 0 ? (
              <p className="text-xs text-cream/38">None extracted.</p>
            ) : null}
          </div>
        </Card>

        {resume.projects.length ? (
          <Card icon={Blocks} title="Named projects">
            <div className="grid gap-3 sm:grid-cols-2">
              {resume.projects.map((project) => (
                <div
                  key={project.name}
                  className="rounded-xl border border-white/10 bg-white/[0.035] p-4"
                >
                  <p className="text-sm font-semibold text-cream">{project.name}</p>
                  <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-cream/45">
                    {project.outcome || project.summary}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {resume.achievements.length ? (
          <Card icon={Quote} title="Quoted from your resume">
            <ul className="space-y-3">
              {resume.achievements.map((achievement) => (
                <li
                  key={achievement}
                  className="border-l-2 border-cream/20 pl-4 text-sm leading-6 text-cream/62"
                >
                  {achievement}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-4">
        <Card icon={FileText} title="Document">
          <dl className="divide-y divide-white/[0.07]">
            <Row label="File" value={resume.fileName} />
            <Row label="Verified" value={formatTimestamp(resume.uploadedAt)} />
            <Row label="Confidence" value={`${resume.confidence}%`} />
            <Row
              label={resume.document.pageCountEstimated ? "Pages (est.)" : "Pages"}
              value={String(resume.document.pageCount)}
            />
          </dl>
          <Link
            href="/onboarding?replace=resume"
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/16 bg-white/[0.045] text-xs font-semibold text-cream/80 transition hover:border-white/28 hover:bg-white/[0.09] hover:text-cream"
          >
            <Upload size={14} /> Replace resume
          </Link>
        </Card>

        {resume.education.length ? (
          <Card icon={GraduationCap} title="Education">
            <div className="space-y-4">
              {resume.education.map((entry) => (
                <div key={`${entry.institution}-${entry.credential}`}>
                  <p className="text-sm font-semibold text-cream">
                    {entry.credential || entry.field || "Programme"}
                  </p>
                  <p className="mt-1 text-xs text-cream/48">{entry.institution}</p>
                  {entry.period ? (
                    <p className="mt-1 font-mono text-[10px] text-cream/30">{entry.period}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {resume.warnings.length ? (
          <div className="rounded-2xl border border-[#efcf84]/22 bg-[#efcf84]/[0.06] p-5">
            <p className="flex items-center gap-2 text-xs font-semibold text-[#f4dda6]">
              <TriangleAlert size={14} /> Helix will challenge these
            </p>
            <ul className="mt-3.5 space-y-2.5">
              {resume.warnings.map((warning) => (
                <li key={warning} className="flex gap-2.5 text-[11px] leading-5 text-cream/50">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#efcf84]" />
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

function Card({
  icon: Icon,
  title,
  subtitle,
  action,
  tone,
  children
}: {
  icon: typeof Target;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  tone?: "mint";
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.028] shadow-[0_18px_50px_rgba(7,18,58,0.2)] backdrop-blur-md">
      <div className="flex flex-wrap items-start gap-3.5 px-5 pt-5 sm:px-6 sm:pt-6">
        <span
          className={[
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
            tone === "mint"
              ? "border-[#9be8c1]/25 bg-[#71d6a5]/10 text-[#9be8c1]"
              : "border-white/12 bg-white/[0.055] text-cream/75"
          ].join(" ")}
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight text-cream">{title}</h2>
          {subtitle ? (
            <p className="mt-1 max-w-xl text-xs leading-5 text-cream/40">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6">{children}</div>
    </section>
  );
}

function EditLink({ label = "Edit", onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 text-xs font-semibold text-cream/65 transition hover:border-white/25 hover:bg-white/[0.09] hover:text-cream"
    >
      <Pencil size={12} /> {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-xs text-cream/40">{label}</dt>
      <dd
        className={[
          "min-w-0 truncate text-right text-sm",
          value && value !== "Not set" ? "font-medium text-cream/85" : "text-cream/30"
        ].join(" ")}
      >
        {value && value !== "Not set" ? value : "Not set"}
      </dd>
    </div>
  );
}

function Tag({ children, size = "md" }: { children: React.ReactNode; size?: "sm" | "md" }) {
  return (
    <span
      className={[
        "rounded-full border border-white/12 bg-white/[0.055] text-cream/68",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action
}: {
  icon: typeof Target;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-5 py-8 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-white/[0.05] text-cream/55">
        <Icon size={17} />
      </span>
      <p className="mt-3.5 text-sm font-semibold text-cream/85">{title}</p>
      <p className="mt-1.5 max-w-sm text-xs leading-5 text-cream/40">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function Field({
  label,
  counter,
  children
}: {
  label: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-cream/78">{label}</span>
        {counter ? <span className="font-mono text-[10px] text-cream/32">{counter}</span> : null}
      </span>
      {children}
    </label>
  );
}

function Ring({ value }: { value: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="5"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={value >= 100 ? "#9be8c1" : "#efe8d6"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(100, Math.max(0, value)) / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-xs font-semibold text-cream">
        {value}%
      </span>
    </div>
  );
}

function SaveBar({
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
      <div className="flex flex-col gap-3 rounded-2xl border border-white/14 bg-[#132a68]/90 p-4 shadow-[0_24px_70px_rgba(7,18,58,0.55)] backdrop-blur-2xl sm:flex-row sm:items-center">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#efcf84]/30 bg-[#efcf84]/10 text-[#f4dda6]">
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
              Helix uses this from your next round onward.
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

function SavedFooter() {
  return (
    <div className="mt-8 flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#9be8c1]/25 bg-[#71d6a5]/10 text-[#9be8c1]">
        <Check size={15} />
      </span>
      <p className="text-xs text-cream/40">
        Interview memory is up to date. Only you can see this information.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- helpers */

function toInput(profile: CandidateProfile): CandidateProfileInput {
  const { targetRole, level, targetCompany, targetDate, headline, context, focusAreas, stories } =
    profile;
  return { targetRole, level, targetCompany, targetDate, headline, context, focusAreas, stories };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "H";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(`${date}T12:00:00.000Z`).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / (24 * 60 * 60 * 1000));
}

function formatDate(date: string | null): string {
  if (!date) return "Not set";
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}
