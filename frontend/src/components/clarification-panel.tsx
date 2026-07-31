"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, HelpCircle, Pencil, Send, Sparkles } from "lucide-react";
import { getRequirements, submitClarifications } from "@/lib/api-client";
import type { ClarificationAnswer, ClarificationQuestion } from "@/lib/types";
import { Button } from "./ui/button";
import { ErrorState } from "./ui/error-state";

interface ClarificationPanelProps {
  sessionId: string;
  questions: ClarificationQuestion[];
  answers: ClarificationAnswer[];
  disabled: boolean;
  onSaved: () => Promise<void>;
}

export function ClarificationPanel({
  sessionId,
  questions,
  answers,
  disabled,
  onSaved
}: ClarificationPanelProps) {
  const existingAnswers = useMemo(() => {
    return new Map(answers.map((answer) => [answer.questionId, answer.answer]));
  }, [answers]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      questions.map((question) => [question.id, existingAnswers.get(question.id) ?? ""])
    )
  );
  const [customAnswerIds, setCustomAnswerIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(
      Object.fromEntries(
        questions.map((question) => [question.id, existingAnswers.get(question.id) ?? ""])
      )
    );
    setCustomAnswerIds(new Set());
    const firstOpenIndex = questions.findIndex(
      (question) => !((existingAnswers.get(question.id)?.trim().length ?? 0) > 0)
    );
    setCurrentIndex(firstOpenIndex >= 0 ? firstOpenIndex : 0);
  }, [existingAnswers, questions]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const latestRequirements = await getRequirements(sessionId);
      const latestQuestions = latestRequirements.analysis?.clarificationQuestions ?? questions;
      const submittedAnswers = latestQuestions.map((question) => ({
        questionId: question.id,
        answer: values[question.id]?.trim() ?? ""
      }));
      await submitClarifications(sessionId, submittedAnswers);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Clarifications could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (questions.length === 0) {
    return <p className="text-sm text-muted">No clarification questions are pending.</p>;
  }

  const complete = questions.every((question) => (values[question.id]?.trim().length ?? 0) > 0);
  const currentQuestion = questions[Math.min(currentIndex, questions.length - 1)]!;
  const choices = getQuestionChoices(currentQuestion);
  const selectedValue = values[currentQuestion.id] ?? "";
  const showCustomAnswer = customAnswerIds.has(currentQuestion.id);
  const currentComplete = selectedValue.trim().length > 0;
  const answeredCount = questions.filter(
    (question) => (values[question.id]?.trim().length ?? 0) > 0
  ).length;

  function selectChoice(choice: string) {
    setCustomAnswerIds((current) => {
      const next = new Set(current);
      next.delete(currentQuestion.id);
      return next;
    });
    setValues((current) => ({ ...current, [currentQuestion.id]: choice }));

    if (currentIndex < questions.length - 1) {
      window.setTimeout(() => {
        setCurrentIndex((index) => Math.min(index + 1, questions.length - 1));
      }, 220);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      {error ? <ErrorState message={error} /> : null}

      <div className="rounded-lg border border-cyan-300/20 bg-black/30 p-4 shadow-glow">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-brand">
              <Sparkles size={13} aria-hidden="true" />
              Decision {currentIndex + 1} of {questions.length}
            </p>
            <h3 className="mt-4 text-xl font-semibold text-ink">{currentQuestion.question}</h3>
            <p className="mt-2 flex max-w-3xl items-start gap-2 text-sm leading-6 text-muted">
              <HelpCircle size={16} className="mt-1 shrink-0 text-accent" aria-hidden="true" />
              <span>{currentQuestion.reason}</span>
            </p>
          </div>
          <div className="rounded-md border border-line bg-white/5 px-3 py-2 text-sm text-muted">
            <span className="font-semibold text-ink">{answeredCount}</span>/{questions.length}{" "}
            answered
          </div>
        </div>

        <div className="mt-5 flex gap-1.5">
          {questions.map((question, index) => {
            const answered = (values[question.id]?.trim().length ?? 0) > 0;
            const active = index === currentIndex;

            return (
              <button
                key={question.id}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={[
                  "h-2.5 rounded-full transition-all",
                  active
                    ? "w-10 bg-brand shadow-glow"
                    : answered
                      ? "w-5 bg-emerald-300/70"
                      : "w-5 bg-white/14 hover:bg-white/25"
                ].join(" ")}
                aria-label={`Go to decision ${index + 1}`}
              />
            );
          })}
        </div>

        <fieldset className="mt-6 border-0 p-0">
          <legend className="sr-only">{currentQuestion.question}</legend>
          <div className="grid gap-3 md:grid-cols-2">
            {choices.map((choice, index) => {
              const selected = selectedValue === choice && !showCustomAnswer;

              return (
                <button
                  key={`${index}-${choice}`}
                  type="button"
                  disabled={disabled || saving}
                  onClick={() => selectChoice(choice)}
                  className={[
                    "group flex min-h-16 items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45",
                    selected
                      ? "border-cyan-300/60 bg-cyan-300/14 text-brand shadow-glow"
                      : "border-line bg-white/5 text-slate-300 hover:border-cyan-300/35 hover:bg-white/9"
                  ].join(" ")}
                >
                  <span className="leading-6">{choice}</span>
                  <span
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition",
                      selected
                        ? "border-cyan-200 bg-cyan-300 text-slate-950"
                        : "border-line bg-black/20 text-muted group-hover:border-cyan-300/35"
                    ].join(" ")}
                  >
                    {selected ? <Check size={15} aria-hidden="true" /> : index + 1}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              disabled={disabled || saving}
              onClick={() =>
                setCustomAnswerIds((current) => {
                  const next = new Set(current);
                  next.add(currentQuestion.id);
                  return next;
                })
              }
              className={[
                "group flex min-h-16 items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45",
                showCustomAnswer
                  ? "border-cyan-300/60 bg-cyan-300/14 text-brand shadow-glow"
                  : "border-line bg-white/5 text-slate-300 hover:border-cyan-300/35 hover:bg-white/9"
              ].join(" ")}
            >
              <span>Custom answer</span>
              <Pencil size={17} aria-hidden="true" />
            </button>
          </div>
          {showCustomAnswer ? (
            <input
              value={selectedValue}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [currentQuestion.id]: event.target.value
                }))
              }
              disabled={disabled || saving}
              className="field mt-4 min-h-11 w-full rounded-md px-3 py-2 text-sm outline-none disabled:opacity-55"
              placeholder="Enter the answer to use for this design."
              autoFocus
            />
          ) : null}
        </fieldset>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="secondary"
          icon={<ChevronLeft size={16} />}
          disabled={saving || currentIndex === 0}
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
        >
          Back
        </Button>
        <div className="flex justify-end gap-2">
          {currentIndex < questions.length - 1 ? (
            <Button
              type="button"
              icon={<ChevronRight size={16} />}
              disabled={saving || !currentComplete}
              onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}
            >
              Next
            </Button>
          ) : (
            <Button
              type="submit"
              icon={<Send size={16} />}
              disabled={disabled || saving || !complete}
            >
              {saving ? "Saving" : "Submit answers"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function getQuestionChoices(question: ClarificationQuestion): string[] {
  if (question.options && question.options.length >= 2) {
    return question.options.slice(0, 4);
  }

  const text = `${question.question} ${question.reason}`.toLowerCase();

  if (/retention|retain|downsample|archive/.test(text)) {
    return ["Short retention: 7-30 days", "Standard retention: 90 days", "Long retention: 1 year+"];
  }

  if (/tenant|isolation|organization|team/.test(text)) {
    return ["Internal single tenant", "Team-level tenancy", "External multi-tenant SaaS"];
  }

  if (/trace|log|metric|scope/.test(text)) {
    return ["Metrics only", "Metrics and logs", "Metrics, logs, and traces"];
  }

  if (/scale|traffic|throughput|request|user|volume|peak/.test(text)) {
    return ["Small: prototype scale", "Medium: growing product", "Large: high-scale system"];
  }

  if (/scrap|pull|push|ingest/.test(text)) {
    return ["Pull-based scraping", "Push-based ingestion", "Hybrid push and pull"];
  }

  if (/availability|reliability|latency|sla|slo/.test(text)) {
    return ["Standard reliability", "High availability", "Mission-critical"];
  }

  return ["Use reasonable defaults", "Prioritize lower cost", "Prioritize higher scale"];
}
