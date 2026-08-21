import Link from "next/link";
import { ArrowLeft, Clock3, Lightbulb, Quote, Target, TriangleAlert } from "lucide-react";
import { SessionCoach } from "./session-coach";
import { StartSessionButton } from "./session-plan";
import { ROUND_LABEL } from "@/lib/curriculum";
import type { CurriculumSession } from "@/lib/curriculum";

/**
 * Maya teaching one round: what it tests, the structure to answer it, the traps
 * to avoid, and the evidence she will press on — then the interview itself.
 */
export function SessionDetail({ session }: { session: CurriculumSession }) {
  return (
    <div className="mx-auto w-full max-w-[86rem] px-5 py-6 pb-16 sm:px-8 lg:px-10">
      <Link
        href="/#sessions-plan"
        className="pill inline-flex h-10 items-center gap-2 !rounded-xl px-4 text-xs font-semibold text-cream/75 transition hover:bg-white/[0.13] hover:text-cream"
      >
        <ArrowLeft size={14} /> All sessions
      </Link>

      <header className="surface-raised relative mt-5 overflow-hidden">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-center lg:gap-10">
          <SessionCoach session={session} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="blueprint-label text-cream/38">
                Session {String(session.order).padStart(2, "0")}
              </span>
              <span className="pill px-2.5 py-1 text-[10px] font-medium text-cream/70">
                {ROUND_LABEL[session.roundType]}
              </span>
              <span className="pill inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] text-cream/50">
                <Clock3 size={11} /> {session.minutes} min
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-cream sm:text-[2rem]">
              {session.title}
            </h1>
            <p className="mt-3.5 max-w-2xl text-sm leading-7 text-cream/60 sm:text-[15px]">
              {session.coachNote}
            </p>

            <div className="mt-6">
              <StartSessionButton sessionId={session.id} />
            </div>
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-5">
          <section className="surface p-6 sm:p-7">
            <div className="flex items-center gap-3.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#7ea0ff]/22 text-[#cfdcff]">
                <Target size={17} />
              </span>
              <h2 className="text-base font-semibold tracking-tight text-cream">
                What this round tests
              </h2>
            </div>
            <p className="mt-5 max-w-[64ch] text-[15px] leading-7 text-cream/70">
              {session.objective}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {session.keyIdeas.map((idea, index) => (
                <article key={idea.title} className="rounded-xl bg-white/[0.045] p-4">
                  <span className="font-mono text-[10px] text-cream/32">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold text-cream">{idea.title}</h3>
                  <p className="mt-1.5 text-xs leading-6 text-cream/50">{idea.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="surface p-6 sm:p-7">
            <div className="flex items-center gap-3.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-cream/[0.18] text-cream">
                <Lightbulb size={17} />
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-cream">
                  How to structure the answer
                </h2>
                <p className="mt-0.5 text-xs text-cream/40">{session.framework.name}</p>
              </div>
            </div>

            {/* The structure as a flow, so it is memorable rather than a list. */}
            <ol className="mt-6 grid gap-3 sm:grid-cols-3">
              {session.framework.steps.map((step, index) => (
                <li key={step.label} className="relative rounded-xl bg-white/[0.045] p-4">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-cream font-mono text-[10px] font-semibold text-blueprint">
                    {index + 1}
                  </span>
                  <p className="mt-3 text-sm font-semibold text-cream">{step.label}</p>
                  <p className="mt-1.5 text-xs leading-5 text-cream/48">{step.detail}</p>
                  {index < session.framework.steps.length - 1 ? (
                    <span
                      aria-hidden
                      className="absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-gradient-to-r from-cream/40 to-transparent sm:block"
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="grid gap-5">
          <section className="surface p-6 sm:p-7">
            <div className="flex items-center gap-3.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#efcf84]/22 text-[#f7e3ae]">
                <TriangleAlert size={17} />
              </span>
              <h2 className="text-base font-semibold tracking-tight text-cream">
                Where people slip
              </h2>
            </div>
            <ul className="mt-5 space-y-3">
              {session.pitfalls.map((pitfall) => (
                <li key={pitfall} className="flex gap-3 text-xs leading-6 text-cream/55">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#efcf84]" />
                  {pitfall}
                </li>
              ))}
            </ul>
          </section>

          <section className="surface p-6 sm:p-7">
            <div className="flex items-center gap-3.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#71d6a5]/22 text-[#a9f0cd]">
                <Quote size={17} />
              </span>
              <h2 className="text-base font-semibold tracking-tight text-cream">
                What she will press on
              </h2>
            </div>
            <div className="mt-5 space-y-2.5">
              {session.evidenceAnchors.map((anchor) => (
                <p
                  key={anchor}
                  className="rounded-xl bg-white/[0.045] px-4 py-3 text-xs leading-6 text-cream/62"
                >
                  {anchor}
                </p>
              ))}
            </div>
            <p className="mt-5 text-[11px] leading-5 text-cream/35">
              Drawn from your verified resume, so the round cannot drift into generic questions.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
