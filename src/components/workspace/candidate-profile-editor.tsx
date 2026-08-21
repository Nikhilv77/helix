"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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
  MessageCircle,
  PackageCheck,
  Pencil,
  Plus,
  Quote,
  Save,
  Sparkles,
  Target,
  Trash2,
  TriangleAlert,
  Upload,
  X
} from "lucide-react";
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

const focusAreaDetails: Record<string, string> = {
  "Technical depth": "Explain tradeoffs, internals, and why your approach works.",
  "System design": "Turn vague requirements into practical architecture decisions.",
  Coding: "Solve cleanly, reason out loud, and keep edge cases visible.",
  Communication: "Make your thinking easy to follow under interview pressure.",
  Ownership: "Show scope, accountability, and how you moved work forward.",
  Impact: "Connect your work to outcomes, metrics, and product value.",
  Leadership: "Show judgment, leverage, and how you raised the team bar.",
  "Behavioral stories": "Defend real examples with situation, action, and result."
};

const focusAreaIcons: Record<string, typeof Code2> = {
  "Technical depth": BrainCircuit,
  "System design": Blocks,
  Coding: Code2,
  Communication: MessageCircle,
  Ownership: BriefcaseBusiness,
  Impact: BarChart3,
  Leadership: Target,
  "Behavioral stories": Quote
};

/** One input treatment for the page, so nothing drifts field to field. */
const fieldClass =
  "w-full rounded-xl bg-[#1a1b1f] text-cream outline-none ring-1 ring-inset ring-white/[0.08] transition placeholder:text-cream/35 hover:bg-[#202126] focus:bg-[#202126] focus:ring-2 focus:ring-[#F26E01]/30";

const profileAvatars = [
  {
    src: "/images/profile/avatars/avatar-01.jpg",
    displaySrc: "/images/profile/avatars/avatar-01.jpg?v=7bc1f6d0",
    width: 1024,
    height: 1024
  },
  {
    src: "/images/profile/avatars/avatar-02.jpg",
    displaySrc: "/images/profile/avatars/avatar-02.jpg?v=8f147db2",
    width: 1024,
    height: 1024
  },
  {
    src: "/images/profile/avatars/avatar-03.jpg",
    displaySrc: "/images/profile/avatars/avatar-03.jpg?v=54f51d79",
    width: 1024,
    height: 1024
  },
  {
    src: "/images/profile/avatars/avatar-04.jpg",
    displaySrc: "/images/profile/avatars/avatar-04.jpg?v=62bce4f4",
    width: 1024,
    height: 1024
  },
  {
    src: "/images/profile/avatars/avatar-05.jpg",
    displaySrc: "/images/profile/avatars/avatar-05.jpg?v=bf8776bd",
    width: 1024,
    height: 1024
  }
] as const;

const profileCovers = [
  {
    src: "/images/profile/covers/cover-1.png",
    displaySrc: "/images/profile/covers/cover-1.png?v=2441142822",
    width: 1809,
    height: 293
  },
  {
    src: "/images/profile/covers/cover-2.png",
    displaySrc: "/images/profile/covers/cover-2.png?v=1093722193",
    width: 1809,
    height: 256
  },
  {
    src: "/images/profile/covers/cover-3.png",
    displaySrc: "/images/profile/covers/cover-3.png?v=778074622",
    width: 1808,
    height: 264
  },
  {
    src: "/images/profile/covers/cover-4.png",
    displaySrc: "/images/profile/covers/cover-4.png?v=2319454375",
    width: 1809,
    height: 292
  },
  {
    src: "/images/profile/covers/cover-5.png",
    displaySrc: "/images/profile/covers/cover-5.png?v=3937398326",
    width: 1806,
    height: 266
  },
  {
    src: "/images/profile/covers/cover-6.png",
    displaySrc: "/images/profile/covers/cover-6.png?v=3544170912",
    width: 1803,
    height: 293
  },
  {
    src: "/images/profile/covers/cover-7.png",
    displaySrc: "/images/profile/covers/cover-7.png?v=1044505713",
    width: 1805,
    height: 273
  },
  {
    src: "/images/profile/covers/cover-8.png",
    displaySrc: "/images/profile/covers/cover-8.png?v=1232424449",
    width: 1806,
    height: 268
  }
] as const;

function hashProfileSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function CandidateProfileEditor({ initialProfile }: { initialProfile: CandidateProfile }) {
  const [profile, setProfile] = useState<CandidateProfileInput>(toInput(initialProfile));
  const [saved, setSaved] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "resume">("view");
  const [imagePicker, setImagePicker] = useState<"cover" | "avatar" | null>(null);
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

  useEffect(() => {
    if (mode !== "view" || saved.profileImage || saving || imagePicker) return;

    const timer = window.setTimeout(() => setImagePicker("avatar"), 520);
    return () => window.clearTimeout(timer);
  }, [imagePicker, mode, saved.profileImage, saving]);

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

  async function saveImagePatch(patch: Partial<CandidateProfileInput>) {
    const nextInput = { ...profile, ...patch };
    setProfile(nextInput);
    setImagePicker(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSaving(true);
    setError(null);

    try {
      const next = await saveProfile(nextInput);
      setSaved(next);
      setProfile(toInput(next));
    } catch (caught) {
      setProfile(toInput(saved));
      setError(
        caught instanceof ApiClientError ? caught.message : "Your profile image could not be saved."
      );
    } finally {
      setSaving(false);
    }
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
      <div className="profile-theme w-full max-w-none px-0 py-0 pb-16 sm:px-3 sm:pt-2 lg:px-3">
        <ProfileHero
          profile={profile}
          saved={saved}
          onCoverEdit={() => setImagePicker("cover")}
          onAvatarEdit={() => setImagePicker("avatar")}
        />

        <ImagePickerOverlay
          open={imagePicker}
          profile={profile}
          error={error}
          requireAvatar={!saved.profileImage && imagePicker === "avatar"}
          onClose={() => {
            setImagePicker(null);
            setError(null);
          }}
          onCoverChange={(coverImage) => void saveImagePatch({ coverImage })}
          onAvatarChange={(profileImage) => void saveImagePatch({ profileImage })}
        />

        <SignatureStoryCard story={profile.stories[0]} />
      </div>
    );
  }

  if (mode === "resume") {
    return (
      <div className="profile-theme w-full max-w-none px-0 py-0 pb-16 sm:px-3 sm:pt-2 lg:px-3">
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
    <div className="profile-theme w-full max-w-none px-0 py-0 pb-36 sm:px-3 sm:pt-2 lg:px-3">
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
            id="appearance"
            icon={Eye}
            tone="mint"
            title="Appearance"
            hint="Choose the cover image for your profile."
          >
            <FieldBlock label="Cover image" hint="This appears at the top of your profile.">
              <CoverPicker
                value={profile.coverImage}
                onChange={(coverImage) => update({ coverImage })}
              />
            </FieldBlock>

            <FieldBlock label="Profile image" hint="This appears as your profile avatar.">
              <AvatarPicker
                value={profile.profileImage}
                onChange={(profileImage) => update({ profileImage })}
              />
            </FieldBlock>
          </EditSection>

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
  { id: "appearance", label: "Appearance", icon: Eye },
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

function CoverPicker({
  value,
  onChange
}: {
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {profileCovers.map((cover, index) => {
        const selected = value === cover.src;

        return (
          <button
            key={cover.src}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(cover.src)}
            className={[
              "group relative overflow-hidden rounded-2xl bg-white/[0.055] p-1.5 text-left outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-cream/60",
              selected
                ? "ring-2 ring-cream/82"
                : "ring-1 ring-cream/10 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:ring-cream/28"
            ].join(" ")}
          >
            <span
              className="relative block overflow-hidden rounded-xl bg-[#1a1b1f]"
              style={{ aspectRatio: `${cover.width} / ${cover.height}` }}
            >
              <img
                src={cover.displaySrc}
                alt=""
                width={cover.width}
                height={cover.height}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span
                aria-hidden
                className={[
                  "absolute inset-0 transition",
                  selected ? "bg-black/[0.04]" : "bg-black/[0.2] group-hover:bg-black/[0.06]"
                ].join(" ")}
              />
              {selected ? (
                <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-cream text-blueprint">
                  <Check size={14} />
                </span>
              ) : null}
            </span>
            <span
              className={[
                "mt-2 flex items-center justify-between px-1 text-xs font-semibold",
                selected ? "text-cream" : "text-cream/46"
              ].join(" ")}
            >
              <span>Cover {index + 1}</span>
              <span className="font-mono text-[10px] text-cream/35">
                {cover.width}x{cover.height}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AvatarPicker({
  value,
  onChange
}: {
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {profileAvatars.map((avatar, index) => {
        const selected = value === avatar.src;

        return (
          <button
            key={avatar.src}
            type="button"
            aria-label={`Choose profile image ${index + 1}`}
            aria-pressed={selected}
            onClick={() => onChange(avatar.src)}
            className={[
              "group relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-cream p-0.5 outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-cream/60 sm:h-24 sm:w-24",
              selected
                ? "ring-2 ring-cream/82"
                : "ring-1 ring-cream/10 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:ring-cream/28"
            ].join(" ")}
          >
            <img
              src={avatar.displaySrc}
              alt=""
              width={avatar.width}
              height={avatar.height}
              className="h-full w-full rounded-full object-cover object-center"
            />
            {selected ? (
              <span className="absolute -right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-cream text-blueprint">
                <Check size={14} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function ImagePickerOverlay({
  open,
  profile,
  error,
  requireAvatar = false,
  onClose,
  onCoverChange,
  onAvatarChange
}: {
  open: "cover" | "avatar" | null;
  profile: CandidateProfileInput;
  error: string | null;
  requireAvatar?: boolean;
  onClose: () => void;
  onCoverChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const choosingCover = open === "cover";

  return createPortal(
    <div
      className={[
        "image-picker-backdrop-slow",
        "fixed inset-0 z-[1000] flex min-h-dvh items-center justify-center bg-[#01030a]/64 px-4 py-6 backdrop-blur-sm"
      ].join(" ")}
    >
      {requireAvatar ? null : (
        <button
          type="button"
          aria-label="Close image picker"
          onClick={onClose}
          className="absolute inset-0 cursor-default"
        />
      )}
      <section
        className={[
          "image-picker-panel-slow",
          "relative w-full overflow-hidden rounded-2xl border border-white/[0.1] bg-[#17181b] text-cream shadow-[0_28px_90px_-48px_rgba(0,0,0,0.9)]",
          choosingCover
            ? "max-h-[min(50rem,calc(100dvh-2rem))] max-w-6xl"
            : "max-h-[min(36rem,calc(100dvh-2rem))] max-w-3xl"
        ].join(" ")}
      >
        <div className="relative flex items-center justify-center px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
          <div className="max-w-xl text-center">
            <h2 className="text-2xl font-medium text-cream sm:text-3xl">
              {choosingCover ? "Pick your cover" : "Pick your avatar"}
            </h2>
            {requireAvatar ? (
              <p className="mt-2 text-sm leading-6 text-cream/58">
                Choose the profile image you want Trailgrad to use across your workspace.
              </p>
            ) : null}
          </div>
          {requireAvatar ? null : (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 grid h-9 w-9 shrink-0 place-items-center rounded-full text-cream/60 transition hover:bg-cream/[0.08] hover:text-cream"
              aria-label="Close image picker"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div
          className={[
            "thin-scroll overflow-y-auto px-5 pb-6 pt-4 sm:px-6",
            choosingCover
              ? "max-h-[calc(min(50rem,100dvh-2rem)-5.25rem)]"
              : "max-h-[calc(min(36rem,100dvh-2rem)-5.25rem)]"
          ].join(" ")}
        >
          {choosingCover ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {profileCovers.map((cover, index) => {
                const selected = profile.coverImage === cover.src;
                return (
                  <button
                    key={cover.src}
                    type="button"
                    aria-label={`Choose cover ${index + 1}`}
                    aria-pressed={selected}
                    onClick={() => onCoverChange(cover.src)}
                    style={{ "--choice-delay": `${70 + index * 34}ms` } as CSSProperties}
                    className={[
                      "image-picker-choice",
                      "group relative overflow-hidden rounded-2xl bg-cream/[0.035] p-1.5 outline-none transition duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cream/45",
                      selected ? "ring-1 ring-cream/42" : "ring-1 ring-cream/8 hover:ring-cream/20"
                    ].join(" ")}
                  >
                    <span className="relative block aspect-[3.2/1] overflow-hidden rounded-xl bg-[#1a1b1f] sm:aspect-[4/1]">
                      <img
                        src={cover.displaySrc}
                        alt=""
                        width={cover.width}
                        height={cover.height}
                        className="absolute inset-0 h-full w-full object-cover object-center"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 bg-[#030712]/0 transition group-hover:bg-[#030712]/28"
                      />
                      {selected ? (
                        <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-cream text-blueprint">
                          <Check size={14} />
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              {profileAvatars.map((avatar, index) => {
                const selected = profile.profileImage === avatar.src;
                return (
                  <button
                    key={avatar.src}
                    type="button"
                    aria-label={`Choose avatar ${index + 1}`}
                    aria-pressed={selected}
                    onClick={() => onAvatarChange(avatar.src)}
                    style={{ "--choice-delay": `${90 + index * 38}ms` } as CSSProperties}
                    className={[
                      "image-picker-choice",
                      "group relative grid h-[5.5rem] w-[5.5rem] place-items-center overflow-hidden rounded-full bg-cream p-0.5 outline-none transition duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cream/45 sm:h-[6.5rem] sm:w-[6.5rem]",
                      selected ? "ring-1 ring-cream/46" : "ring-1 ring-cream/10 hover:ring-cream/24"
                    ].join(" ")}
                  >
                    <img
                      src={avatar.displaySrc}
                      alt=""
                      width={avatar.width}
                      height={avatar.height}
                      className="h-full w-full rounded-full object-cover object-center"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-[#030712]/0 transition group-hover:bg-[#030712]/26"
                    />
                    {selected ? (
                      <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-cream text-blueprint">
                        <Check size={12} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {error ? <p className="mt-4 text-sm text-[#ffb2b2]">{error}</p> : null}
        </div>
      </section>
    </div>,
    document.body
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
  onCoverEdit,
  onAvatarEdit
}: {
  profile: CandidateProfileInput;
  saved: CandidateProfile;
  onCoverEdit: () => void;
  onAvatarEdit: () => void;
}) {
  const resume = saved.resume;
  const name = resume?.fullName?.trim() || "Your interview profile";
  const role = roleOptions.find((option) => option.value === profile.targetRole);
  const level = levelOptions.find((option) => option.value === profile.level);
  const profileSeed = hashProfileSeed(
    [name, profile.headline, profile.targetRole, profile.level, resume?.fileName]
      .filter(Boolean)
      .join("|") || "trailgrad-profile"
  );
  const selectedAvatar = profileAvatars.find((avatar) => avatar.src === profile.profileImage);
  const avatar =
    selectedAvatar ?? profileAvatars[profileSeed % profileAvatars.length] ?? profileAvatars[0];
  const selectedCover = profileCovers.find((cover) => cover.src === profile.coverImage);
  const cover =
    selectedCover ??
    profileCovers[Math.floor(profileSeed / profileAvatars.length) % profileCovers.length] ??
    profileCovers[0];

  return (
    <header className="profile-motion relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#151619]">
      <div
        className="profile-cover-stage relative min-h-36 overflow-hidden bg-[#111214] sm:min-h-44"
        style={{ aspectRatio: `${cover.width} / ${cover.height}` }}
      >
        <img
          key={cover.src}
          src={cover.displaySrc}
          alt=""
          width={cover.width}
          height={cover.height}
          className="profile-cover-image profile-cover-image-change absolute inset-0 h-full w-full object-cover object-center"
        />
        <span
          key={`${cover.src}-sweep`}
          aria-hidden="true"
          className="profile-cover-change-sweep pointer-events-none absolute inset-0"
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-10 w-full text-[#151619] sm:h-14"
          viewBox="0 0 1440 72"
          preserveAspectRatio="none"
        >
          <path
            d="M0 36 C 126 58, 238 16, 360 36 C 488 57, 590 28, 710 40 C 842 54, 934 18, 1068 34 C 1210 52, 1320 30, 1440 42 L1440 72 L0 72 Z"
            fill="currentColor"
          />
          <path
            d="M0 35 C 126 57, 238 15, 360 35 C 488 56, 590 27, 710 39 C 842 53, 934 17, 1068 33 C 1210 51, 1320 29, 1440 41"
            fill="none"
            stroke="rgba(241,234,216,0.28)"
            strokeWidth="1.05"
          />
        </svg>
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/0" />
        <button
          type="button"
          aria-label="Change cover image"
          onClick={onCoverEdit}
          className="group absolute inset-0 z-10 flex items-center justify-center overflow-hidden outline-none"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[#030712]/0 backdrop-blur-0 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:bg-[#030712]/42 group-hover:backdrop-blur-[2px] group-focus-visible:bg-[#030712]/42 group-focus-visible:backdrop-blur-[2px]"
          />
          <span className="relative grid h-14 w-14 scale-75 place-items-center text-cream opacity-0 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100">
            <Pencil
              size={34}
              strokeWidth={1.65}
              className="drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]"
            />
          </span>
        </button>
      </div>

      <div className="relative px-5 pb-4 sm:px-7 sm:pb-5 lg:px-8">
        <ProfileHeroSidePatterns />
        <div className="-mt-14 flex flex-col items-center text-center sm:-mt-16">
          <button
            type="button"
            aria-label="Change profile image"
            onClick={onAvatarEdit}
            className="profile-avatar-orbit group relative z-20 grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-full bg-cream p-0.5 outline-none transition focus-visible:ring-2 focus-visible:ring-cream/70 sm:h-32 sm:w-32"
          >
            <span aria-hidden className="absolute -inset-2 rounded-full bg-cream/10" />
            <span aria-hidden className="profile-avatar-ring absolute -inset-1 rounded-full" />
            <img
              key={avatar.src}
              src={avatar.displaySrc}
              alt=""
              width={avatar.width}
              height={avatar.height}
              className="profile-avatar-image-change relative h-full w-full rounded-full object-cover object-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
            />
            <span
              key={`${avatar.src}-pulse`}
              aria-hidden="true"
              className="profile-avatar-change-pulse pointer-events-none absolute -inset-2 rounded-full"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-[#030712]/0 shadow-[inset_0_0_0_2px_rgba(3,7,18,0)] backdrop-blur-0 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:bg-[#030712]/48 group-hover:shadow-[inset_0_0_0_2px_rgba(3,7,18,0.48)] group-hover:backdrop-blur-[1.5px] group-focus-visible:bg-[#030712]/48 group-focus-visible:shadow-[inset_0_0_0_2px_rgba(3,7,18,0.48)] group-focus-visible:backdrop-blur-[1.5px]"
            />
            <span className="absolute grid h-12 w-12 scale-75 place-items-center text-cream opacity-0 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100">
              <Pencil
                size={30}
                strokeWidth={1.65}
                className="drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)]"
              />
            </span>
          </button>

          <div className="mt-3 flex w-full flex-col items-center">
            <p className="border-b border-cream/31 pb-1 text-base font-medium text-cream/72">
              <AnimatedProfileWords text="Interview profile" delay={720} />
            </p>
            <h1 className="mt-1.5 flex max-w-full items-center justify-center gap-2.5 text-center text-3xl font-semibold tracking-tight text-cream sm:text-[2.25rem]">
              <span className="min-w-0 truncate">
                <AnimatedProfileWords text={name} delay={900} />
              </span>
              {resume ? (
                <BadgeCheck
                  size={23}
                  className="profile-badge-pop shrink-0 text-[#9be8c1]"
                  aria-label="Verified"
                />
              ) : null}
            </h1>
            <p className="mt-2 max-w-3xl text-center text-sm leading-6 text-cream/58 sm:text-[15px]">
              <AnimatedProfileWords
                text={profile.headline || "Add a headline so Trailgrad can frame your rounds."}
                delay={1240}
                copy
              />
            </p>

            <div
              className="step-in mt-3.5 flex flex-wrap justify-center gap-2.5"
              style={{ "--step-delay": "1540ms" } as CSSProperties}
            >
              <HeroChip icon={Target} label={role?.label ?? "No role set"} muted={!role} />
              <HeroChip icon={BarChart3} label={level?.label ?? "No level set"} muted={!level} />
            </div>

            <div
              className="profile-soft-reveal mt-8 h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-cream/22 to-transparent"
              style={{ "--profile-reveal-delay": "1660ms" } as CSSProperties}
            />

            <div className="mt-7 max-w-4xl">
              <p className="text-base leading-8 text-cream/66 sm:text-lg">
                <AnimatedProfileWords
                  text={
                    profile.context ||
                    "Add a short profile summary so Maya can shape interviews around your real work."
                  }
                  delay={1760}
                  copy
                />
              </p>
            </div>

            {profile.focusAreas.length ? (
              <div className="mt-8 w-full max-w-[82rem]">
                <div
                  className="profile-soft-reveal mx-auto mb-8 h-px w-[calc(100%-2rem)] max-w-6xl bg-gradient-to-r from-transparent via-cream/30 to-transparent"
                  style={{ "--profile-reveal-delay": "2100ms" } as CSSProperties}
                />
                <p
                  className="profile-soft-reveal inline-flex border-b border-cream/42 pb-1 text-base font-medium text-cream/72"
                  style={{ "--profile-reveal-delay": "2180ms" } as CSSProperties}
                >
                  Core focus areas
                </p>
                <div className="relative mx-auto mt-5 grid w-full max-w-5xl gap-0 sm:grid-cols-2">
                  {profile.focusAreas.map((area, index) => {
                    const FocusIcon = focusAreaIcons[area] ?? Sparkles;
                    const isUnpairedLastItem =
                      profile.focusAreas.length % 2 === 1 &&
                      index === profile.focusAreas.length - 1;
                    return (
                      <article
                        key={area}
                        className={[
                          "profile-soft-reveal group relative flex min-h-[6.5rem] items-center gap-4 px-5 py-4 text-left transition-colors duration-200 after:pointer-events-none after:absolute after:inset-x-5 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/[0.18] after:to-transparent hover:bg-white/[0.025] sm:min-h-[6.75rem] sm:px-8 sm:py-5 sm:after:inset-x-8 even:sm:pl-12",
                          isUnpairedLastItem ? "sm:col-span-2 sm:mx-auto sm:w-1/2" : ""
                        ].join(" ")}
                        style={
                          { "--profile-reveal-delay": `${2280 + index * 65}ms` } as CSSProperties
                        }
                      >
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/[0.13] text-[#F26E01] transition-colors duration-200 group-hover:border-[#F26E01]/45">
                          <FocusIcon size={24} strokeWidth={1.45} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-[1.1rem] font-medium leading-tight text-cream sm:text-[1.25rem]">
                            {area}
                          </h3>
                          <p className="mt-2 max-w-[28rem] text-[13px] leading-5 text-cream/58 sm:text-sm sm:leading-5.5">
                            {focusAreaDetails[area] ??
                              "Maya will press this signal during practice."}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <blockquote
              className="profile-soft-reveal relative mx-auto mt-9 max-w-2xl px-8 text-center"
              style={
                {
                  "--profile-reveal-delay": `${profile.focusAreas.length ? 2360 + profile.focusAreas.length * 65 : 2180}ms`
                } as CSSProperties
              }
            >
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 text-4xl leading-none text-[#F26E01]/70"
              >
                “
              </span>
              <p className="text-lg font-medium leading-8 text-cream/82 sm:text-xl">
                Grow into a confident {role?.label ?? "professional"}, turning the{" "}
                {level?.label ?? "current"} stage into strong technical judgment and meaningful
                product impact.
              </p>
              <span
                aria-hidden="true"
                className="absolute bottom-0 right-0 text-4xl leading-none text-[#F26E01]/70"
              >
                ”
              </span>
              <footer className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/38">
                Career goal
              </footer>
            </blockquote>

            <ProfileResumeAnchors resume={resume} />
          </div>
        </div>
      </div>
    </header>
  );
}

function AnimatedProfileWords({
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
          className={copy ? "onboarding-word profile-copy-word" : "onboarding-word"}
          style={{ "--word-delay": `${delay + index * 46}ms` } as CSSProperties}
        >
          {word}
          {index < words.length - 1 ? "\u00A0" : ""}
        </span>
      ))}
    </>
  );
}

type ProfileResumeAnchor = {
  id: string;
  badge: string;
  title: string;
  meta?: string;
  body?: string;
  bullets?: string[];
  tags?: string[];
  icon: typeof BriefcaseBusiness;
};

function ProfileResumeAnchors({ resume }: { resume: CandidateProfile["resume"] }) {
  if (!resume) return null;

  const workCount = resume.experience.length;
  const projectCount = resume.projects.length;
  const educationCount = resume.education.length;

  const workCards: ProfileResumeAnchor[] = resume.experience.map((entry, index) => ({
    id: `work-${index}`,
    badge: cleanText(entry.period) || "Experience",
    icon: BriefcaseBusiness,
    title: cleanText(entry.role) || cleanText(entry.organization) || "Work experience",
    meta: joinResumeMeta([entry.organization, entry.period, entry.location]),
    body: cleanText(entry.summary),
    bullets: entry.achievements.map(cleanText).filter(Boolean).slice(0, 3),
    tags: entry.skills.map(cleanText).filter(Boolean).slice(0, 5)
  }));
  const projectCards: ProfileResumeAnchor[] = resume.projects.map((entry, index) => ({
    id: `project-${index}`,
    badge: cleanText(entry.skills[0]) || "Project proof",
    icon: Blocks,
    title: cleanText(entry.name) || "Project",
    meta: cleanText(entry.outcome),
    body: cleanText(entry.summary),
    tags: entry.skills.map(cleanText).filter(Boolean).slice(0, 5)
  }));
  const educationCards: ProfileResumeAnchor[] = resume.education.map((entry, index) => ({
    id: `education-${index}`,
    badge: getEducationBadge(entry.credential),
    icon: GraduationCap,
    title: cleanText(entry.credential) || cleanText(entry.field) || "Education",
    meta: joinResumeMeta([entry.institution, entry.period]),
    body: cleanText(entry.field)
  }));
  const proofCards: ProfileResumeAnchor[] = resume.achievements.length
    ? [
        {
          id: "achievements",
          badge: "Evidence",
          icon: Sparkles,
          title: "Resume highlights",
          body: "Evidence Maya can turn into follow-up questions.",
          bullets: resume.achievements.map(cleanText).filter(Boolean).slice(0, 5)
        }
      ]
    : [];
  const totalCards = [...workCards, ...projectCards, ...educationCards, ...proofCards];

  if (!totalCards.length) return null;

  const summaryCards = [
    {
      label: "Work",
      count: `${workCount} ${workCount === 1 ? "role" : "roles"}`,
      icon: BriefcaseBusiness
    },
    {
      label: "Projects",
      count: `${projectCount} ${projectCount === 1 ? "project" : "projects"}`,
      icon: Blocks
    },
    {
      label: "Education",
      count: `${educationCount} ${educationCount === 1 ? "entry" : "entries"}`,
      icon: GraduationCap
    },
    {
      label: "Proof",
      count: `${resume.achievements.length} ${resume.achievements.length === 1 ? "highlight" : "highlights"}`,
      icon: Sparkles
    }
  ];

  return (
    <section
      className="profile-soft-reveal mt-10 w-full max-w-[82rem] text-left"
      style={{ "--profile-reveal-delay": "2580ms" } as CSSProperties}
    >
      <div className="mx-auto h-px w-[calc(100%-2rem)] max-w-6xl bg-gradient-to-r from-transparent via-cream/30 to-transparent" />

      <div className="mt-7 flex flex-col items-center text-center">
        <p className="inline-flex border-b border-cream/42 pb-1 text-base font-medium text-cream/74">
          Resume anchors
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-cream/58 sm:text-[15px]">
          Maya found the parts of your resume that can become interview questions.
        </p>
      </div>

      <div className="mx-auto mt-7 flex w-full max-w-5xl flex-wrap justify-center divide-y divide-white/[0.12] border-y border-white/[0.1] md:divide-x md:divide-y-0">
        {summaryCards.map((card, index) => (
          <ResumeSummaryTile
            key={card.label}
            label={card.label}
            count={card.count}
            icon={card.icon}
            index={index}
          />
        ))}
      </div>

      <div className="mt-9 space-y-10">
        <ResumeWorkTimeline cards={workCards} />
        <div className="grid gap-8 lg:grid-cols-[1.35fr_0.8fr_0.8fr]">
          <ResumeAnchorGroup title="Projects" cards={projectCards} featured />
          <ResumeAnchorGroup title="Education" cards={educationCards} compact />
          <ResumeAnchorGroup title="Proof" cards={proofCards} compact />
        </div>
      </div>
    </section>
  );
}

function ResumeSummaryTile({
  label,
  count,
  icon: Icon,
  index
}: {
  label: string;
  count: string;
  icon: typeof BriefcaseBusiness;
  index: number;
}) {
  return (
    <article
      className={[
        "profile-soft-reveal flex min-w-[10rem] flex-1 items-center gap-3 px-5 py-3 text-left md:min-w-0 md:justify-center",
        index === 0 ? "border-b-2 border-[#F26E01]" : ""
      ].join(" ")}
      style={{ "--profile-reveal-delay": `${2700 + index * 70}ms` } as CSSProperties}
    >
      <Icon size={25} strokeWidth={1.55} className="shrink-0 text-[#F26E01]" />
      <div className="min-w-0">
        <h3 className="text-base font-medium leading-none text-cream">{label}</h3>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-cream/48">
          {count}
        </p>
      </div>
    </article>
  );
}

function ResumeAnchorGroup({
  title,
  cards,
  featured = false,
  compact = false
}: {
  title: string;
  cards: ProfileResumeAnchor[];
  featured?: boolean;
  compact?: boolean;
}) {
  if (!cards.length) return null;
  const groupDelay = 2860 + ["Work", "Projects", "Education", "Proof"].indexOf(title) * 130;

  return (
    <section
      className="profile-soft-reveal relative"
      style={{ "--profile-reveal-delay": `${groupDelay}ms` } as CSSProperties}
    >
      <div className="mb-4 flex items-center gap-4">
        <h3 className="text-lg font-medium text-cream/82">{title}</h3>
        <span className="h-px flex-1 bg-gradient-to-r from-cream/28 to-transparent" />
      </div>

      <div className={featured ? "grid gap-3" : "space-y-3"}>
        {cards.map((card, index) => (
          <ProfileResumeAnchorCard
            key={card.id}
            card={card}
            index={index}
            groupDelay={groupDelay}
            variant={featured ? "project" : compact ? "compact" : "default"}
          />
        ))}
      </div>
    </section>
  );
}

function ResumeWorkTimeline({ cards }: { cards: ProfileResumeAnchor[] }) {
  if (!cards.length) return null;
  return (
    <section
      className="profile-soft-reveal"
      style={{ "--profile-reveal-delay": "2860ms" } as CSSProperties}
    >
      <div className="mb-5 flex items-center gap-4">
        <span className="h-2 w-2 rounded-full bg-[#F26E01] shadow-[0_0_10px_rgba(242,110,1,0.45)]" />
        <h3 className="text-lg font-medium text-cream/84">Work experience</h3>
        <span className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
      </div>
      <div className="relative border-l border-white/[0.14] pl-8 sm:pl-12">
        {cards.map((card) => (
          <ResumeTimelineEntry key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

function ResumeTimelineEntry({ card }: { card: ProfileResumeAnchor }) {
  const Icon = card.icon;
  return (
    <article className="relative mb-9 border-b border-white/[0.1] pb-9 last:mb-0 last:border-b-0 last:pb-0">
      <span className="absolute -left-[2.65rem] top-1 grid h-5 w-5 place-items-center rounded-full border border-[#F26E01]/55 bg-[#101113] shadow-[0_0_0_5px_rgba(242,110,1,0.09)] sm:-left-[3.65rem]">
        <span className="h-2 w-2 rounded-full bg-[#F26E01]" />
      </span>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon size={23} strokeWidth={1.55} className="mt-0.5 shrink-0 text-[#F26E01]" />
          <div>
            <h4 className="text-xl font-medium leading-tight text-cream">{card.title}</h4>
            {card.meta ? (
              <p className="mt-2 text-[15px] leading-6 text-cream/58">{card.meta}</p>
            ) : null}
          </div>
        </div>
        <span className="rounded-full border border-white/[0.1] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/52">
          {card.badge}
        </span>
      </div>
      {card.body ? (
        <p className="mt-6 text-[15px] leading-7 text-cream/68 sm:text-base sm:leading-8">
          {card.body}
        </p>
      ) : null}
      {card.bullets?.length ? (
        <ul className="mt-6 space-y-4 text-[15px] leading-7 text-cream/68 sm:text-base sm:leading-8">
          {card.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F26E01]" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function ProfileResumeAnchorCard({
  card,
  index,
  groupDelay,
  variant = "default"
}: {
  card: ProfileResumeAnchor;
  index: number;
  groupDelay: number;
  variant?: "default" | "project" | "compact";
}) {
  const Icon = card.icon;

  return (
    <article
      className={[
        "profile-soft-reveal relative flex flex-col overflow-hidden rounded-xl p-5 text-left transition-colors",
        variant === "project"
          ? "min-h-[15rem] border border-[#F26E01]/35 bg-[linear-gradient(120deg,rgba(242,110,1,0.1),rgba(24,25,28,0.98)_42%)] hover:border-[#F26E01]/55"
          : variant === "compact"
            ? "min-h-0 border-l border-white/[0.12] rounded-none bg-transparent px-5 py-2 hover:border-[#F26E01]/40"
            : "min-h-[15rem] border border-white/[0.1] bg-[#18191c] hover:border-white/[0.17] hover:bg-[#1c1d20]"
      ].join(" ")}
      style={
        {
          "--profile-reveal-delay": `${groupDelay + 90 + Math.min(index, 4) * 65}ms`
        } as CSSProperties
      }
    >
      <div className="flex items-start justify-between gap-4">
        <Icon size={27} strokeWidth={1.6} className="shrink-0 text-[#F26E01]" />
        <span className="rounded-full border border-white/[0.1] bg-white/[0.035] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/58">
          {card.badge}
        </span>
      </div>

      {variant === "project" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 right-5 h-28 w-28 rounded-full border border-[#F26E01]/20 shadow-[0_0_0_12px_rgba(242,110,1,0.035),0_0_0_24px_rgba(242,110,1,0.025)]"
        />
      ) : null}

      <div className={variant === "compact" ? "mt-5" : "mt-6"}>
        <h3 className="text-xl font-medium leading-tight text-cream">{card.title}</h3>
        {card.meta ? (
          <p className="mt-2.5 text-sm font-medium leading-6 text-cream/68">{card.meta}</p>
        ) : null}
      </div>

      {card.body ? (
        <p className="mt-4 text-sm leading-6 text-cream/58 sm:text-[15px]">{card.body}</p>
      ) : null}

      {card.bullets?.length ? (
        <ul className="mt-4 space-y-2 text-sm leading-6 text-cream/58">
          {card.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F26E01]/80" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {card.tags?.length ? (
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs font-medium text-cream/58"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function cleanText(value?: string | null) {
  return value?.trim() ?? "";
}

function joinResumeMeta(parts: Array<string | null | undefined>) {
  return parts.map(cleanText).filter(Boolean).join(" · ");
}

function getEducationBadge(credential?: string | null) {
  const value = cleanText(credential);
  if (!value) return "Credential";

  const parenthesized = value.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (parenthesized && parenthesized.length <= 12) return parenthesized;

  const classMatch = value.match(/class\s*\d+/i)?.[0];
  if (classMatch) return classMatch;

  const firstWord = value.split(/\s+/)[0];
  return firstWord || "Credential";
}

function SectionUiTexture({ variant = 0 }: { variant?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden text-cream opacity-80"
    >
      <svg
        className={[
          "absolute h-24 w-44 opacity-[0.06]",
          variant % 3 === 0
            ? "-left-8 top-4"
            : variant % 3 === 1
              ? "right-5 top-4"
              : "left-1/2 top-2 -translate-x-1/2"
        ].join(" ")}
        viewBox="0 0 180 120"
        fill="none"
      >
        <rect x="18" y="18" width="132" height="52" rx="13" stroke="currentColor" />
        <circle cx="40" cy="42" r="4" fill="currentColor" fillOpacity="0.38" />
        <path d="M58 40h72M58 54h88" stroke="currentColor" strokeLinecap="round" />
        <path d="M36 94h112" stroke="currentColor" strokeDasharray="6 10" />
      </svg>

      <svg
        className={[
          "absolute h-24 w-56 opacity-[0.055]",
          variant % 3 === 0
            ? "right-2 bottom-2"
            : variant % 3 === 1
              ? "-left-8 bottom-1"
              : "right-8 bottom-3"
        ].join(" ")}
        viewBox="0 0 240 100"
        fill="none"
      >
        <path d="M12 58h40m148 0h28" stroke="currentColor" strokeLinecap="round" />
        {Array.from({ length: 12 }, (_, item) => (
          <line
            key={item}
            x1={66 + item * 10}
            x2={66 + item * 10}
            y1={58 - ((item % 5) + 2) * 4}
            y2={58 + ((item % 5) + 2) * 4}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        ))}
      </svg>

      <svg
        className={[
          "absolute h-24 w-40 opacity-[0.05]",
          variant % 2 === 0 ? "right-8 top-1/2 -translate-y-1/2" : "left-8 top-1/2 -translate-y-1/2"
        ].join(" ")}
        viewBox="0 0 160 110"
        fill="none"
      >
        <path d="M22 30h116M22 52h84M22 74h102" stroke="currentColor" />
        <rect x="12" y="14" width="136" height="78" rx="14" stroke="currentColor" />
      </svg>

      <svg
        className={[
          "absolute h-20 w-32 opacity-[0.05]",
          variant % 2 === 0 ? "left-6 bottom-5" : "right-10 bottom-7"
        ].join(" ")}
        viewBox="0 0 130 90"
        fill="none"
      >
        <path d="M18 18h92v54H18z" stroke="currentColor" />
        <path d="M48 18v54M80 18v54M18 45h92" stroke="currentColor" strokeOpacity="0.56" />
        <circle cx="32" cy="32" r="4" fill="currentColor" fillOpacity="0.36" />
        <circle cx="64" cy="60" r="4" fill="#9be8c1" fillOpacity="0.42" />
        <circle cx="96" cy="32" r="4" fill="currentColor" fillOpacity="0.3" />
      </svg>

      <svg
        className={[
          "absolute h-20 w-52 opacity-[0.045]",
          variant % 3 === 0
            ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            : variant % 3 === 1
              ? "right-1/4 top-12"
              : "left-1/4 bottom-10"
        ].join(" ")}
        viewBox="0 0 220 90"
        fill="none"
      >
        <path
          d="M14 56 C 46 22, 78 26, 108 50 S 168 84, 206 30"
          stroke="#9be8c1"
          strokeOpacity="0.48"
          strokeDasharray="5 9"
        />
        <circle cx="108" cy="50" r="5" fill="currentColor" fillOpacity="0.28" />
        <circle cx="168" cy="56" r="5" fill="currentColor" fillOpacity="0.22" />
      </svg>

      <svg
        className={[
          "absolute h-16 w-48 opacity-[0.04]",
          variant % 2 === 0 ? "right-2 top-1/3" : "left-2 top-1/3"
        ].join(" ")}
        viewBox="0 0 190 70"
        fill="none"
      >
        {Array.from({ length: 24 }, (_, item) => (
          <circle
            key={item}
            cx={16 + (item % 8) * 20}
            cy={14 + Math.floor(item / 8) * 18}
            r="2.4"
            fill="currentColor"
            fillOpacity={item % 5 === 0 ? "0.42" : "0.2"}
          />
        ))}
      </svg>
    </div>
  );
}

function ProfileHeroSidePatterns() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden overflow-hidden text-cream sm:block"
    >
      <svg
        className="absolute left-8 top-20 h-36 w-56 opacity-[0.085]"
        viewBox="0 0 230 150"
        fill="none"
      >
        <rect x="18" y="24" width="160" height="68" rx="14" stroke="currentColor" />
        <circle cx="42" cy="48" r="5" fill="currentColor" fillOpacity="0.42" />
        <path d="M61 45h78M61 64h104" stroke="currentColor" strokeLinecap="round" />
        <path d="M28 116h178" stroke="currentColor" strokeLinecap="round" strokeDasharray="7 12" />
      </svg>
      <svg
        className="absolute left-14 top-72 h-44 w-64 opacity-[0.07]"
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
        className="absolute left-[5%] top-[31rem] h-28 w-72 opacity-[0.055]"
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
        className="absolute right-8 top-[7.5rem] h-40 w-64 opacity-[0.09]"
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
        className="absolute right-14 top-80 h-48 w-72 opacity-[0.07]"
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
        className="absolute right-[5%] top-[32rem] h-36 w-72 opacity-[0.055]"
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
        className="absolute left-[13%] top-[41rem] h-24 w-44 opacity-[0.055]"
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
        className="absolute right-[15%] top-[42rem] h-24 w-52 opacity-[0.055]"
        viewBox="0 0 210 110"
        fill="none"
      >
        <path d="M28 34h154M28 56h112M28 78h132" stroke="currentColor" />
        <path d="M16 20h178v76H16z" stroke="currentColor" />
        <path d="M54 20v76M118 20v76" stroke="currentColor" strokeOpacity="0.55" />
      </svg>
      <svg
        className="absolute right-8 top-[52rem] h-36 w-64 opacity-[0.055]"
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
        className="absolute right-[6%] top-[66rem] h-40 w-64 opacity-[0.052]"
        viewBox="0 0 270 170"
        fill="none"
      >
        <path d="M30 76h38m166 0h22" stroke="currentColor" />
        <circle cx="136" cy="76" r="56" stroke="currentColor" />
        <circle cx="136" cy="76" r="30" stroke="currentColor" strokeOpacity="0.58" />
        <circle cx="136" cy="76" r="8" fill="currentColor" fillOpacity="0.38" />
        <path d="M136 18v28M136 106v28M78 76h28M166 76h28" stroke="currentColor" />
      </svg>
      <svg
        className="absolute right-[13%] top-[80rem] h-32 w-56 opacity-[0.05]"
        viewBox="0 0 230 140"
        fill="none"
      >
        <path d="M28 34h160M28 54h122M28 74h142" stroke="currentColor" />
        <rect x="16" y="16" width="194" height="80" rx="15" stroke="currentColor" />
        <path d="M60 116h98" stroke="currentColor" strokeDasharray="6 10" />
        <circle cx="174" cy="116" r="6" fill="#9be8c1" fillOpacity="0.4" />
      </svg>
      <svg
        className="absolute right-[4%] top-[96rem] h-36 w-80 opacity-[0.05]"
        viewBox="0 0 330 150"
        fill="none"
      >
        <path d="M24 76h52m178 0h54" stroke="currentColor" strokeLinecap="round" />
        {Array.from({ length: 16 }, (_, item) => (
          <line
            key={item}
            x1={92 + item * 10}
            x2={92 + item * 10}
            y1={76 - ((item % 6) + 2) * 5}
            y2={76 + ((item % 6) + 2) * 5}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        ))}
        <path d="M72 28h140M72 46h98" stroke="currentColor" strokeOpacity="0.62" />
        <rect x="54" y="12" width="180" height="60" rx="14" stroke="currentColor" />
      </svg>
      <svg
        className="absolute right-[16%] top-[114rem] h-40 w-64 opacity-[0.047]"
        viewBox="0 0 270 170"
        fill="none"
      >
        <path d="M32 84h34m162 0h24" stroke="currentColor" />
        <circle cx="136" cy="84" r="58" stroke="currentColor" />
        <circle cx="136" cy="84" r="34" stroke="currentColor" strokeOpacity="0.54" />
        <circle cx="136" cy="84" r="10" fill="currentColor" fillOpacity="0.32" />
        <path d="M136 20v30M136 118v30M72 84h30M170 84h30" stroke="currentColor" />
      </svg>
      <svg
        className="absolute bottom-8 right-[10%] h-24 w-44 opacity-[0.075]"
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

function SignatureStoryCard({ story }: { story?: CandidateStory }) {
  if (!story?.title) return null;

  return (
    <section className="relative mt-5 overflow-hidden rounded-[1.35rem] bg-cream/[0.025] p-6 backdrop-blur-sm sm:p-7">
      <CardPattern variant="quote" />
      <SectionUiTexture variant={1} />
      <Quote size={20} className="absolute left-6 top-6 text-cream/42" aria-hidden />
      <div className="relative px-9">
        <p className="max-w-5xl text-[15px] leading-7 text-cream/72">
          {story.outcome || story.situation}
        </p>
        <p className="mt-2.5 text-xs font-medium text-cream/56">{story.title}</p>
      </div>
      <span className="absolute bottom-6 right-6 grid h-10 w-10 place-items-center rounded-full border border-cream/18 bg-cream/[0.035] text-cream/48">
        <Quote size={16} />
      </span>
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

const statTones = {
  mint: "bg-[#71d6a5]/16 text-[#a9f0cd] ring-1 ring-inset ring-[#71d6a5]/28",
  sky: "bg-[#F26E01]/12 text-[#ffbd8f] ring-1 ring-inset ring-[#F26E01]/25",
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
      <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.08] bg-[#17181b] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_70px_rgba(0,0,0,0.55)] sm:flex-row sm:items-center">
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
  const {
    targetRole,
    level,
    targetCompany,
    targetDate,
    headline,
    context,
    focusAreas,
    stories,
    coverImage,
    profileImage
  } = profile;
  return {
    targetRole,
    level,
    targetCompany,
    targetDate,
    headline,
    context,
    focusAreas,
    stories,
    coverImage,
    profileImage
  };
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}
