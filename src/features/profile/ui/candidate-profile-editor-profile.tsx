import { type CSSProperties } from "react";
import Image from "next/image";
import { BadgeCheck, BarChart3, Pencil, Sparkles, Target, Upload } from "lucide-react";
import type { CandidateProfile, CandidateProfileInput } from "@/lib/shared/types";
import {
  focusAreaDetails,
  focusAreaIcons,
  hashProfileSeed,
  levelOptions,
  profileAvatars,
  profileCovers,
  roleOptions
} from "./candidate-profile-editor-data";
import { ProfileResumeAnchors } from "./candidate-profile-editor-resume-anchors";
import { HeroChip } from "./candidate-profile-editor-visuals";
import { PROFILE_FALLBACK_IMAGE } from "./profile-avatar";
import { displayName } from "@/lib/shared/display-name";

export function ProfileHero({
  profile,
  saved,
  onCoverEdit,
  onAvatarEdit,
  onResumeUpdate
}: {
  profile: CandidateProfileInput;
  saved: CandidateProfile;
  onCoverEdit: () => void;
  onAvatarEdit: () => void;
  onResumeUpdate: () => void;
}) {
  const resume = saved.resume;
  const name = displayName(resume?.fullName) || "Your interview profile";
  const role = roleOptions.find((option) => option.value === profile.targetRole);
  const level = levelOptions.find((option) => option.value === profile.level);
  const profileSeed = hashProfileSeed(
    [name, profile.headline, profile.targetRole, profile.level, resume?.fileName]
      .filter(Boolean)
      .join("|") || "trailgrad-profile"
  );
  const selectedAvatar = profileAvatars.find((avatar) => avatar.src === profile.profileImage);
  const avatar = selectedAvatar ?? {
    src: PROFILE_FALLBACK_IMAGE,
    width: 1254,
    height: 1254
  };
  const selectedCover = profileCovers.find((cover) => cover.src === profile.coverImage);
  const cover =
    selectedCover ??
    profileCovers[Math.floor(profileSeed / profileAvatars.length) % profileCovers.length] ??
    profileCovers[0];

  return (
    <header className="profile-motion relative">
      {/* One profile card: a fixed-height cover and the identity row beneath
          it on the same surface, so the header reads as a single object. */}
      <section className="profile-hero-card relative overflow-hidden rounded-[1.75rem] bg-[#17181b]">
        <div className="profile-cover-stage relative h-40 overflow-hidden bg-[#111214] sm:h-48 lg:h-52">
          <Image
            key={cover.src}
            src={cover.src}
            alt=""
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1535px) calc(100vw - 17rem), 84rem"
            quality={72}
            priority
            className="profile-cover-image profile-cover-image-change absolute inset-0 h-full w-full object-cover object-center"
          />
          <span
            key={`${cover.src}-sweep`}
            aria-hidden="true"
            className="profile-cover-change-sweep pointer-events-none absolute inset-0"
          />
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

        <div className="relative px-5 pb-6 sm:px-7 lg:px-8">
          <div className="-mt-12 flex flex-col items-center text-center sm:-mt-16">
            <button
              type="button"
              aria-label="Change profile image"
              onClick={onAvatarEdit}
              className="profile-avatar-orbit group relative z-20 grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-full bg-cream p-0.5 outline-none transition focus-visible:ring-2 focus-visible:ring-cream/70 sm:h-32 sm:w-32"
            >
              <span aria-hidden className="absolute -inset-2 rounded-full bg-cream/10" />
              <span aria-hidden className="profile-avatar-ring absolute -inset-1 rounded-full" />
              <Image
                key={avatar.src}
                src={avatar.src}
                alt=""
                width={avatar.width}
                height={avatar.height}
                sizes="(max-width: 639px) 112px, 128px"
                quality={72}
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

            <div className="mt-4 flex w-full flex-col items-center">
              <h1 className="flex max-w-full items-center justify-center gap-2.5 text-3xl font-semibold tracking-tight text-cream sm:text-[2.1rem]">
                <span className="min-w-0 truncate">
                  <AnimatedProfileWords text={name} delay={80} />
                </span>
                {resume ? (
                  <BadgeCheck
                    size={23}
                    className="profile-badge-pop shrink-0 text-[#9be8c1]"
                    aria-label="Verified"
                  />
                ) : null}
              </h1>
              {/* Set at onboarding and not editable here, so an empty one is
                  simply left out; the role and level chips carry the line. */}
              {profile.headline ? (
                <p className="mt-1.5 max-w-3xl text-sm leading-6 text-cream/58 sm:text-[15px]">
                  <AnimatedProfileWords text={profile.headline} delay={130} copy />
                </p>
              ) : null}

              <div
                className="step-in mt-3 flex flex-wrap justify-center gap-2"
                style={{ "--step-delay": "210ms" } as CSSProperties}
              >
                <HeroChip icon={Target} label={role?.label ?? "No role set"} muted={!role} />
                <HeroChip icon={BarChart3} label={level?.label ?? "No level set"} muted={!level} />
              </div>
            </div>

            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={onResumeUpdate}
                className="profile-action-button inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/70"
              >
                <Upload size={14} /> {resume ? "Update resume" : "Upload resume"}
              </button>
            </div>
          </div>

          {/* The longer summary only when it adds to the headline above. */}
          {(profile.context && !repeatsHeadline(profile.context, profile.headline)) || !resume ? (
            <div className="mx-auto mt-6 max-w-3xl text-center">
              <p className="text-[15px] leading-7 text-cream/62">
                <AnimatedProfileWords
                  text={
                    profile.context ||
                    "Upload your resume and your teacher will shape practice and interviews around your real work."
                  }
                  delay={290}
                  copy
                />
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Everything below shares the header card's width; headings are centred. */}
      <div className="relative flex flex-col pb-4 sm:pb-5">
        {profile.focusAreas.length ? (
          <section className="mt-12 w-full">
            <div
              className="profile-soft-reveal text-center"
              style={{ "--profile-reveal-delay": "340ms" } as CSSProperties}
            >
              <h2 className="text-2xl font-semibold tracking-tight text-cream">Core focus areas</h2>
              <p className="mt-2 text-[15px] text-cream/55">
                What your teacher presses on in practice.
              </p>
            </div>

            <div className="relative mx-auto mt-7 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {profile.focusAreas.map((area, index) => {
                const FocusIcon = focusAreaIcons[area] ?? Sparkles;
                return (
                  <article
                    key={area}
                    className="profile-glass profile-soft-reveal group relative flex w-full items-start gap-3.5 rounded-2xl px-5 py-5 text-left"
                    style={{ "--profile-reveal-delay": `${400 + index * 35}ms` } as CSSProperties}
                  >
                    <span className="mt-0.5 shrink-0 text-[var(--workspace-accent)] transition-transform duration-300 group-hover:-translate-y-0.5">
                      <FocusIcon size={20} strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[1.05rem] font-semibold leading-tight tracking-[-0.01em] text-cream">
                        {area}
                      </h3>
                      <p className="mt-1.5 text-[14px] leading-[1.55] text-cream/55">
                        {focusAreaDetails[area] ??
                          "Your teacher will press this signal during practice."}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <blockquote
          className="profile-soft-reveal relative mx-auto mt-9 max-w-2xl px-8 text-center"
          style={
            {
              "--profile-reveal-delay": `${profile.focusAreas.length ? 440 + profile.focusAreas.length * 35 : 380}ms`
            } as CSSProperties
          }
        >
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 text-4xl leading-none text-[var(--workspace-accent)]"
          >
            “
          </span>
          <p className="text-lg font-medium leading-8 text-cream/82 sm:text-xl">
            Grow into a confident {role?.label ?? "professional"}, turning the{" "}
            {level?.label ?? "current"} stage into strong technical judgment and meaningful product
            impact.
          </p>
          <span
            aria-hidden="true"
            className="absolute bottom-0 right-0 text-4xl leading-none text-[var(--workspace-accent)]"
          >
            ”
          </span>
          <footer className="mt-3 text-[13px] text-cream/42">Your career goal</footer>
        </blockquote>

        <ProfileResumeAnchors resume={resume} />
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
          style={{ "--word-delay": `${delay + Math.min(index, 20) * 12}ms` } as CSSProperties}
        >
          {word}
          {index < words.length - 1 ? "\u00A0" : ""}
        </span>
      ))}
    </>
  );
}

/** True when the summary opens with the same words as the headline. */
function repeatsHeadline(context: string, headline?: string | null): boolean {
  const words = (text: string) => text.toLowerCase().split(/\s+/).slice(0, 6).join(" ");
  return Boolean(headline) && words(context) === words(headline ?? "");
}
