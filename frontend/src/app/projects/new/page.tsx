import { ProjectForm } from "@/components/project-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function NewProjectPage() {
  return (
    <div className="page-enter mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div>
          <Button href="/" variant="ghost" icon={<ArrowLeft size={16} />}>
            Back to projects
          </Button>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-sm font-medium text-ink">
            <Sparkles size={14} aria-hidden="true" />
            Guided setup
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-normal text-ink sm:text-5xl">
            Create a system design workspace
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            Pick a starting point, set the design profile, and let Helix carry the context into
            requirements, capacity, architecture, diagrams, and review.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Setup time
          </p>
          <p className="mt-2 text-3xl font-semibold text-ink">2 min</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Choice-based setup first, open-ended details only when they matter.
          </p>
        </div>
      </section>
      <ProjectForm />
    </div>
  );
}
