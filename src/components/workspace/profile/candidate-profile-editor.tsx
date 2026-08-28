"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  ChevronRight,
  Eye,
  Plus,
  Quote,
  Sparkles,
  Target
} from "lucide-react";
import { ApiClientError, saveProfile } from "@/lib/api/api-client";
import { pageTitle } from "@/lib/shared/seo";
import type { CandidateProfile, CandidateProfileInput, CandidateStory } from "@/lib/shared/types";
import { publishWorkspaceProfileImage } from "@/lib/workspace/profile-image";
import {
  EDIT_SECTIONS,
  AvatarPicker,
  CoverPicker,
  EditSection,
  FieldBlock,
  ImagePickerOverlay,
  LevelOption,
  RoleOption,
  SelectChip,
  StoryRow
} from "./candidate-profile-editor-fields";
import {
  fieldClass,
  focusOptions,
  levelOptions,
  roleOptions
} from "./candidate-profile-editor-data";
import { ProfileHero } from "./candidate-profile-editor-profile";
import {
  CardPattern,
  EditMemoryPreview,
  ResumeHero,
  SignatureStoryCard
} from "./candidate-profile-editor-visuals";
import { ResumeTab } from "./candidate-profile-editor-resume";
import { SaveBar, SavedFooter } from "./candidate-profile-editor-ui";
import { toInput } from "./candidate-profile-editor-utils";

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
    const query = new URLSearchParams(window.location.search);
    if (query.get("help") === "1" || query.has("request")) return;

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
      if ("profileImage" in patch) publishWorkspaceProfileImage(next.profileImage);
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
      <div className="profile-theme mx-auto w-full max-w-[84rem] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
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
      <div className="profile-theme mx-auto w-full max-w-[84rem] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
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
    <div className="profile-theme mx-auto w-full max-w-[84rem] px-4 pb-36 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
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
              Shape the way your teacher interviews you.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-cream/58">
              Keep the inputs short and concrete. Your teacher turns these signals into questions,
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
