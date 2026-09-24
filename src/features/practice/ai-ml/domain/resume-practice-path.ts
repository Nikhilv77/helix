import { createHash } from "node:crypto";
import type { CandidateProfile } from "@/lib/shared/types";
import type { PersistedAiMlPracticeTrack } from "./ai-ml-practice";
import type { AiMlStoryPath, AiMlStoryQuestion } from "./ai-ml-story-catalog";

export const AI_ML_RESUME_PATH_KEY = "resume-project";

/** Candidate-specific prompts are frozen in the practice question snapshots. */
export function aiMlResumePracticePath(
  profile: CandidateProfile,
  track: PersistedAiMlPracticeTrack
): AiMlStoryPath | null {
  const project = profile.resume?.projects.find(
    (entry) => entry.name && (entry.summary || entry.outcome)
  );
  const experience = profile.resume?.experience.find(
    (entry) => entry.summary && (entry.role || entry.organization)
  );
  const source = project
    ? { name: project.name, summary: project.summary || project.outcome, skills: project.skills }
    : experience
      ? {
          name: experience.role || experience.organization,
          summary: experience.summary,
          skills: experience.skills
        }
      : null;
  if (!source) return null;

  const name = clean(source.name, 80);
  const summary = clean(source.summary, 380);
  if (!name || !summary) return null;
  const experienced = profile.level === "3-5" || profile.level === "5-plus";
  const topicKeys = resumeTopicKeys([name, summary, ...source.skills].join(" "));
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        track,
        name,
        summary,
        level: profile.level,
        resume: profile.resume?.contentFingerprint
      })
    )
    .digest("hex")
    .slice(0, 16);
  const pathKey = `${AI_ML_RESUME_PATH_KEY}-${fingerprint}`;
  const id = (number: number) => `ai-ml-resume-${track}-${fingerprint}-${number}`;
  const artifact: AiMlStoryQuestion["artifact"] = {
    kind: "scenario",
    title: `Resume evidence · ${name}`,
    content: summary
  };
  const first: AiMlStoryQuestion = {
    id: id(1),
    pathKey,
    title: `Explain a decision in ${name}`,
    format: "artifact-diagnosis",
    prompt: experienced
      ? `Use ${name} to explain one consequential model, data, or system boundary you personally worked on. Trace the mechanism, name an alternative you considered, and identify evidence that could have disproved your decision. State any detail the resume does not establish as an assumption.`
      : `Use ${name} to explain one model, data, or system decision you worked on. What went in, what came out, and how did you check that it worked? State any detail the resume does not establish as an assumption.`,
    artifact,
    topicKeys,
    hints: [
      "Choose one decision you can explain from direct experience.",
      "Trace the input, transformation, and output at that boundary.",
      "Separate what you measured from what you would check next."
    ],
    answer: {
      concise:
        "A strong answer describes a real decision, its mechanism, and evidence of its result without inventing project facts.",
      explanation:
        "Credit the candidate for a concrete boundary, technically coherent reasoning, explicit ownership, and a relevant validation check. The resume summary is context, not proof of unstated implementation details."
    },
    rubric: [
      {
        criterion:
          "Identify a concrete decision and personal ownership without unsupported claims.",
        points: 4
      },
      { criterion: "Explain the input, mechanism, and output at the chosen boundary.", points: 3 },
      {
        criterion:
          "Give relevant validation evidence or a clear test that would challenge the decision.",
        points: 3
      }
    ],
    commonMistakes: ["Presenting an assumed architecture or metric as a fact from the project."],
    interviewerFollowUps: ["What evidence would make you change that decision?"],
    interviewConnection: "Defend a real project decision with mechanism and evidence."
  };
  const second: AiMlStoryQuestion =
    track === "core-technical"
      ? {
          id: id(2),
          pathKey,
          title: `Evaluate a change to ${name}`,
          format: "production-decision",
          prompt: experienced
            ? `Suppose a proposed change to ${name} improves an offline average but may harm one important user slice. Design a comparison, release gate, and rollback decision. Which evidence would make you reject the change despite the average improvement? Treat this as a hypothetical extension of the resume project.`
            : `Suppose a change to ${name} improves an offline score. What would you check before release, how would you compare it with the current version, and when would you roll back? Treat this as a hypothetical extension of the resume project.`,
          artifact,
          topicKeys: [...topicKeys, "evaluation", "rollout"],
          hints: [
            "Name the user outcome that the offline score is meant to predict.",
            "Compare the changed version with a stable control by meaningful slice.",
            "Set a stop condition and keep the previous version available."
          ],
          answer: {
            concise:
              "Compare against the current version on outcome and safety slices, then release behind measurable gates with rollback.",
            explanation:
              "A credible evaluation names the task outcome, relevant segments, latency or safety constraints, and a controlled rollout. The exact thresholds depend on the project and should be stated as assumptions."
          },
          rubric: [
            {
              criterion: "Choose outcome and slice metrics connected to the stated project.",
              points: 4
            },
            { criterion: "Describe a controlled comparison with the current version.", points: 3 },
            {
              criterion: "Set a defensible release and rollback rule while labeling assumptions.",
              points: 3
            }
          ],
          commonMistakes: ["Treating one offline average as sufficient release evidence."],
          interviewerFollowUps: [
            "Which segment could be harmed while the overall metric improves?"
          ],
          interviewConnection: "Connect model evaluation to a safe production decision."
        }
      : {
          id: id(2),
          pathKey,
          title: `Diagnose a regression in ${name}`,
          format: "production-decision",
          prompt: experienced
            ? `Imagine ${name} has a production quality regression after a release. Choose an immediate containment action, distinguish at least two plausible failure boundaries with evidence, and define a verified re-exposure plan. Treat the incident as hypothetical unless it matches work you actually did.`
            : `Imagine ${name} gets worse after a release. How would you limit user harm, find which part changed, and check that the fix works? Treat the incident as hypothetical unless it matches work you actually did.`,
          artifact,
          topicKeys: [...topicKeys, "incident-response", "rollout"],
          hints: [
            "Stop or reduce the harmful exposure before a long investigation.",
            "Compare the affected slice with a control and inspect changed boundaries.",
            "Verify recovery before exposing users to the repaired version again."
          ],
          answer: {
            concise:
              "Contain the regression, use comparative evidence to isolate the failing boundary, and verify recovery before a guarded release.",
            explanation:
              "Credit a safe immediate action, tests that distinguish competing data, model, or serving causes, and a measurable recovery check. Do not assume the resume specifies a particular production architecture."
          },
          rubric: [
            {
              criterion: "Choose a safe containment action and explain its user impact.",
              points: 4
            },
            { criterion: "Use comparative evidence to distinguish plausible causes.", points: 3 },
            { criterion: "Define recovery verification and guarded re-exposure.", points: 3 }
          ],
          commonMistakes: [
            "Investigating indefinitely while the bad release continues to affect users."
          ],
          interviewerFollowUps: ["What observation would disprove your leading hypothesis?"],
          interviewConnection: "Use project context to practise a production incident response."
        };

  return {
    key: pathKey,
    title: `Your project · ${name}`,
    description: `Practise explaining and defending decisions using the resume evidence from ${name}.`,
    expectedMinutes: experienced ? 30 : 25,
    questions: [first, second]
  };
}

function resumeTopicKeys(evidence: string): string[] {
  const keys = ["project-reasoning"];
  if (/\b(?:rag|retriev\w*|search\w*|embedding\w*|vector\w*)\b/i.test(evidence))
    keys.push("retrieval");
  if (/\b(?:llm|nlp|language|prompt\w*|text)\b/i.test(evidence))
    keys.push("language-models");
  if (/\b(?:vision|image\w*|visual|ocr|detect\w*)\b/i.test(evidence))
    keys.push("computer-vision");
  if (/\b(?:mlops|serving|inference|deploy\w*|pipeline|monitor\w*)\b/i.test(evidence))
    keys.push("model-delivery");
  if (/\b(?:evaluat\w*|classif\w*|predict\w*|metric\w*|fraud)\b/i.test(evidence))
    keys.push("model-evaluation");
  return keys;
}

function clean(value: string, limit: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}
