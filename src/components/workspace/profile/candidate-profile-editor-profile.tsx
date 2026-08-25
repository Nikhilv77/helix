import { type CSSProperties } from "react";
import { BadgeCheck, BarChart3, Pencil, Sparkles, Target } from "lucide-react";
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
import { HeroChip, ProfileHeroSidePatterns } from "./candidate-profile-editor-visuals";

export function ProfileHero({
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
    <header className="profile-motion relative">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.18]">
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
              <h1 className="mt-3 flex max-w-full items-center justify-center gap-2.5 text-center text-3xl font-semibold tracking-tight text-cream sm:text-[2.25rem]">
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
                      "Add a short profile summary so your teacher can shape interviews around your real work."
                    }
                    delay={1760}
                    copy
                  />
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative flex flex-col items-center px-5 pb-4 sm:px-7 sm:pb-5 lg:px-8">
        {profile.focusAreas.length ? (
          <section className="mt-12 w-full max-w-6xl">
            <div
              className="profile-soft-reveal text-center"
              style={{ "--profile-reveal-delay": "2100ms" } as CSSProperties}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cream/38">
                Practice priorities
              </p>
              <h2 className="mt-2 text-2xl font-medium tracking-tight text-cream">
                Core focus areas
              </h2>
            </div>

            <div className="relative mx-auto mt-6 flex w-full flex-wrap justify-center gap-3">
              {profile.focusAreas.map((area, index) => {
                const FocusIcon = focusAreaIcons[area] ?? Sparkles;
                return (
                  <article
                    key={area}
                    className="profile-glass profile-soft-reveal group relative flex w-full items-start gap-4 rounded-2xl px-5 py-5 text-left transition-colors duration-200 hover:bg-white/[0.035] sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)]"
                    style={{ "--profile-reveal-delay": `${2280 + index * 65}ms` } as CSSProperties}
                  >
                    <span className="mt-0.5 shrink-0 text-[var(--workspace-accent)] transition-transform duration-300 group-hover:-translate-y-0.5">
                      <FocusIcon size={25} strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[1.05rem] font-medium leading-tight text-cream sm:text-lg">
                        {area}
                      </h3>
                      <p className="mt-2 text-[13px] leading-5.5 text-cream/58 sm:text-sm">
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
            {level?.label ?? "current"} stage into strong technical judgment and meaningful product
            impact.
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
