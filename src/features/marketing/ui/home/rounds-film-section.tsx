import { Reveal } from "@/shared/ui/motion/reveal";
import { ProductFilm } from "./product-film";

/**
 * The second film. The hero is sticky, so this section slides up over it on
 * scroll while the hero shrinks and fades underneath.
 */
export function RoundsFilmSection() {
  return (
    <section
      id="interview"
      aria-label="One round, from resume to report"
      className="rounds-film-section relative z-10 px-4 pb-20 pt-16 sm:px-10 sm:pb-28 sm:pt-24"
    >
      <Reveal>
        <ProductFilm
          src="/videos/marketing/trailgrad-rounds.mp4?v=1"
          touchSrc="/videos/marketing/trailgrad-rounds-mobile.mp4?v=2"
          portraitSrc="/videos/marketing/trailgrad-rounds-portrait.mp4?v=1"
          poster="/videos/marketing/trailgrad-rounds-poster.jpg?v=1"
          portraitPoster="/videos/marketing/trailgrad-rounds-portrait-poster.jpg?v=1"
          label="Trailgrad round film"
          description="A short silent film. Upload once. It reads what you built: a resume line about moving order events onto Kafka is highlighted. Then it asks why Kafka and not a simple queue. Stuck? Ask for a hint: think about what happens when a consumer falls behind. Then drill the gaps: two pointers, rate limiter, idempotent APIs, cache invalidation. After every round, one thing to fix: lead with the trade-off, then the numbers. A little sharper every round."
        />
      </Reveal>
      <Reveal delay={160}>
        <p className="mx-auto mt-8 max-w-[34rem] text-balance text-center text-[1.35rem] font-semibold leading-snug tracking-[-0.025em] text-cream sm:mt-10 sm:text-[1.75rem]">
          Every question comes from something you built.
        </p>
      </Reveal>
    </section>
  );
}
