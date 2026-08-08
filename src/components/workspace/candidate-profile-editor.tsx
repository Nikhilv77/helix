"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Blocks,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleCheck,
  Code2,
  Database,
  Eye,
  FileText,
  GraduationCap,
  Mic,
  PackageCheck,
  Pencil,
  Plus,
  Quote,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TriangleAlert,
  UserRound,
  Upload
} from "lucide-react";
import { LevelArtwork } from "@/components/workspace/level-artwork";
import { ProfileAvatar } from "@/components/workspace/profile-avatar";
import { ApiClientError, saveProfile } from "@/lib/api-client";
import { pageTitle } from "@/lib/seo";
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

/** One input treatment for the page, so nothing drifts field to field. */
const fieldClass =
  "w-full rounded-xl bg-[#24439b] text-cream outline-none ring-1 ring-inset ring-cream/10 transition placeholder:text-cream/35 hover:bg-[#27479f] focus:bg-[#27479f] focus:ring-2 focus:ring-cream/35";

export function CandidateProfileEditor({ initialProfile }: { initialProfile: CandidateProfile }) {
  const [profile, setProfile] = useState<CandidateProfileInput>(toInput(initialProfile));
  const [saved, setSaved] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "resume">("view");
  const [openStory, setOpenStory] = useState<string | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(toInput(saved)),
    [profile, saved]
  );
  const resume = saved.resume;

  useEffect(() => {
    const title =
      mode === "edit" ? "Edit Profile" : mode === "resume" ? "Resume Evidence" : "My Profile";
    document.title = pageTitle(title);
  }, [mode]);

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
    const story: CandidateStory = {
      id: crypto.randomUUID(),
      title: "",
      situation: "",
      action: "",
      outcome: "",
      skills: []
    };
    setProfile((current) => ({ ...current, stories: [...current.stories, story].slice(0, 8) }));
    setOpenStory(story.id);
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

  // The profile reads first and edits second: everything below the fold used to
  // be a form, which buried the handful of facts that actually matter.
  if (mode === "view") {
    return (
      <div className="mx-auto w-full max-w-[110rem] px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <ProfileHero profile={profile} saved={saved} onEdit={() => setMode("edit")} />
        <ProfileSignalDeck profile={profile} saved={saved} />

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.42fr)_minmax(0,1fr)] lg:items-stretch">
          <div className="grid gap-5">
            <AboutCard profile={profile} />
            <VerifiedResumeCard resume={resume} onOpen={() => setMode("resume")} />
          </div>
          <TargetRoleCard profile={profile} />
        </div>

        <SignatureStoryCard story={profile.stories[0]} />

        {dirty ? <SaveBar saving={saving} error={error} onSave={() => void submit()} /> : null}
      </div>
    );
  }

  if (mode === "resume") {
    return (
      <div className="mx-auto w-full max-w-[110rem] px-5 py-6 pb-16 sm:px-8 lg:px-10 lg:py-8">
        <ResumeHero resume={resume} onBack={() => setMode("view")} />
        <div className="mt-6">
          <ResumeTab resume={resume} />
        </div>
      </div>
    );
  }

  // Editing is deliberately narrow: role, level, the paragraph Trailgrad quotes,
  // and the story bank. Everything else on this page is derived or read-only,
  // so putting it in the form only invited people to fiddle with it.
  return (
    <div className="mx-auto w-full max-w-[110rem] px-5 py-6 pb-36 sm:px-8 lg:px-10 lg:py-8">
      <header className="profile-motion surface-raised relative overflow-hidden p-6 sm:p-8 lg:p-10">
        <CardPattern variant="waves" />
        <div
          aria-hidden
          className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#71d6a5]/12 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setMode("view")}
              className="pill inline-flex h-10 items-center gap-2 !rounded-xl px-4 text-xs font-semibold text-cream/72 transition hover:bg-white/[0.12] hover:text-cream"
            >
              <ArrowLeft size={14} /> Back to profile
            </button>
            <p className="blueprint-label mt-8 text-cream/35">Interview memory</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-[1.03] tracking-tight text-cream sm:text-5xl lg:text-6xl">
              Shape the way Maya interviews you.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-cream/58">
              Keep the inputs short and concrete. Maya turns these signals into questions,
              follow-ups, and pressure points.
            </p>
          </div>
          <div className="grid gap-3">
            <span
              className={[
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]",
                dirty ? "bg-[#efcf84]/16 text-[#f4dda6]" : "bg-[#71d6a5]/16 text-[#b5efd2]"
              ].join(" ")}
            >
              <span className={`h-2 w-2 rounded-full ${dirty ? "bg-[#efcf84]" : "bg-[#71d6a5]"}`} />
              {dirty ? "Unsaved changes" : "All changes saved"}
            </span>
            <div className="hidden rounded-2xl bg-white/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:block">
              <p className="text-3xl font-semibold text-cream">{profile.focusAreas.length || 0}</p>
              <p className="mt-1 text-xs text-cream/42">active focus areas</p>
            </div>
          </div>
        </div>
      </header>

      <EditMemoryPreview profile={profile} saved={saved} />

      {/* Settings layout: a sticky rail of sections beside the form, so a wide
          screen is used without stretching any single field. */}
      <div className="mt-7 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <nav className="surface p-3">
            {EDIT_SECTIONS.map((section, index) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-cream/62 transition hover:bg-white/[0.07] hover:text-cream"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-cream/55 transition group-hover:bg-cream group-hover:text-blueprint">
                  <section.icon size={16} />
                </span>
                <span>
                  <span className="block">{section.label}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-cream/45">
                    Step {index + 1}
                  </span>
                </span>
              </a>
            ))}
          </nav>

          <div className="surface mt-4 overflow-hidden p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#efcf84]/16 text-[#f7e3ae]">
                <Quote size={17} />
              </span>
              <div>
                <p className="text-sm font-semibold text-cream">Keep it quotable</p>
                <p className="mt-1 text-xs leading-5 text-cream/42">
                  Specific systems, numbers, decisions, and outcomes make better interviews.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div className="grid gap-6">
          <EditSection
            id="target"
            icon={Target}
            tone="sky"
            title="Target"
            hint="Sets how deep the questions go."
          >
            <FieldBlock label="Role" hint="What the interviewer treats you as.">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {roleOptions.map((option) => (
                  <RoleOption
                    key={option.value}
                    option={option}
                    selected={profile.targetRole === option.value}
                    onClick={() => update({ targetRole: option.value })}
                  />
                ))}
              </div>
            </FieldBlock>

            <FieldBlock label="Experience level" hint="Sets expectations for scope and ownership.">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {levelOptions.map((option) => (
                  <LevelOption
                    key={option.value}
                    option={option}
                    selected={profile.level === option.value}
                    onClick={() => update({ level: option.value })}
                  />
                ))}
              </div>
            </FieldBlock>

            <details className="group mt-1">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-cream/45 transition hover:text-cream/75">
                <ChevronRight size={13} className="transition group-open:rotate-90" />
                Company and date (optional)
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FieldBlock label="Target company">
                  <input
                    value={profile.targetCompany}
                    onChange={(event) => update({ targetCompany: event.target.value })}
                    placeholder="Stripe, Figma, a startup…"
                    maxLength={100}
                    className={`${fieldClass} min-h-11 px-4 text-[14px]`}
                  />
                </FieldBlock>
                <FieldBlock label="Interview date">
                  <input
                    type="date"
                    value={profile.targetDate ?? ""}
                    onChange={(event) => update({ targetDate: event.target.value || null })}
                    className={`${fieldClass} min-h-11 px-4 text-[14px]`}
                  />
                </FieldBlock>
              </div>
            </details>
          </EditSection>

          <EditSection
            id="signal"
            icon={Sparkles}
            tone="cream"
            title="What you have done"
            hint="Trailgrad quotes this back at you under pressure."
          >
            <FieldBlock
              label="Headline"
              hint="One line, the way you would introduce yourself."
              counter={`${profile.headline.length} / 140`}
            >
              <input
                value={profile.headline}
                onChange={(event) => update({ headline: event.target.value })}
                placeholder="Full-stack engineer building reliable fintech workflows"
                maxLength={140}
                className={`${fieldClass} min-h-11 px-4 text-[14px]`}
              />
            </FieldBlock>

            <FieldBlock
              label="Experience context"
              hint="Systems, ownership, scale, decisions, outcomes."
              counter={`${profile.context.length} / 1600`}
            >
              <textarea
                value={profile.context}
                onChange={(event) => update({ context: event.target.value })}
                rows={7}
                maxLength={1600}
                placeholder="Name the systems you built, your ownership, scale, difficult decisions, and measurable outcomes."
                className={`${fieldClass} thin-scroll resize-y px-4 py-3.5 text-sm leading-7`}
              />
            </FieldBlock>

            <FieldBlock
              label="Focus areas"
              hint="What the next rounds should press on."
              counter={`${profile.focusAreas.length} / 8`}
            >
              <div className="flex flex-wrap gap-2.5">
                {focusOptions.map((area) => (
                  <SelectChip
                    key={area}
                    selected={profile.focusAreas.includes(area)}
                    onClick={() => toggleFocus(area)}
                  >
                    {area}
                  </SelectChip>
                ))}
              </div>
            </FieldBlock>
          </EditSection>

          <EditSection
            id="stories"
            icon={BriefcaseBusiness}
            tone="amber"
            title="Story bank"
            hint={`${profile.stories.length} of 8 · one strong story beats five thin ones.`}
          >
            {profile.stories.length === 0 ? (
              <button
                type="button"
                onClick={addStory}
                className="pill flex h-24 w-full items-center justify-center gap-2 !rounded-xl text-sm font-semibold text-cream/70 transition hover:bg-white/[0.12] hover:text-cream"
              >
                <Plus size={15} /> Add your first story
              </button>
            ) : (
              <div className="grid gap-2.5">
                {profile.stories.map((story, index) => (
                  <StoryRow
                    key={story.id}
                    story={story}
                    index={index}
                    open={openStory === story.id}
                    onToggle={() => setOpenStory(openStory === story.id ? null : story.id)}
                    onChange={updateStory}
                    onRemove={(id) => {
                      removeStory(id);
                      setOpenStory(null);
                    }}
                  />
                ))}
                {profile.stories.length < 8 ? (
                  <button
                    type="button"
                    onClick={addStory}
                    className="pill flex h-11 items-center justify-center gap-2 !rounded-xl text-xs font-semibold text-cream/65 transition hover:bg-white/[0.12] hover:text-cream"
                  >
                    <Plus size={14} /> Add another story
                  </button>
                ) : null}
              </div>
            )}
          </EditSection>
        </div>
      </div>

      {dirty ? (
        <SaveBar saving={saving} error={error} onSave={() => void submit()} />
      ) : (
        <SavedFooter />
      )}
    </div>
  );
}

const EDIT_SECTIONS = [
  { id: "target", label: "Target", icon: Target },
  { id: "signal", label: "What you have done", icon: Sparkles },
  { id: "stories", label: "Story bank", icon: BriefcaseBusiness }
] as const;

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
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.09em] text-cream/55">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        maxLength={800}
        placeholder={placeholder}
        className={`${fieldClass} thin-scroll resize-y px-3.5 py-3 text-[14px] leading-6`}
      />
    </label>
  );
}

function EditSection({
  id,
  icon: Icon,
  tone,
  title,
  hint,
  children
}: {
  id: string;
  icon: typeof Target;
  tone: keyof typeof statTones;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="profile-motion surface scroll-mt-6 p-5 sm:p-7 lg:p-8">
      <div className="flex items-center gap-4">
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${statTones[tone]}`}
        >
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-cream sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-cream/45">{hint}</p>
        </div>
      </div>
      <div className="mt-8 grid gap-8">{children}</div>
    </section>
  );
}

function FieldBlock({
  label,
  hint,
  counter,
  children
}: {
  label: string;
  hint?: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="lg:pt-2">
        <span className="block text-base font-semibold text-cream/88">{label}</span>
        {hint ? <span className="mt-1 block text-xs leading-5 text-cream/38">{hint}</span> : null}
        {counter ? (
          <span className="mt-1.5 block font-mono text-[11px] text-cream/45">{counter}</span>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function RoleOption({
  option,
  selected,
  onClick
}: {
  option: (typeof roleOptions)[number];
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = option.icon;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "group min-h-32 rounded-3xl p-4 text-left outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-cream/55",
        selected
          ? "bg-cream text-blueprint shadow-[0_18px_45px_-22px_rgba(239,232,214,0.65)]"
          : "bg-white/[0.055] text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:-translate-y-0.5 hover:bg-white/[0.085]"
      ].join(" ")}
    >
      <span className="flex items-start justify-between gap-3">
        <span
          className={[
            "grid h-11 w-11 place-items-center rounded-2xl transition",
            selected ? "bg-blueprint/10 text-blueprint" : "bg-white/[0.07] text-cream/68"
          ].join(" ")}
        >
          <Icon size={19} />
        </span>
        {selected ? <Check size={16} className="shrink-0" /> : null}
      </span>
      <span className="mt-5 block text-base font-semibold">{option.label}</span>
      <span
        className={[
          "mt-1.5 block text-xs leading-5",
          selected ? "text-blueprint/62" : "text-cream/42"
        ].join(" ")}
      >
        {option.detail}
      </span>
    </button>
  );
}

function LevelOption({
  option,
  selected,
  onClick
}: {
  option: (typeof levelOptions)[number];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "min-h-28 rounded-3xl p-4 text-left outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-cream/55",
        selected
          ? "bg-cream text-blueprint shadow-[0_18px_45px_-22px_rgba(239,232,214,0.65)]"
          : "bg-white/[0.055] text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:-translate-y-0.5 hover:bg-white/[0.085]"
      ].join(" ")}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] opacity-70">Level</span>
        {selected ? <Check size={16} className="shrink-0" /> : null}
      </span>
      <span className="mt-4 block text-base font-semibold">{option.label}</span>
      <span
        className={[
          "mt-1.5 block text-xs leading-5",
          selected ? "text-blueprint/62" : "text-cream/42"
        ].join(" ")}
      >
        {option.detail}
      </span>
    </button>
  );
}

function SelectChip({
  selected,
  onClick,
  children
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-cream/60",
        selected
          ? "bg-cream text-blueprint"
          : "pill text-cream/62 hover:-translate-y-0.5 hover:bg-white/[0.12] hover:text-cream"
      ].join(" ")}
    >
      {children}
      {selected ? <Check size={13} /> : null}
    </button>
  );
}

/** Collapsed by default: eight expanded stories was a wall of textareas. */
function StoryRow({
  story,
  index,
  open,
  onToggle,
  onChange,
  onRemove
}: {
  story: CandidateStory;
  index: number;
  open: boolean;
  onToggle: () => void;
  onChange: (id: string, patch: Partial<CandidateStory>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <article className="overflow-hidden rounded-3xl bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.075)] transition hover:bg-white/[0.065]">
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[0.07] font-mono text-[11px] text-cream/56">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold text-cream">
              {story.title || "Untitled story"}
            </span>
            {!open ? (
              <span className="mt-1 block truncate text-xs text-cream/38">
                {story.outcome || story.situation || "Nothing captured yet"}
              </span>
            ) : null}
          </span>
          <ChevronRight
            size={15}
            className={`shrink-0 text-cream/30 transition ${open ? "rotate-90" : ""}`}
          />
        </button>
        <button
          type="button"
          aria-label={`Remove story ${index + 1}`}
          onClick={() => onRemove(story.id)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-cream/30 transition hover:bg-[#ff9898]/10 hover:text-[#ffc2c2]"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {open ? (
        <div className="profile-motion grid gap-4 px-4 pb-5">
          <input
            value={story.title}
            onChange={(event) => onChange(story.id, { title: event.target.value })}
            placeholder="Project or accomplishment"
            maxLength={100}
            className={`${fieldClass} min-h-11 px-4 text-sm font-medium`}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <StoryField
              label="Situation"
              value={story.situation}
              placeholder="What was at stake?"
              onChange={(value) => onChange(story.id, { situation: value })}
            />
            <StoryField
              label="Your action"
              value={story.action}
              placeholder="What did you decide?"
              onChange={(value) => onChange(story.id, { action: value })}
            />
            <StoryField
              label="Outcome"
              value={story.outcome}
              placeholder="What changed?"
              onChange={(value) => onChange(story.id, { outcome: value })}
            />
          </div>
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
            placeholder="Skills: React, API design, leadership"
            className={`${fieldClass} min-h-11 px-4 text-[14px]`}
          />
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ hero */

function ProfileHero({
  profile,
  saved,
  onEdit
}: {
  profile: CandidateProfileInput;
  saved: CandidateProfile;
  onEdit: () => void;
}) {
  const resume = saved.resume;
  const name = resume?.fullName?.trim() || "Your interview profile";
  const role = roleOptions.find((option) => option.value === profile.targetRole);
  const level = levelOptions.find((option) => option.value === profile.level);

  return (
    <header className="surface-raised relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 opacity-30"
        style={{
          backgroundImage: "radial-gradient(rgba(239,232,214,0.45) 1px, transparent 1px)",
          backgroundSize: "16px 16px"
        }}
      />

      <button
        type="button"
        onClick={onEdit}
        className="pill absolute right-5 top-5 z-10 inline-flex h-10 items-center gap-2 !rounded-xl px-4 text-xs font-semibold text-cream/80 backdrop-blur-sm transition hover:bg-white/[0.14] hover:text-cream sm:right-7 sm:top-7"
      >
        <Pencil size={13} /> Edit profile
      </button>

      <div className="relative grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-8">
        <span className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full sm:h-[10.5rem] sm:w-[10.5rem]">
          <span
            aria-hidden
            className="absolute -inset-1 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.35),transparent_60%)] blur-md"
          />
          <ProfileAvatar
            name={name}
            className="relative h-full w-full rounded-full shadow-[0_18px_40px_-12px_rgba(5,14,45,0.9),inset_0_0_0_1px_rgba(255,255,255,0.14)]"
          />
        </span>

        <div className="min-w-0 pr-0 lg:pr-6">
          <p className="blueprint-label text-cream/38">Profile</p>
          <h1 className="mt-2.5 flex items-center gap-2.5 text-3xl font-semibold tracking-tight text-cream sm:text-[2.35rem]">
            <span className="truncate">{name}</span>
            {resume ? (
              <BadgeCheck size={22} className="shrink-0 text-[#9be8c1]" aria-label="Verified" />
            ) : null}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-cream/55 sm:text-[15px]">
            {profile.headline || "Add a headline so Trailgrad can frame your rounds."}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <HeroChip icon={Target} label={role?.label ?? "No role set"} muted={!role} />
            <HeroChip icon={BarChart3} label={level?.label ?? "No level set"} muted={!level} />
          </div>
        </div>

        {/* One illustration per experience level, so the header says something
            about the candidate rather than being decoration. */}
        <LevelArtwork level={profile.level} className="mx-auto hidden h-60 w-[19rem] lg:block" />
      </div>
    </header>
  );
}

function AboutCard({ profile }: { profile: CandidateProfileInput }) {
  return (
    <ViewCard icon={UserRound} tone="sky" title="About me" pattern="grid">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
        <div>
          <p className="max-w-[64ch] text-base leading-8 text-cream/72">
            {profile.context ||
              "Nothing here yet. Describe the systems you built and what you owned."}
          </p>

          {profile.focusAreas.length ? (
            <>
              <p className="mt-6 text-sm font-semibold text-cream/82">Core focus areas</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.focusAreas.map((area) => (
                  <span key={area} className="pill px-3.5 py-1.5 text-xs text-cream/72">
                    {area}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </ViewCard>
  );
}

function ProfileSignalDeck({
  profile,
  saved
}: {
  profile: CandidateProfileInput;
  saved: CandidateProfile;
}) {
  // Only the resume has a genuine percentage — the parser's own confidence.
  // Stories and focus areas are counts; the previous tiles divided them by an
  // invented target (4 and 6) to manufacture a ring, which implied goals this
  // product never sets.
  const confidence = saved.resume ? Math.max(0, Math.min(100, saved.resume.confidence)) : null;

  return (
    <section className="profile-motion mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <article className="surface flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[#a9f0cd]">
            <ShieldCheck size={15} aria-hidden="true" />
            <p className="blueprint-label">Resume</p>
          </div>
          <p className="mt-3 text-[2rem] font-semibold leading-none tracking-tight text-cream">
            {saved.resume ? "Verified" : "Missing"}
          </p>
          <p className="mt-2 text-[13px] text-cream/45">
            {confidence === null ? "Upload to ground your answers" : "Parser confidence"}
          </p>
        </div>
        <PercentRing value={confidence} color="#9be8c1" />
      </article>

      <CountTile
        icon={BriefcaseBusiness}
        tone="amber"
        label="Stories"
        value={profile.stories.length}
        helper="banked examples"
      />
      <CountTile
        icon={Sparkles}
        tone="sky"
        label="Focus areas"
        value={profile.focusAreas.length}
        helper="what Maya presses on"
      />
    </section>
  );
}

function EditMemoryPreview({
  profile,
  saved
}: {
  profile: CandidateProfileInput;
  saved: CandidateProfile;
}) {
  const name = saved.resume?.fullName?.trim() || "Candidate";
  const role = roleOptions.find((option) => option.value === profile.targetRole);
  const Icon = role?.icon ?? Target;
  const items = [
    { label: "Role", ready: Boolean(profile.targetRole), icon: Icon },
    { label: "Context", ready: profile.context.length > 120, icon: FileText },
    { label: "Focus", ready: profile.focusAreas.length >= 3, icon: Sparkles },
    { label: "Stories", ready: profile.stories.length >= 1, icon: BriefcaseBusiness }
  ];

  return (
    <section className="profile-motion surface relative mt-5 overflow-hidden p-5 sm:p-6">
      <CardPattern variant="grid" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
        <div className="flex items-center gap-5">
          <div className="relative h-28 w-36 shrink-0" aria-hidden>
            <span className="absolute left-10 top-1/2 h-1 w-20 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#9be8c1]/65 via-cream/30 to-[#7ea0ff]/70" />
            <ProfileAvatar
              name={name}
              className="absolute left-0 top-3 h-20 w-20 rounded-full shadow-[0_18px_44px_-24px_rgba(5,14,45,0.95)]"
            />
            <span className="absolute right-0 top-5 grid h-20 w-20 place-items-center rounded-[1.6rem] bg-cream text-blueprint shadow-[0_22px_48px_-30px_rgba(239,232,214,0.75)]">
              <Icon size={28} />
            </span>
          </div>

          <div className="min-w-0">
            <p className="blueprint-label text-cream/32">Memory map</p>
            <h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight text-cream">
              Clean inputs, sharper questions.
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-cream/45">
              This strip simply shows which parts of your interview profile are ready.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div key={item.label} className="rounded-3xl bg-white/[0.045] p-4 shadow-soft-inset">
                <span
                  className={[
                    "grid h-10 w-10 place-items-center rounded-2xl",
                    item.ready ? "bg-[#71d6a5]/18 text-[#b5efd2]" : "bg-white/[0.06] text-cream/35"
                  ].join(" ")}
                >
                  <ItemIcon size={17} />
                </span>
                <p className="mt-4 text-sm font-semibold text-cream">{item.label}</p>
                <p className="mt-1 text-xs text-cream/38">{item.ready ? "Ready" : "Needs input"}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** A real ring: one track, one arc — no conic-gradient approximation. */
function PercentRing({ value, color }: { value: number | null; color: string }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const pct = value ?? 0;

  return (
    <span className="relative grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="rgba(239,232,214,0.12)"
          strokeWidth="5"
        />
        {value === null ? null : (
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (circumference * pct) / 100}
          />
        )}
      </svg>
      <span className="absolute text-[15px] font-semibold tabular-nums text-cream">
        {value === null ? "\u2014" : `${value}%`}
      </span>
    </span>
  );
}

/** Counts get their colour on the icon, not a slab around it. */
function CountTile({
  icon: Icon,
  tone,
  label,
  value,
  helper
}: {
  icon: typeof Target;
  tone: "mint" | "amber" | "sky";
  label: string;
  value: number;
  helper: string;
}) {
  const ink =
    tone === "mint" ? "text-[#a9f0cd]" : tone === "amber" ? "text-[#f7e3ae]" : "text-[#cfdcff]";
  return (
    <article className="surface p-5">
      <div className={`flex items-center gap-2 ${ink}`}>
        <Icon size={15} aria-hidden="true" />
        <p className="blueprint-label">{label}</p>
      </div>
      <p className="mt-3 text-[2rem] font-semibold leading-none tracking-tight text-cream">
        {value}
      </p>
      <p className="mt-2 text-[13px] text-cream/45">{helper}</p>
    </article>
  );
}

function RoleEmblem({
  role,
  level
}: {
  role?: (typeof roleOptions)[number];
  level?: (typeof levelOptions)[number];
}) {
  const Icon = role?.icon ?? Target;
  const levelIndex = Math.max(
    0,
    levelOptions.findIndex((option) => option.value === level?.value)
  );

  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl bg-white/[0.045] p-5 shadow-soft-inset">
      <CardPattern variant="dots" />
      <div className="relative flex items-center gap-4">
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-cream text-blueprint shadow-[0_20px_42px_-24px_rgba(239,232,214,0.7)]">
          <Icon size={30} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cream/35">Target</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-cream">
            {role?.label ?? "Choose role"}
          </p>
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {levelOptions.map((option, index) => (
              <span
                key={option.value}
                className={[
                  "h-2 rounded-full transition",
                  index <= levelIndex && level ? "bg-[#9be8c1]" : "bg-white/[0.09]"
                ].join(" ")}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-cream/42">
            {level?.detail ?? "Set your experience level"}
          </p>
        </div>
      </div>
    </div>
  );
}

function VerifiedResumeCard({
  resume,
  onOpen
}: {
  resume: CandidateProfile["resume"];
  onOpen: () => void;
}) {
  return (
    <ViewCard
      icon={ShieldCheck}
      tone="mint"
      pattern="rings"
      title={resume ? "Verified resume" : "No resume yet"}
      action={
        resume ? (
          <button
            type="button"
            onClick={onOpen}
            className="pill inline-flex h-10 shrink-0 items-center gap-2 !rounded-xl px-4 text-xs font-semibold text-cream/80 transition hover:bg-white/[0.13] hover:text-cream"
          >
            <Eye size={14} /> View resume
          </button>
        ) : undefined
      }
    >
      {resume ? (
        <>
          <div className="flex items-center gap-3">
            <span className="pill grid h-10 w-10 shrink-0 place-items-center !rounded-xl text-cream/70">
              <FileText size={17} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-cream">{resume.fileName}</p>
              <p className="mt-0.5 text-xs text-cream/40">
                {resume.confidence}% confidence · {formatTimestamp(resume.uploadedAt)}
              </p>
            </div>
          </div>
          <p className="mt-5 flex items-center gap-2.5 rounded-xl bg-[#71d6a5]/[0.13] px-4 py-3 text-xs text-[#b5efd2] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <CircleCheck size={15} className="shrink-0" />
            Your resume is verified and up to date.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm leading-6 text-cream/50">
            Trailgrad asks sharper questions when it can quote your resume.
          </p>
          <Link
            href="/onboarding?replace=resume"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-cream px-4 text-xs font-semibold text-blueprint transition hover:bg-white"
          >
            <Upload size={14} /> Upload resume
          </Link>
        </>
      )}
    </ViewCard>
  );
}

function TargetRoleCard({ profile }: { profile: CandidateProfileInput }) {
  const role = roleOptions.find((option) => option.value === profile.targetRole);
  const level = levelOptions.find((option) => option.value === profile.level);
  const days = daysUntil(profile.targetDate);

  return (
    <ViewCard
      icon={Target}
      tone="sky"
      title="Target role"
      pattern="waves"
      className="relative flex h-full flex-col overflow-hidden"
    >
      <RoleEmblem role={role} level={level} />

      <dl>
        <ViewRow label="Role" value={role ? `${role.label} Developer` : undefined} />
        <ViewRow label="Experience level" value={level?.label} />
        <ViewRow label="Company" value={profile.targetCompany || undefined} />
        <ViewRow
          label="Interview date"
          value={profile.targetDate ? formatDate(profile.targetDate) : undefined}
        />
        <ViewRow
          label="Interview timeline"
          value={days === null ? undefined : days <= 0 ? "This week" : `In ${days} days`}
        />
      </dl>

      <div className="mt-auto pt-6">
        <Link
          href="/interview"
          className="pill relative z-10 inline-flex h-11 w-full items-center justify-center gap-2 !rounded-xl text-xs font-semibold text-cream/80 transition hover:bg-white/[0.13] hover:text-cream"
        >
          <Mic size={14} /> Practice for this role
        </Link>
      </div>

      {/* Signal-wave flourish, matching the audio motif used across the app. */}
      <svg
        aria-hidden
        viewBox="0 0 220 60"
        className="pointer-events-none absolute -bottom-1 right-6 h-16 w-52 opacity-40"
      >
        <path
          d="M0 40 C 40 5, 70 5, 110 34 S 180 60, 220 18"
          fill="none"
          stroke="#7ea0ff"
          strokeOpacity="0.6"
          strokeDasharray="4 6"
        />
      </svg>
      <span className="pointer-events-none absolute bottom-5 right-8 grid h-9 w-9 place-items-center rounded-full bg-[#7ea0ff]/15 shadow-soft-inset">
        <span className="h-2 w-2 rounded-full bg-[#cfdcff]" />
      </span>
    </ViewCard>
  );
}

function SignatureStoryCard({ story }: { story?: CandidateStory }) {
  if (!story?.title) return null;

  return (
    <section className="surface relative mt-5 overflow-hidden p-6 sm:p-7">
      <CardPattern variant="quote" />
      <Quote size={20} className="absolute left-6 top-6 text-cream/25" aria-hidden />
      <div className="px-9">
        <p className="max-w-3xl text-[15px] leading-7 text-cream/78">
          {story.outcome || story.situation}
        </p>
        <p className="mt-2.5 text-xs font-medium text-cream/40">{story.title}</p>
      </div>
      <span className="pill absolute bottom-6 right-6 grid h-10 w-10 place-items-center text-cream/45">
        <Quote size={16} />
      </span>
    </section>
  );
}

function ViewCard({
  icon: Icon,
  tone,
  title,
  action,
  className,
  pattern = "dots",
  children
}: {
  icon: typeof Target;
  tone: keyof typeof statTones;
  title: string;
  action?: React.ReactNode;
  className?: string;
  pattern?: PatternVariant;
  children: React.ReactNode;
}) {
  return (
    <section className={["surface relative overflow-hidden p-6 sm:p-7", className ?? ""].join(" ")}>
      <CardPattern variant={pattern} />
      <div className="relative flex items-center gap-3.5">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${statTones[tone]}`}
        >
          <Icon size={17} />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-cream">
          {title}
        </h2>
        {action}
      </div>
      <div className="relative mt-6 flex-1">{children}</div>
    </section>
  );
}

type PatternVariant = "dots" | "grid" | "rings" | "waves" | "quote";

/**
 * Low-contrast texture so a card of body copy still reads as a designed
 * surface. Purely decorative, and always behind the content.
 */
function CardPattern({ variant }: { variant: PatternVariant }) {
  if (variant === "quote") {
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-10 select-none font-display text-[11rem] leading-none text-white/[0.045]"
      >
        &rdquo;
      </span>
    );
  }

  if (variant === "rings") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="pointer-events-none absolute -bottom-16 -right-14 h-52 w-52 opacity-[0.09]"
      >
        {[40, 62, 84].map((r) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#dce6ff" strokeWidth="1" />
        ))}
        <circle cx="100" cy="100" r="18" fill="#dce6ff" opacity="0.35" />
      </svg>
    );
  }

  if (variant === "waves") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 240 120"
        className="pointer-events-none absolute -bottom-6 -right-6 h-28 w-60 opacity-[0.1]"
      >
        {[0, 14, 28].map((offset) => (
          <path
            key={offset}
            d={`M0 ${70 + offset} C 50 ${20 + offset}, 90 ${110 + offset}, 140 ${60 + offset} S 220 ${10 + offset}, 240 ${50 + offset}`}
            fill="none"
            stroke="#dce6ff"
            strokeWidth="1.2"
          />
        ))}
      </svg>
    );
  }

  const size = variant === "grid" ? "26px 26px" : "18px 18px";
  const image =
    variant === "grid"
      ? "linear-gradient(rgba(220,230,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(220,230,255,0.5) 1px, transparent 1px)"
      : "radial-gradient(rgba(220,230,255,0.6) 1px, transparent 1px)";

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-0 top-0 h-40 w-52 opacity-[0.09]"
      style={{
        backgroundImage: image,
        backgroundSize: size,
        maskImage: "radial-gradient(120% 100% at 100% 0%, #000 30%, transparent 72%)",
        WebkitMaskImage: "radial-gradient(120% 100% at 100% 0%, #000 30%, transparent 72%)"
      }}
    />
  );
}

function ViewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[1.1rem] shadow-[0_1px_0_rgba(255,255,255,0.055)] last:shadow-none">
      <dt className="text-sm text-cream/45">{label}</dt>
      <dd
        className={[
          "min-w-0 truncate text-right text-sm",
          value ? "font-medium text-cream" : "text-cream/30"
        ].join(" ")}
      >
        {value ?? "Not set"}
      </dd>
    </div>
  );
}

const statTones = {
  mint: "bg-[#71d6a5]/16 text-[#a9f0cd] ring-1 ring-inset ring-[#71d6a5]/28",
  sky: "bg-[#7ea0ff]/18 text-[#cfdcff] ring-1 ring-inset ring-[#7ea0ff]/30",
  amber: "bg-[#efcf84]/16 text-[#f7e3ae] ring-1 ring-inset ring-[#efcf84]/30",
  cream: "bg-cream/[0.14] text-cream ring-1 ring-inset ring-cream/25"
} as const;

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
        "pill inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium",
        tone === "mint"
          ? "!bg-[#71d6a5]/16 text-[#b5efd2]"
          : muted
            ? "text-cream/40"
            : "text-cream/78"
      ].join(" ")}
    >
      <Icon size={13} className="shrink-0 opacity-70" />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------- tabs */

function ResumeHero({
  resume,
  onBack
}: {
  resume: CandidateProfile["resume"];
  onBack: () => void;
}) {
  const confidence = resume?.confidence ?? 0;
  const evidenceCount = resume
    ? resume.experience.length + resume.projects.length + resume.education.length
    : 0;

  return (
    <header className="profile-motion surface-raised relative overflow-hidden p-6 sm:p-8 lg:p-10">
      <CardPattern variant="rings" />
      <div
        aria-hidden
        className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#9be8c1]/12 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="pill inline-flex h-10 items-center gap-2 !rounded-xl px-4 text-xs font-semibold text-cream/72 transition hover:bg-white/[0.12] hover:text-cream"
          >
            <ArrowLeft size={14} /> Back to profile
          </button>
          <p className="blueprint-label mt-8 text-cream/35">Resume evidence</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-[1.03] tracking-tight text-cream sm:text-5xl lg:text-6xl">
            Verified proof Maya can question.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-cream/58">
            Every item here is read-only and grounded in the uploaded resume, so interviews stay
            anchored to real evidence.
          </p>
        </div>

        <div className="grid w-full gap-3 sm:w-auto sm:min-w-[24rem] sm:grid-cols-3">
          <ResumeHeroStat label="Confidence" value={resume ? `${confidence}%` : "0%"} tone="mint" />
          <ResumeHeroStat label="Evidence" value={String(evidenceCount)} tone="sky" />
          <ResumeHeroStat
            label="Pages"
            value={resume ? String(resume.document.pageCount) : "0"}
            tone="amber"
          />
        </div>
      </div>

      {resume ? (
        <div className="relative mt-8 grid gap-3 rounded-3xl bg-white/[0.045] p-4 shadow-soft-inset sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cream text-blueprint">
            <FileText size={23} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-cream">{resume.fileName}</p>
            <p className="mt-1 text-xs text-cream/42">
              Verified {formatTimestamp(resume.uploadedAt)}
            </p>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function ResumeHeroStat({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: keyof typeof statTones;
}) {
  return (
    <div className="rounded-3xl bg-white/[0.055] p-4 shadow-soft-inset">
      <span className={`mb-5 grid h-9 w-9 place-items-center rounded-2xl ${statTones[tone]}`}>
        <CircleCheck size={15} />
      </span>
      <p className="text-3xl font-semibold tracking-tight text-cream">{value}</p>
      <p className="mt-1 text-xs font-semibold text-cream/40">{label}</p>
    </div>
  );
}

function ResumeTab({ resume }: { resume: CandidateProfile["resume"] }) {
  if (!resume) {
    return (
      <Card icon={BadgeCheck} title="No verified resume yet">
        <EmptyState
          icon={Upload}
          title="Nothing to show"
          body="Upload a resume and Trailgrad will extract the evidence it can trace back to the document."
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
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(24rem,0.8fr)] xl:items-start">
      <div className="grid gap-5">
        <Card
          icon={BriefcaseBusiness}
          title="Experience timeline"
          subtitle="Every entry was traced back to a line in your file."
          tone="mint"
          size="large"
        >
          {resume.experience.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title="Project-led profile"
              body="No professional role was verified, so Trailgrad anchors rounds to your projects."
            />
          ) : (
            <ol className="grid gap-4">
              {resume.experience.map((entry, index) => (
                <li
                  key={`${entry.organization}-${entry.role}-${index}`}
                  className="relative overflow-hidden rounded-3xl bg-white/[0.04] p-5 shadow-soft-inset sm:p-6"
                >
                  <CardPattern variant="dots" />
                  <div className="relative flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-4">
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#71d6a5]/16 font-mono text-sm font-semibold text-[#b5efd2] shadow-soft-inset">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xl font-semibold tracking-tight text-cream">
                          {entry.role || "Role not listed"}
                        </h3>
                        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.08em] text-cream/42">
                          {entry.organization}
                        </p>
                      </div>
                    </div>
                    {entry.period ? (
                      <span className="pill px-3 py-1.5 font-mono text-[12px] text-cream/60">
                        {entry.period}
                      </span>
                    ) : null}
                  </div>
                  {entry.summary ? (
                    <p className="relative mt-5 max-w-3xl text-sm leading-7 text-cream/58">
                      {entry.summary}
                    </p>
                  ) : null}
                  {entry.achievements.length ? (
                    <ul className="relative mt-5 grid gap-2.5">
                      {entry.achievements.map((achievement) => (
                        <li
                          key={achievement}
                          className="flex gap-3 rounded-2xl bg-white/[0.035] px-4 py-3 text-sm leading-6 text-cream/66 shadow-soft-inset"
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9be8c1]/70" />
                          {achievement}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {entry.skills.length ? (
                    <div className="relative mt-5 flex flex-wrap gap-2">
                      {entry.skills.slice(0, 8).map((skill) => (
                        <Tag key={skill}>{skill}</Tag>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card
          icon={Sparkles}
          tone="sky"
          title="Supported skills"
          subtitle={`${resume.skills.length} found`}
          size="large"
        >
          <div className="flex flex-wrap gap-2.5">
            {resume.skills.map((skill) => (
              <Tag key={skill}>{skill}</Tag>
            ))}
            {resume.skills.length === 0 ? (
              <p className="text-xs text-cream/38">None extracted.</p>
            ) : null}
          </div>
        </Card>

        {resume.projects.length ? (
          <Card icon={Blocks} title="Named projects" size="large">
            <div className="grid gap-3 sm:grid-cols-2">
              {resume.projects.map((project) => (
                <div
                  key={project.name}
                  className="rounded-3xl bg-white/[0.04] p-5 shadow-soft-inset"
                >
                  <p className="text-lg font-semibold text-cream">{project.name}</p>
                  <p className="mt-2 line-clamp-4 text-sm leading-6 text-cream/50">
                    {project.outcome || project.summary}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {resume.achievements.length ? (
          <Card icon={Quote} title="Quoted from your resume" size="large">
            <ul className="grid gap-3">
              {resume.achievements.map((achievement) => (
                <li
                  key={achievement}
                  className="rounded-3xl bg-white/[0.04] px-5 py-4 text-base leading-7 text-cream/66 shadow-soft-inset"
                >
                  {achievement}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-5">
        <DocumentSummaryCard resume={resume} />

        {resume.education.length ? (
          <Card icon={GraduationCap} tone="mint" title="Education" size="large">
            <div className="grid gap-3">
              {resume.education.map((entry) => (
                <div
                  key={`${entry.institution}-${entry.credential}`}
                  className="rounded-3xl bg-white/[0.04] p-5 shadow-soft-inset"
                >
                  <p className="text-lg font-semibold text-cream">
                    {entry.credential || entry.field || "Programme"}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold uppercase tracking-[0.08em] text-cream/42">
                    {entry.institution}
                  </p>
                  {entry.period ? (
                    <p className="mt-3 font-mono text-[12px] text-cream/48">{entry.period}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {resume.warnings.length ? (
          <div className="surface overflow-hidden p-6">
            <CardPattern variant="waves" />
            <p className="relative flex items-center gap-3 text-lg font-semibold text-[#f4dda6]">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#efcf84]/15 text-[#f4dda6]">
                <TriangleAlert size={18} />
              </span>
              Trailgrad will challenge these
            </p>
            <ul className="relative mt-5 grid gap-3">
              {resume.warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex gap-3 rounded-2xl bg-[#efcf84]/[0.055] px-4 py-3 text-sm leading-6 text-cream/58 shadow-soft-inset"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#efcf84]" />
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

function DocumentSummaryCard({ resume }: { resume: NonNullable<CandidateProfile["resume"]> }) {
  const stats = [
    { label: "Experience", value: resume.experience.length, icon: BriefcaseBusiness, tone: "mint" },
    { label: "Projects", value: resume.projects.length, icon: Blocks, tone: "sky" },
    { label: "Education", value: resume.education.length, icon: GraduationCap, tone: "amber" }
  ] as const;

  return (
    <Card icon={FileText} title="Document" size="large">
      <div className="relative overflow-hidden rounded-3xl bg-white/[0.045] p-5 shadow-soft-inset">
        <CardPattern variant="grid" />
        <div className="relative flex items-start gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-cream text-blueprint">
            <FileText size={25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-semibold tracking-tight text-cream">
              {resume.fileName}
            </p>
            <p className="mt-1.5 text-sm text-cream/45">
              Verified {formatTimestamp(resume.uploadedAt)}
            </p>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3">
          <ResumeMetric label="Confidence" value={`${resume.confidence}%`} />
          <ResumeMetric
            label={resume.document.pageCountEstimated ? "Pages est." : "Pages"}
            value={String(resume.document.pageCount)}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-3xl bg-white/[0.04] p-4 shadow-soft-inset">
            <span
              className={`grid h-10 w-10 place-items-center rounded-2xl ${statTones[stat.tone]}`}
            >
              <stat.icon size={17} />
            </span>
            <p className="mt-4 text-2xl font-semibold text-cream">{stat.value}</p>
            <p className="mt-1 text-xs font-semibold text-cream/40">{stat.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ResumeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-4 shadow-soft-inset">
      <p className="text-2xl font-semibold text-cream">{value}</p>
      <p className="mt-1 text-xs text-cream/38">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

function Card({
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
  action?: React.ReactNode;
  tone?: keyof typeof statTones;
  size?: "default" | "large";
  children: React.ReactNode;
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

function Tag({ children, size = "md" }: { children: React.ReactNode; size?: "sm" | "md" }) {
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
      <div className="flex flex-col gap-3 rounded-3xl bg-[#132a68]/92 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_24px_70px_rgba(7,18,58,0.55)] backdrop-blur-2xl sm:flex-row sm:items-center">
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

function SavedFooter() {
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

/* ----------------------------------------------------------------- helpers */

function toInput(profile: CandidateProfile): CandidateProfileInput {
  const { targetRole, level, targetCompany, targetDate, headline, context, focusAreas, stories } =
    profile;
  return { targetRole, level, targetCompany, targetDate, headline, context, focusAreas, stories };
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
