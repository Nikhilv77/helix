import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CloudCog,
  Code2,
  Database,
  MessageSquare,
  ShieldCheck,
  Target,
  Users
} from "lucide-react";

import anikaPortrait from "../../../../public/images/trailguide/anika-rao.webp";
import aarohiDirectoryPortrait from "../../../../public/images/trailguide/aarohi-sharma-v2.webp";
import arjunPortrait from "../../../../public/images/trailguide/arjun-mehta.webp";
import devPortrait from "../../../../public/images/trailguide/dev-malhotra.webp";
import meeraPortrait from "../../../../public/images/trailguide/meera-iyer.webp";
import mentorDirectoryHero from "../../../../public/images/trailguide/mentor-directory-hero.webp";
import nehaDirectoryPortrait from "../../../../public/images/trailguide/neha-iyer-v2.webp";
import rohanDirectoryPortrait from "../../../../public/images/trailguide/rohan-mehta-v2.webp";
import rohanPortrait from "../../../../public/images/trailguide/rohan-kulkarni.webp";
import sanaPortrait from "../../../../public/images/trailguide/sana-qureshi.webp";
import vikramDirectoryPortrait from "../../../../public/images/trailguide/vikram-shah-v2.webp";

const PROGRAM_STAGES = [
  {
    title: "Prepare with direction",
    body: "Build the right technical depth for your target role, with a plan shaped around the gaps that actually hold you back."
  },
  {
    title: "Perform with confidence",
    body: "Practise the interview, communication and decision-making skills that help strong preparation show up under pressure."
  },
  {
    title: "Position for opportunity",
    body: "Tell a sharper career story, navigate the search thoughtfully and create more credible paths into ambitious teams."
  }
];

const TRACKS = [
  {
    icon: Code2,
    title: "Software engineering",
    detail:
      "Build the problem-solving and systems judgment expected across strong engineering teams.",
    focus: "Technical depth · Interview readiness",
    tone: "accent" as const
  },
  {
    icon: BrainCircuit,
    title: "AI & machine learning",
    detail: "Turn applied AI work into credible evidence of depth, impact and sound decisions.",
    focus: "ML systems · Applied AI narrative",
    tone: "dark" as const
  },
  {
    icon: Database,
    title: "Data engineering",
    detail:
      "Strengthen the foundations behind reliable pipelines, data systems and analytical scale.",
    focus: "Data systems · Architecture stories",
    tone: "sand" as const
  },
  {
    icon: CloudCog,
    title: "Cloud & platform",
    detail: "Prepare for roles built around infrastructure, reliability and developer platforms.",
    focus: "Cloud systems · Platform ownership",
    tone: "paper" as const
  }
];

const TRACK_TONES = {
  accent: {
    card: "bg-[#f47d48] text-[#191713]",
    icon: "bg-[#191713] text-[#f4efe3]",
    detail: "text-[#54372b]",
    focus: "text-[#54372b]"
  },
  dark: {
    card: "bg-[#191713] text-[#f4efe3]",
    icon: "bg-white/10 text-[#f4efe3]",
    detail: "text-[#aaa396]",
    focus: "text-white/50"
  },
  sand: {
    card: "bg-[#dcd2bc] text-[#191713]",
    icon: "bg-[#191713] text-[#f4efe3]",
    detail: "text-[#625a4d]",
    focus: "text-[#716858]"
  },
  paper: {
    card: "bg-[var(--m-raised)] text-[var(--m-ink)]",
    icon: "bg-[var(--m-sunken)] text-[var(--m-ink)]",
    detail: "text-[var(--m-ink-soft)]",
    focus: "text-[var(--m-ink-faint)]"
  }
};

const GUIDES: Array<{
  name: string;
  role: string;
  tags: string[];
  company: "Google" | "Microsoft" | "Amazon" | "Stripe" | "Shopify" | "Meta" | "Adobe" | "Uber";
  experience: string;
  summary: string;
  image: StaticImageData;
}> = [
  {
    name: "Aarohi Sharma",
    role: "Engineering Manager",
    tags: ["System Design"],
    company: "Google",
    experience: "14+ years",
    summary: "Turns ambiguous systems work into clear decisions and credible staff-level evidence.",
    image: aarohiDirectoryPortrait
  },
  {
    name: "Rohan Mehta",
    role: "Staff Software Engineer",
    tags: ["Backend Systems", "Distributed Systems"],
    company: "Microsoft",
    experience: "13+ years",
    summary:
      "Pressure-tests architecture choices across reliability, scale and operational trade-offs.",
    image: rohanDirectoryPortrait
  },
  {
    name: "Neha Iyer",
    role: "Principal Engineer",
    tags: ["Cloud Architecture", "Scalability"],
    company: "Amazon",
    experience: "16+ years",
    summary:
      "Builds principal-level judgment for resilient cloud platforms and complex migrations.",
    image: nehaDirectoryPortrait
  },
  {
    name: "Arjun Kapoor",
    role: "Engineering Lead",
    tags: ["Payments", "High Performance"],
    company: "Stripe",
    experience: "12+ years",
    summary: "Sharpens performance reasoning and high-stakes product infrastructure decisions.",
    image: rohanPortrait
  },
  {
    name: "Meera Iyer",
    role: "VP of Engineering",
    tags: ["Engineering Leadership", "Product Strategy"],
    company: "Shopify",
    experience: "17+ years",
    summary: "Connects technical leadership, product direction and the transition into management.",
    image: meeraPortrait
  },
  {
    name: "Vikram Shah",
    role: "Engineering Director",
    tags: ["Org Design", "Leadership Interviews"],
    company: "Meta",
    experience: "18+ years",
    summary: "Refines leadership narratives, organisational judgment and executive communication.",
    image: vikramDirectoryPortrait
  },
  {
    name: "Sana Qureshi",
    role: "Distinguished Engineer",
    tags: ["Developer Platforms", "API Architecture"],
    company: "Adobe",
    experience: "15+ years",
    summary: "Clarifies platform strategy, API boundaries and influence across engineering teams.",
    image: sanaPortrait
  },
  {
    name: "Dev Malhotra",
    role: "Staff ML Engineer",
    tags: ["ML Infrastructure", "Ranking Systems"],
    company: "Uber",
    experience: "14+ years",
    summary:
      "Grounds ML system design in production constraints, measurement and model operations.",
    image: devPortrait
  }
];

const DIRECTORY_FEATURES = [
  {
    icon: Users,
    title: "Experienced leaders",
    detail: "10+ years in tech"
  },
  {
    icon: Target,
    title: "Proven impact",
    detail: "Built and scaled real systems"
  },
  {
    icon: MessageSquare,
    title: "Personalized guidance",
    detail: "Focused on your goals"
  }
];

const DIRECTORY_STATS = [
  { value: "25+", label: "Mentors" },
  { value: "10+", label: "Top companies" },
  { value: "1000+", label: "Mentees guided" },
  { value: "95%", label: "Satisfaction rate" }
];

export function MentorsView() {
  return (
    <div className="mentor-surface min-h-screen w-full overflow-hidden">
      <main className="mx-auto w-full max-w-[1440px] px-5 pb-20 pt-7 sm:px-8 lg:px-12 lg:pb-28 lg:pt-10">
        <TrailguideHeader />

        <section className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:py-20">
          <div
            className="mentor-rise max-w-3xl"
            style={{ "--rise-delay": "100ms" } as CSSProperties}
          >
            <h1 className="max-w-[12ch] text-[clamp(2.75rem,11.5vw,6.8rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-[var(--m-ink)] sm:leading-[0.91] sm:tracking-[-0.065em]">
              Your ambition deserves a serious path.
            </h1>
            <p className="mt-7 max-w-[58ch] text-[1.02rem] leading-[1.75] text-[var(--m-ink-soft)] sm:text-[1.12rem]">
              Trailguide is a focused mentor-led program designed to help you prepare deeply,
              interview confidently and position yourself for ambitious Big Tech opportunities.
            </p>

            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <MentorCta />
              <p className="max-w-[32ch] text-sm leading-[1.6] text-[var(--m-ink-faint)]">
                Explore mentors across focused technology career paths.
              </p>
            </div>
          </div>

          <div
            className="mentor-rise relative mx-auto w-full max-w-[660px]"
            style={{ "--rise-delay": "180ms" } as CSSProperties}
          >
            <div className="grid grid-cols-[1.12fr_0.88fr] gap-3 rounded-[2rem] bg-[var(--m-ink)] p-3 sm:gap-4 sm:p-4">
              <PortraitTile
                image={anikaPortrait}
                alt="Portrait of Indian technology mentor Anika Rao"
                className="aspect-[4/5]"
                sizes="(min-width: 1440px) 360px, (min-width: 1024px) 25vw, 58vw"
                preload
              />
              <div className="grid gap-3 sm:gap-4">
                <PortraitTile
                  image={arjunPortrait}
                  alt="Portrait of Indian technology mentor Arjun Mehta"
                  className="aspect-square"
                  sizes="(min-width: 1440px) 260px, (min-width: 1024px) 19vw, 40vw"
                  eager
                />
                <div className="flex min-h-0 flex-col justify-between rounded-[1.35rem] bg-[#f47d48] p-4 text-[#191713] sm:p-5">
                  <p className="mt-7 text-[clamp(1.05rem,2.2vw,1.55rem)] font-semibold leading-[1.12] tracking-[-0.025em]">
                    Less noise.
                    <br />
                    Better next moves.
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 left-5 right-5 flex items-center justify-between gap-4 rounded-2xl bg-[var(--m-raised)] px-5 py-4 shadow-[0_18px_50px_rgba(25,23,19,0.16)] sm:left-auto sm:right-7 sm:w-[70%]">
              <div>
                <p className="text-sm font-semibold leading-snug text-[var(--m-ink)]">
                  Built around your target role
                </p>
                <p className="mt-1 text-xs leading-[1.45] text-[var(--m-ink-faint)]">
                  Your path, pressure-tested with a guide
                </p>
              </div>
              <ShieldCheck
                size={20}
                strokeWidth={1.7}
                className="shrink-0 text-[var(--m-accent-ink)]"
                aria-hidden="true"
              />
            </div>
          </div>
        </section>

        <section
          className="mentor-rise mt-7 overflow-hidden rounded-[2rem] bg-[var(--m-ink)] px-6 py-9 text-[var(--m-ground)] sm:px-8 sm:py-11 lg:px-10 lg:py-12"
          style={{ "--rise-delay": "240ms" } as CSSProperties}
        >
          <div className="grid gap-9 lg:grid-cols-[0.82fr_2.18fr] lg:gap-14">
            <div className="lg:pr-4">
              <h2 className="max-w-[11ch] text-[2rem] font-semibold leading-[1.03] tracking-[-0.04em] sm:text-[2.65rem]">
                One path from preparation to opportunity.
              </h2>
              <p className="mt-5 max-w-[38ch] text-[0.9375rem] leading-[1.7] text-[#aaa396]">
                Each part strengthens the next, so your effort becomes a clear and credible signal.
              </p>
            </div>

            <ol className="grid list-none gap-7 sm:grid-cols-3 sm:gap-6">
              {PROGRAM_STAGES.map((stage, index) => (
                <li
                  key={stage.title}
                  className="mentor-program-stage pt-1"
                  style={{ "--stage-delay": `${300 + index * 90}ms` } as CSSProperties}
                >
                  <h3 className="max-w-[11ch] text-[1.4rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[1.55rem]">
                    {stage.title}
                  </h3>
                  <p className="mt-4 max-w-[34ch] text-[0.9375rem] leading-[1.7] text-[#b8b1a4]">
                    {stage.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="mentor-rise py-12 sm:py-16"
          style={{ "--rise-delay": "300ms" } as CSSProperties}
        >
          <div className="rounded-[2rem] bg-[var(--m-sunken)] p-5 sm:p-7 lg:p-8">
            <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-end lg:gap-12">
              <div>
                <h2 className="max-w-[15ch] text-[2rem] font-semibold leading-[1] tracking-[-0.045em] text-[var(--m-ink)] sm:text-[2.65rem]">
                  Your craft shapes the route.
                </h2>
              </div>
              <p className="max-w-[62ch] text-base leading-[1.7] text-[var(--m-ink-soft)] lg:justify-self-end">
                Choose the engineering direction you are aiming for. Trailguide will focus the
                preparation, interview practice and career decisions around the bar for that role.
              </p>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {TRACKS.map((track) => {
                const Icon = track.icon;
                const tone = TRACK_TONES[track.tone];

                return (
                  <article
                    key={track.title}
                    className={`relative flex min-h-[15rem] overflow-hidden rounded-[1.5rem] p-5 sm:p-6 ${tone.card}`}
                  >
                    <div className="relative z-10 flex w-full flex-col">
                      <span
                        className={`grid h-10 w-10 place-items-center rounded-[0.8rem] ${tone.icon}`}
                      >
                        <Icon size={18} strokeWidth={1.65} aria-hidden="true" />
                      </span>

                      <div className="mt-8">
                        <h3 className="max-w-[12ch] text-[1.3rem] font-semibold leading-[1.05] tracking-[-0.03em]">
                          {track.title}
                        </h3>
                        <p className={`mt-3 max-w-[34ch] text-sm leading-[1.65] ${tone.detail}`}>
                          {track.detail}
                        </p>
                      </div>

                      <p
                        className={`mt-auto pt-4 text-[0.7rem] font-semibold uppercase tracking-[0.1em] ${tone.focus}`}
                      >
                        {track.focus}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className="mentor-rise mt-16 overflow-hidden rounded-[2rem] bg-[#f47d48] p-7 text-[#191713] sm:mt-20 sm:p-10 lg:p-12"
          style={{ "--rise-delay": "420ms" } as CSSProperties}
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="max-w-[14ch] text-[2.25rem] font-semibold leading-[1] tracking-[-0.045em] sm:text-[3.4rem]">
                The right guide can change how far you aim.
              </h2>
              <p className="mt-5 max-w-[58ch] text-[0.92rem] leading-[1.7] text-[#3f3028]">
                We are creating a focused program for engineers who want a more deliberate route
                toward exceptional teams. No placement promises—just serious preparation, honest
                guidance and better odds of being ready when opportunity appears.
              </p>
            </div>
            <MentorCta />
          </div>
        </section>
      </main>
    </div>
  );
}

export function MentorDirectoryView() {
  return (
    <div className="mentor-surface min-h-screen w-full">
      <main className="mx-auto w-full max-w-[1200px] px-5 pb-16 pt-6 sm:px-8 lg:px-6 xl:px-0">
        <MentorDirectoryHeader />

        <section className="mentor-rise mt-12 grid items-center gap-10 lg:mt-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
          <div>
            <h1 className="max-w-[12ch] text-[clamp(3rem,5.25vw,4.55rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-[#191713]">
              Learn from those who’ve led.
            </h1>
            <p className="mt-5 max-w-[48ch] text-base leading-[1.7] text-[#625d55]">
              Our mentors are engineering leaders from top companies who’ve walked the path—and now
              guide others on it.
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-3 sm:gap-0">
              {DIRECTORY_FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className={`flex gap-3 ${index > 0 ? "sm:border-l sm:border-black/10 sm:pl-5" : ""} ${index < DIRECTORY_FEATURES.length - 1 ? "sm:pr-5" : ""}`}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eee5d6] text-[#191713]">
                      <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold leading-snug text-[#191713]">
                        {feature.title}
                      </p>
                      <p className="mt-1.5 text-[0.8125rem] leading-[1.5] text-[#756f67]">
                        {feature.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative min-h-[410px] overflow-hidden rounded-[1.15rem] bg-[#e8decf] sm:aspect-[1.56/1] sm:min-h-0">
            <Image
              src={mentorDirectoryHero}
              alt=""
              fill
              preload
              placeholder="blur"
              quality={72}
              sizes="(min-width: 1024px) 560px, 92vw"
              className="object-cover"
            />

            <h2 className="absolute left-7 top-10 max-w-[11ch] text-[clamp(1.65rem,2.5vw,2.25rem)] font-semibold leading-[1.05] tracking-[-0.045em] text-[#191713] sm:left-10 sm:top-12">
              Clarity from experience. Direction for your next leap.
            </h2>

            <div className="absolute bottom-5 left-5 right-5 grid grid-cols-2 gap-y-5 rounded-[1rem] bg-[#fbf8f0]/95 px-5 py-4 shadow-[0_12px_35px_rgba(25,23,19,0.13)] sm:grid-cols-4 sm:gap-y-0 sm:px-6">
              {DIRECTORY_STATS.map((stat) => (
                <div key={stat.label}>
                  <p className="text-[1.3rem] font-medium tracking-[-0.04em] text-[#f26e31]">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#59544d]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="mentors" className="mt-12 sm:mt-14">
          <h2 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-[#191713]">
            Meet our mentors
          </h2>

          <GuideGrid />
        </section>
      </main>
    </div>
  );
}

function GuideGrid() {
  return (
    <div className="mentor-rise mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {GUIDES.map((guide) => (
        <article
          key={guide.name}
          className="group flex min-h-[450px] flex-col overflow-hidden rounded-[1.25rem] bg-[#fbf8f0] shadow-[0_12px_34px_rgba(25,23,19,0.07)] transition-[box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(25,23,19,0.11)]"
        >
          <div className="relative aspect-[1.52/1] overflow-hidden bg-[#e9dfd0]">
            <Image
              src={guide.image}
              alt={`Illustrative portrait of ${guide.name}`}
              fill
              placeholder="blur"
              quality={72}
              sizes="(min-width: 1024px) 280px, (min-width: 640px) 46vw, 92vw"
              className="object-cover object-[center_32%] transition-transform duration-700 ease-out group-hover:scale-[1.015]"
            />
            <CompanyMark company={guide.company} />
          </div>

          <div className="flex flex-1 flex-col px-5 pb-5 pt-5">
            <h3 className="text-[1.12rem] font-semibold tracking-[-0.03em] text-[#191713]">
              {guide.name}
            </h3>
            <p className="mt-1.5 text-sm font-medium text-[#5f5a53]">{guide.role}</p>

            <p className="mt-4 text-sm leading-[1.65] text-[#625d56]">{guide.summary}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {guide.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-[#eee7db] px-2.5 py-1.5 text-xs font-medium text-[#403c37]"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-auto pt-5">
              <div className="grid grid-cols-2 gap-4 rounded-[0.9rem] bg-[#f1eadf] px-4 py-3.5">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#777168]">
                    Company
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-[#191713]">{guide.company}</p>
                </div>
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#777168]">
                    Experience
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-[#191713]">{guide.experience}</p>
                </div>
              </div>

              <div
                className="mt-3 inline-flex h-11 w-full cursor-default items-center justify-center rounded-[0.85rem] bg-[#f47d48] px-4 text-sm font-semibold text-white"
                aria-disabled="true"
              >
                Coming soon
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function CompanyMark({ company }: { company: (typeof GUIDES)[number]["company"] }) {
  return (
    <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-md bg-white shadow-[0_4px_16px_rgba(25,23,19,0.09)]">
      {company === "Google" ? (
        <span className="bg-[conic-gradient(from_20deg,#4285f4,#34a853,#fbbc05,#ea4335,#4285f4)] bg-clip-text text-[1.25rem] font-bold leading-none text-transparent">
          G
        </span>
      ) : null}
      {company === "Microsoft" ? (
        <span className="grid grid-cols-2 gap-[2px]" aria-label="Microsoft">
          <span className="h-[7px] w-[7px] bg-[#f25022]" />
          <span className="h-[7px] w-[7px] bg-[#7fba00]" />
          <span className="h-[7px] w-[7px] bg-[#00a4ef]" />
          <span className="h-[7px] w-[7px] bg-[#ffb900]" />
        </span>
      ) : null}
      {company === "Amazon" ? (
        <span className="relative pb-1 text-[0.67rem] font-bold leading-none text-[#191713]">
          aws
          <span className="absolute bottom-0 left-0 h-1 w-full rounded-[50%] border-b-2 border-[#f47d48]" />
        </span>
      ) : null}
      {company === "Stripe" ? (
        <span className="text-[0.68rem] font-bold leading-none text-[#635bff]">stripe</span>
      ) : null}
      {company === "Shopify" ? (
        <span className="text-[1rem] font-bold leading-none text-[#5e8e3e]">S</span>
      ) : null}
      {company === "Meta" ? (
        <span className="text-[1.25rem] font-semibold leading-none text-[#2774e7]">∞</span>
      ) : null}
      {company === "Adobe" ? (
        <span className="text-[0.95rem] font-bold leading-none text-[#e3483e]">A</span>
      ) : null}
      {company === "Uber" ? (
        <span className="text-[0.85rem] font-bold leading-none text-[#191713]">U</span>
      ) : null}
    </span>
  );
}

function MentorDirectoryHeader() {
  return (
    <header className="mentor-rise flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <Link
        href="/trailguide"
        className="text-[0.8125rem] font-semibold uppercase tracking-[0.2em] text-[#191713] outline-none focus-visible:ring-2 focus-visible:ring-[#f47d48]"
      >
        Trailguide
      </Link>

      <nav aria-label="Mentor directory navigation" className="flex flex-wrap items-center gap-3">
        <Link
          href="/trailguide"
          className="group inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-[#fbf8f0] px-4 text-[0.8125rem] font-semibold text-[#191713] outline-none transition-colors hover:bg-[#f0eadf] focus-visible:ring-2 focus-visible:ring-[#f47d48] sm:min-h-10"
        >
          <ArrowLeft
            size={13}
            strokeWidth={1.9}
            aria-hidden="true"
            className="transition-transform group-hover:-translate-x-0.5"
          />
          Back to Trailguide
        </Link>
        <Link
          href="mailto:hello@trailgrad.com?subject=Trailguide%20mentorship"
          className="group inline-flex min-h-11 items-center gap-3 rounded-full bg-[#191713] px-5 text-[0.8125rem] font-semibold text-[#f4efe3] outline-none focus-visible:ring-2 focus-visible:ring-[#f47d48] sm:min-h-10"
        >
          Apply for mentorship
          <ArrowRight
            size={13}
            strokeWidth={1.9}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </nav>
    </header>
  );
}

function TrailguideHeader({ directory = false }: { directory?: boolean }) {
  return (
    <header
      className="mentor-rise flex flex-col items-start justify-between gap-4 pb-5 sm:flex-row sm:items-center"
      style={{ "--rise-delay": "40ms" } as CSSProperties}
    >
      <Link
        href="/trailguide"
        className="text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-[var(--m-ink)] outline-none transition-opacity hover:opacity-65 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[var(--m-accent-line)]"
      >
        Trailguide
      </Link>

      <nav
        aria-label="Trailguide navigation"
        className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end"
      >
        <Link
          href="/"
          className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[var(--m-line-strong)] px-4 text-[0.8125rem] font-semibold text-[var(--m-ink)] outline-none transition-[background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--m-raised)] focus-visible:ring-2 focus-visible:ring-[var(--m-accent-line)] sm:min-h-10"
        >
          <ArrowLeft
            size={14}
            strokeWidth={1.9}
            aria-hidden="true"
            className="transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
          />
          Back to Trailgrad
        </Link>

        {directory ? (
          <Link
            href="/trailguide"
            className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[var(--m-ink)] px-4 text-[0.8125rem] font-semibold text-[var(--m-ground)] outline-none transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--m-accent-line)] sm:min-h-10"
          >
            <ArrowLeft
              size={14}
              strokeWidth={1.9}
              aria-hidden="true"
              className="transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
            />
            <span className="sm:hidden">Trailguide</span>
            <span className="hidden sm:inline">Back to Trailguide</span>
          </Link>
        ) : (
          <MentorCta compact />
        )}
      </nav>
    </header>
  );
}

function PortraitTile({
  image,
  alt,
  className,
  sizes,
  preload = false,
  eager = false
}: {
  image: StaticImageData;
  alt: string;
  className: string;
  sizes: string;
  preload?: boolean;
  eager?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-[1.35rem] bg-[#2a2822] ${className}`}>
      <Image
        src={image}
        alt={alt}
        fill
        preload={preload}
        loading={preload ? undefined : eager ? "eager" : "lazy"}
        placeholder="blur"
        quality={72}
        sizes={sizes}
        className="object-cover"
      />
    </div>
  );
}

function MentorCta({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/trailguide/mentors"
      className={`group inline-flex w-fit items-center justify-center gap-2 rounded-full bg-[var(--m-ink)] font-semibold text-[var(--m-ground)] outline-none transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--m-accent-line)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--m-ground)] ${compact ? "min-h-11 px-4 text-[0.8125rem] sm:min-h-10" : "min-h-12 px-6 text-[0.9375rem]"}`}
    >
      {compact ? (
        <>
          <span className="sm:hidden">Mentors</span>
          <span className="hidden sm:inline">Meet the mentors</span>
        </>
      ) : (
        "Meet the mentors"
      )}
      <ArrowRight
        size={compact ? 14 : 16}
        strokeWidth={1.9}
        aria-hidden="true"
        className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
      />
    </Link>
  );
}
