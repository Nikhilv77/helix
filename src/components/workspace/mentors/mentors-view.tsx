import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ListChecks,
  MessageSquare,
  MessagesSquare,
  NotebookPen,
  Target,
  Users
} from "lucide-react";

import { Reveal } from "@/components/marketing/home/visuals/reveal";
import { TrailguideFaq } from "@/components/workspace/mentors/trailguide-faq";
import anikaPortrait from "../../../../public/images/trailguide/anika-rao.webp";
import aarohiFeaturePortrait from "../../../../public/images/trailguide/aarohi-sharma-v3.webp";
import aarohiDirectoryPortrait from "../../../../public/images/trailguide/aarohi-sharma-v2.webp";
import devPortrait from "../../../../public/images/trailguide/dev-malhotra.webp";
import meeraPortrait from "../../../../public/images/trailguide/meera-iyer.webp";
import mentorDirectoryHero from "../../../../public/images/trailguide/mentor-directory-hero.webp";
import nehaDirectoryPortrait from "../../../../public/images/trailguide/neha-iyer-v2.webp";
import rohanDirectoryPortrait from "../../../../public/images/trailguide/rohan-mehta-v2.webp";
import rohanPortrait from "../../../../public/images/trailguide/rohan-kulkarni.webp";
import sanaPortrait from "../../../../public/images/trailguide/sana-qureshi.webp";
import vikramDirectoryPortrait from "../../../../public/images/trailguide/vikram-shah-v2.webp";

const GUIDANCE_STEPS = [
  {
    title: "Tell us what is going on",
    body: "Share the role, interview, feedback or decision you want help with. It does not need to be neatly figured out first.",
    tone: "bg-[#ffd8c4] text-[#321b12]",
    icon: NotebookPen
  },
  {
    title: "Talk it through with a guide",
    body: "Your guide asks questions, looks at the context and gives you an honest outside perspective.",
    tone: "bg-[#dce7ff] text-[#17243b]",
    icon: MessagesSquare
  },
  {
    title: "Decide what to do next",
    body: "Finish with a short plan that makes sense for your goal, your current level and the time you have.",
    tone: "bg-[#dfe9d8] text-[#1d2b19]",
    icon: ListChecks
  }
];

const MENTOR_MOMENTS = [
  {
    heading: "Get ready for the interview in front of you.",
    body: "Build a focused plan around the role, your feedback and the time you actually have.",
    image: aarohiFeaturePortrait,
    imagePosition: "object-[center_28%]",
    tone: "bg-[#ef7d45] text-[#2d180f]",
    layout: "lg:col-span-6"
  },
  {
    heading: "See the trade-offs in your code or design.",
    body: "Bring the decisions you are stuck on and work through scale, reliability and what you would change.",
    image: rohanDirectoryPortrait,
    imagePosition: "object-[center_24%]",
    tone: "bg-[#dce7ff] text-[#17243b]",
    layout: "lg:col-span-3"
  },
  {
    heading: "Choose your next move with more context.",
    body: "Compare roles, teams or career paths with someone who understands the work behind the title.",
    image: vikramDirectoryPortrait,
    imagePosition: "object-[center_24%]",
    tone: "bg-[#dfe9d8] text-[#1d2b19]",
    layout: "lg:col-span-3"
  }
];

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
    <div
      className="mentor-surface min-h-screen w-full overflow-hidden"
      style={
        {
          "--m-ground": "#f7f7f3",
          "--m-raised": "#ffffff",
          "--m-sunken": "#ecece6"
        } as CSSProperties
      }
    >
      <main className="mx-auto w-full max-w-[1360px] px-5 pb-20 pt-6 sm:px-8 lg:px-10 lg:pb-28 lg:pt-7">
        <TrailguideHeader />

        <section className="grid items-center gap-12 pb-20 pt-12 sm:pt-16 lg:min-h-[690px] lg:grid-cols-[0.88fr_1.12fr] lg:gap-16 lg:pb-24 lg:pt-14">
          <div
            className="mentor-rise max-w-[610px]"
            style={{ "--rise-delay": "100ms" } as CSSProperties}
          >
            <h1 className="max-w-[11ch] text-[clamp(3.15rem,5.4vw,5rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-[var(--m-ink)]">
              Big career questions are easier with the right person.
            </h1>
            <p className="mt-7 max-w-[55ch] text-[1.02rem] leading-[1.75] text-[var(--m-ink-soft)] sm:text-[1.12rem]">
              Trailguide connects you with experienced engineers who can help you prepare for an
              interview, make sense of difficult feedback or decide what to do next in your career.
              You bring the context. You leave with a clearer plan.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-5">
              <MentorCta />
              <Link
                href="#how-it-works"
                className="group inline-flex items-center gap-2 text-sm font-semibold text-[var(--m-ink)] underline decoration-[var(--m-line-strong)] underline-offset-4 transition-colors hover:decoration-[var(--m-ink)]"
              >
                See how it works
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </div>

            <p className="mt-10 max-w-[52ch] text-sm leading-6 text-[var(--m-ink-faint)]">
              Useful for interview preparation, technical decisions, role changes and the moments
              when generic advice is not enough.
            </p>
          </div>

          <div
            className="mentor-rise relative mx-auto w-full max-w-[680px]"
            style={{ "--rise-delay": "170ms" } as CSSProperties}
          >
            <div className="relative min-h-[540px] overflow-hidden rounded-[1.25rem] bg-[#d8d0c8] sm:min-h-[610px]">
              <Image
                src={rohanPortrait}
                alt="Rohan Kulkarni, a Trailguide mentor"
                fill
                preload
                placeholder="blur"
                quality={80}
                sizes="(min-width: 1360px) 680px, (min-width: 1024px) 50vw, 100vw"
                className="object-cover object-[center_30%]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-6 pb-6 pt-28 text-white sm:px-8 sm:pb-8">
                <p className="text-base font-semibold">Rohan Kulkarni</p>
                <p className="mt-1 text-sm text-white/70">Engineering mentor</p>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-3 max-w-[270px] rounded-[1rem] bg-[#ef7d45] p-5 text-[#191713] shadow-[0_18px_45px_rgba(25,23,19,0.15)] sm:-left-6 sm:p-6">
              <p className="text-lg font-semibold leading-snug tracking-[-0.025em]">
                Bring one real question.
              </p>
              <p className="mt-2 text-sm leading-6 text-black/60">Leave knowing what to do next.</p>
            </div>
          </div>
        </section>

        <Reveal className="py-10 sm:py-14">
          <section id="why-trailguide" className="scroll-mt-8">
            <div className="max-w-[760px]">
              <h2 className="text-[clamp(2.4rem,5vw,4.2rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-[var(--m-ink)]">
                What can you actually talk about here?
              </h2>
              <p className="mt-5 max-w-[62ch] text-base leading-7 text-[var(--m-ink-soft)]">
                Anything that feels important, specific and difficult to work through alone. You do
                not need a polished question before you arrive.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-12">
              <article className="group relative min-h-[420px] overflow-hidden rounded-[1.5rem] bg-[#ef7d45] p-7 text-[#25160f] transition-transform duration-300 ease-out hover:-translate-y-1 lg:col-span-7 lg:p-10">
                <span
                  aria-hidden="true"
                  className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/20 transition-transform duration-700 ease-out group-hover:scale-110"
                />
                <div className="relative flex h-full flex-col">
                  <h3 className="max-w-[12ch] text-[clamp(2rem,4vw,3.35rem)] font-semibold leading-[1] tracking-[-0.045em]">
                    “My interview is close and I&apos;m trying to prepare for everything.”
                  </h3>
                  <p className="mt-auto max-w-[48ch] pt-16 text-base leading-7 text-black/65">
                    A guide can help you narrow the plan, identify the rounds that need the most
                    work and stop spending time on low-impact preparation.
                  </p>
                </div>
              </article>

              <div className="grid gap-4 lg:col-span-5">
                <article className="group rounded-[1.35rem] bg-[#dce8ff] p-7 text-[#17243b] transition-transform duration-300 ease-out hover:-translate-y-1">
                  <h3 className="max-w-[18ch] text-2xl font-semibold leading-[1.08] tracking-[-0.035em]">
                    “People keep telling me to be more senior.”
                  </h3>
                  <p className="mt-5 max-w-[44ch] text-sm leading-7 text-[#344663]">
                    Turn vague feedback into concrete changes in how you make decisions, explain
                    trade-offs and show ownership.
                  </p>
                </article>
                <article className="group rounded-[1.35rem] bg-[#dfe9d8] p-7 text-[#1d2b19] transition-transform duration-300 ease-out hover:-translate-y-1">
                  <h3 className="max-w-[18ch] text-2xl font-semibold leading-[1.08] tracking-[-0.035em]">
                    “I&apos;m not sure which role or path fits me.”
                  </h3>
                  <p className="mt-5 max-w-[44ch] text-sm leading-7 text-[#40523a]">
                    Compare the day-to-day work behind your options and make a decision based on
                    more than job titles.
                  </p>
                </article>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal className="py-10 sm:py-14">
          <section className="grid overflow-hidden rounded-[1.5rem] bg-[#1c1a16] text-[var(--m-ground)] lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative min-h-[440px] lg:min-h-[620px]">
              <Image
                src={meeraPortrait}
                alt="Meera Iyer, a Trailguide mentor"
                fill
                placeholder="blur"
                quality={78}
                sizes="(min-width: 1240px) 540px, (min-width: 1024px) 45vw, 100vw"
                className="object-cover object-[center_28%] transition-transform duration-700 ease-out hover:scale-[1.015]"
              />
            </div>
            <div className="flex flex-col justify-center px-7 py-12 sm:px-12 sm:py-16 lg:px-16">
              <h2 className="max-w-[12ch] text-[clamp(2.35rem,4.7vw,4.25rem)] font-semibold leading-[0.98] tracking-[-0.05em]">
                This is a working session, not a lecture.
              </h2>
              <p className="mt-6 max-w-[48ch] text-base leading-7 text-white/62">
                You and your guide look at the situation together. They will ask questions, point
                out what you may be missing and help you choose a practical way forward.
              </p>
              <ul className="mt-8 space-y-4 pt-3">
                {[
                  "We use your actual context, not a generic checklist",
                  "You can ask follow-up questions and challenge the advice",
                  "You finish with a few next steps you can realistically do"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/80">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10">
                      <Check
                        size={13}
                        strokeWidth={2}
                        className="text-[#ef8b58]"
                        aria-hidden="true"
                      />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </Reveal>

        <Reveal className="py-12 sm:py-16">
          <section aria-labelledby="mentor-moments-title">
            <div className="max-w-[760px]">
              <h2
                id="mentor-moments-title"
                className="text-[clamp(2.35rem,5vw,4rem)] font-semibold leading-[1] tracking-[-0.05em] text-[var(--m-ink)]"
              >
                Choose the kind of help you need right now.
              </h2>
              <p className="mt-5 max-w-[60ch] text-base leading-7 text-[var(--m-ink-soft)]">
                You do not have to sign up for a long programme. Start with the conversation that
                would make the biggest difference today.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-12">
              {MENTOR_MOMENTS.map((moment, index) => (
                <article
                  key={moment.heading}
                  className={`group overflow-hidden rounded-[1.5rem] shadow-[0_18px_50px_rgba(25,23,19,0.08)] transition-[box-shadow,transform] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_24px_64px_rgba(25,23,19,0.13)] md:last:col-span-2 lg:last:col-span-3 ${moment.tone} ${moment.layout} ${index === 0 ? "sm:grid sm:grid-cols-[1.05fr_0.95fr] md:col-span-2 lg:min-h-[490px]" : "flex min-h-[490px] flex-col"}`}
                >
                  <div
                    className={`relative overflow-hidden ${index === 0 ? "min-h-[290px] sm:order-2 sm:min-h-full" : "min-h-[250px]"}`}
                  >
                    <Image
                      src={moment.image}
                      alt=""
                      fill
                      placeholder="blur"
                      quality={index === 0 ? 92 : 80}
                      sizes={
                        index === 0
                          ? "(min-width: 1024px) 640px, 100vw"
                          : "(min-width: 1024px) 280px, 50vw"
                      }
                      className={`object-cover ${moment.imagePosition} transition-transform duration-700 ease-out group-hover:scale-[1.025]`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>

                  <div
                    className={`flex flex-1 flex-col p-7 sm:p-8 ${index === 0 ? "sm:order-1 lg:p-10" : ""}`}
                  >
                    <span className="mb-9 h-2.5 w-2.5 rounded-full bg-current opacity-45" />
                    <h3
                      className={`mt-auto max-w-[15ch] font-semibold leading-[1.02] tracking-[-0.045em] ${index === 0 ? "text-[clamp(2.15rem,3.4vw,3.35rem)]" : "text-[clamp(1.7rem,2.35vw,2.25rem)]"}`}
                    >
                      {moment.heading}
                    </h3>
                    <p className="mt-5 max-w-[44ch] text-sm leading-7 opacity-70">{moment.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal className="py-12 sm:py-16">
          <section
            id="how-it-works"
            className="relative scroll-mt-8 overflow-hidden rounded-[1.5rem] bg-[#20201d] p-6 text-white sm:p-10 lg:p-14"
          >
            <span
              aria-hidden="true"
              className="absolute -bottom-36 -left-24 h-96 w-96 rounded-full bg-[#ef7d45]/10 blur-3xl"
            />

            <div className="relative grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
              <div className="flex flex-col">
                <div>
                  <h2 className="max-w-[11ch] text-[clamp(2.5rem,5vw,4.5rem)] font-semibold leading-[0.96] tracking-[-0.055em]">
                    You bring the question. We help you move it forward.
                  </h2>
                  <p className="mt-6 max-w-[44ch] text-base leading-7 text-white/60">
                    No long programme or complicated setup. Choose a guide, share the real context
                    and use the conversation where it matters most.
                  </p>
                </div>

                <div className="mt-10 flex items-center gap-4 lg:mt-auto lg:pt-16">
                  <div className="flex -space-x-3" aria-hidden="true">
                    {[anikaPortrait, rohanPortrait, sanaPortrait].map((portrait, index) => (
                      <div
                        key={portrait.src}
                        className="relative h-11 w-11 overflow-hidden rounded-full border-2 border-[#20201d] bg-[#d9d0c5]"
                      >
                        <Image
                          src={portrait}
                          alt=""
                          fill
                          placeholder="blur"
                          sizes="44px"
                          className={`object-cover ${index === 0 ? "object-[center_25%]" : "object-[center_30%]"}`}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="max-w-[20ch] text-sm leading-5 text-white/55">
                    A real conversation, shaped around you.
                  </p>
                </div>
              </div>

              <ol className="grid gap-4">
                {GUIDANCE_STEPS.map((step) => {
                  const Icon = step.icon;

                  return (
                    <li
                      key={step.title}
                      className={`group grid gap-6 rounded-[1.2rem] p-6 transition-transform duration-300 ease-out hover:translate-x-1 sm:grid-cols-[64px_1fr] sm:items-center sm:p-7 ${step.tone}`}
                    >
                      <span className="grid h-14 w-14 place-items-center rounded-full bg-white/40">
                        <Icon size={23} strokeWidth={1.7} aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-[1.35rem] font-semibold tracking-[-0.035em]">
                          {step.title}
                        </h3>
                        <p className="mt-2 max-w-[52ch] text-sm leading-6 opacity-65">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        </Reveal>

        <Reveal className="py-12 sm:py-16">
          <section aria-labelledby="meet-guides-title">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-[760px]">
                <h2
                  id="meet-guides-title"
                  className="text-[clamp(2.35rem,5vw,4rem)] font-semibold leading-[1] tracking-[-0.05em] text-[var(--m-ink)]"
                >
                  Find someone who understands your kind of problem.
                </h2>
                <p className="mt-5 max-w-[60ch] text-base leading-7 text-[var(--m-ink-soft)]">
                  Every guide brings experience from real engineering teams. Start with the question
                  you have, then choose the person whose background feels most useful.
                </p>
              </div>
              <MentorCta />
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {GUIDES.slice(0, 3).map((guide) => (
                <Link
                  key={guide.name}
                  href="/trailguide/mentors"
                  className="group relative min-h-[420px] overflow-hidden rounded-[1.25rem] bg-[#ddd6cb]"
                >
                  <Image
                    src={guide.image}
                    alt={guide.name}
                    fill
                    placeholder="blur"
                    quality={76}
                    sizes="(min-width: 1024px) 420px, (min-width: 768px) 32vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent px-6 pb-6 pt-28 text-white">
                    <h3 className="text-xl font-semibold tracking-[-0.025em]">{guide.name}</h3>
                    <p className="mt-1 text-sm text-white/70">{guide.role}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal className="py-12 sm:py-16">
          <TrailguideFaq />
        </Reveal>

        <Reveal className="pb-4 pt-12 sm:pt-16">
          <section className="overflow-hidden rounded-[1.5rem] bg-[#ef7d45] px-7 py-10 text-[#191713] sm:px-10 sm:py-14 lg:px-14 lg:py-16">
            <div className="grid gap-9 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <h2 className="max-w-[14ch] text-[clamp(2.4rem,5vw,4.3rem)] font-semibold leading-[0.98] tracking-[-0.05em]">
                  Ready to talk it through with someone?
                </h2>
                <p className="mt-5 max-w-[56ch] text-[0.95rem] leading-7 text-black/65">
                  Browse the mentors, find a background that fits your question and start from
                  there. You do not need to have everything figured out first.
                </p>
              </div>
              <MentorCta />
            </div>
          </section>
        </Reveal>
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
        className="text-[0.95rem] font-semibold tracking-[-0.02em] text-[var(--m-ink)] outline-none transition-opacity hover:opacity-65 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[var(--m-accent-line)]"
      >
        Trailguide
      </Link>

      <nav
        aria-label="Trailguide navigation"
        className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end"
      >
        {!directory ? (
          <div className="mr-2 hidden items-center gap-7 lg:flex">
            <Link
              href="#why-trailguide"
              className="text-[0.8125rem] font-medium text-[var(--m-ink-soft)] transition-colors hover:text-[var(--m-ink)]"
            >
              Why Trailguide
            </Link>
            <Link
              href="#how-it-works"
              className="text-[0.8125rem] font-medium text-[var(--m-ink-soft)] transition-colors hover:text-[var(--m-ink)]"
            >
              How it works
            </Link>
          </div>
        ) : null}
        <Link
          href="/"
          className="group inline-flex min-h-11 shrink-0 items-center gap-2 px-2 text-[0.8125rem] font-semibold text-[var(--m-ink)] outline-none transition-opacity hover:opacity-60 focus-visible:ring-2 focus-visible:ring-[var(--m-accent-line)] sm:min-h-10"
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
        "Find your guide"
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
