import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AiService } from "../ai/ai.service";
import { Logger } from "../common/logger";
import { ROUND_TYPES } from "../interview/types";
import type { CandidateProfile } from "@/lib/shared/types";
import type { Curriculum, CurriculumSession } from "@/lib/curriculum/curriculum";

const sessionSchema = z.object({
  title: z.string().min(4).max(70),
  summary: z.string().min(10).max(150),
  roundType: z.enum(ROUND_TYPES),
  minutes: z.number().int().min(5).max(20),
  coachNote: z.string().min(20).max(320),
  objective: z.string().min(20).max(240),
  keyIdeas: z
    .array(z.object({ title: z.string().min(3).max(60), detail: z.string().min(20).max(280) }))
    .min(2)
    .max(4),
  framework: z.object({
    name: z.string().min(2).max(40),
    steps: z
      .array(z.object({ label: z.string().min(2).max(28), detail: z.string().min(10).max(160) }))
      .min(3)
      .max(5)
  }),
  pitfalls: z.array(z.string().min(10).max(180)).min(2).max(4),
  evidenceAnchors: z.array(z.string().min(3).max(120)).min(1).max(4),
  agenda: z.array(z.string().min(10).max(200)).min(3).max(4)
});

const curriculumSchema = z.object({
  headline: z.string().min(10).max(140),
  sessions: z.array(sessionSchema).min(4).max(6)
});

const SYSTEM_INSTRUCTION = `You are Maya, an interview coach building a short, personal preparation plan.

You are given one candidate's verified resume evidence and target role. Design sessions that teach before they test: each one explains what a round is really assessing, gives a usable answer structure, then interviews the candidate on their own material.

Ground everything in the evidence provided. Never invent employers, projects, metrics, or technologies. Where the evidence is thin, say so plainly in the coach note and build a session that helps them fix it.`;

export class CurriculumService {
  private readonly logger = new Logger(CurriculumService.name);

  constructor(private readonly ai: AiService) {}

  async build(profile: CandidateProfile): Promise<Curriculum> {
    try {
      const generated = await this.ai.generateStructured({
        operation: "curriculum.build",
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt: buildPrompt(profile),
        schema: curriculumSchema,
        modelClass: "fast",
        temperature: 0.35
      });

      return {
        builtAt: Date.now(),
        headline: generated.headline,
        sessions: generated.sessions.map((session, index) => ({
          ...session,
          id: randomUUID(),
          order: index + 1
        }))
      };
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "curriculum.build.fallback",
          reason: error instanceof Error ? error.message : "unknown"
        })
      );
      return fallbackCurriculum(profile);
    }
  }
}

function buildPrompt(profile: CandidateProfile): string {
  const resume = profile.resume;
  const experience = (resume?.experience ?? [])
    .map(
      (entry) =>
        `- ${entry.role || "Role"} at ${entry.organization}${entry.period ? ` (${entry.period})` : ""}: ${entry.summary} ${entry.achievements.join(" ")}`
    )
    .join("\n");
  const stories = profile.stories
    .map((story) => `- ${story.title}: ${story.situation} ${story.action} ${story.outcome}`)
    .join("\n");

  return `Target role: ${profile.targetRole ?? "unspecified"}
Experience level: ${profile.level ?? "unspecified"}
Headline: ${profile.headline}
Focus areas the candidate picked: ${profile.focusAreas.join(", ") || "none"}

Verified experience:
${experience || "None verified."}

Candidate's own stories:
${stories || "None recorded."}

Skills the resume supports: ${(resume?.skills ?? []).join(", ") || "none"}
Gaps Trailgrad already flagged: ${(resume?.warnings ?? []).join(" ") || "none"}

Design 4-6 sessions, ordered so each builds on the last. Rules:
- roundType must be one of behavioral, technical, hiring-manager, and must suit the session's subject.
- title is short and concrete, in the candidate's language, not interview jargon.
- coachNote speaks directly to this candidate ("you"), naming their evidence, and says why this session comes at this point in the plan.
- objective states what an interviewer is actually assessing in this round.
- keyIdeas teach: each is a principle plus how to apply it, not a platitude.
- framework is a named answer structure with 3-5 ordered steps the candidate can hold in their head.
- pitfalls are mistakes this candidate is likely to make given their evidence.
- evidenceAnchors quote or name real items from the material above.
- agenda is what the interview covers, phrased as instructions to an interviewer, and must stay inside this session's subject.
- headline is one line describing the plan as a whole.`;
}

/** Used when the model is unavailable, so the workspace is never empty. */
function fallbackCurriculum(profile: CandidateProfile): Curriculum {
  const anchor =
    profile.resume?.experience[0]?.organization ?? profile.stories[0]?.title ?? "your work";

  const sessions: Array<Omit<CurriculumSession, "id" | "order">> = [
    {
      title: "Tell the story of your work",
      summary: "Set the scene once, clearly, so every later answer has context.",
      roundType: "behavioral",
      minutes: 10,
      coachNote: `We start here because every other round assumes the interviewer already understands what you did at ${anchor}. Get this crisp and the rest gets easier.`,
      objective: "Whether you can frame your scope and ownership without rambling.",
      keyIdeas: [
        {
          title: "Lead with the shape of the problem",
          detail:
            "Two sentences on what the system or product had to do, before any technology names. Interviewers cannot judge decisions they cannot situate."
        },
        {
          title: "Separate you from the team",
          detail:
            "Say what you personally decided or built. 'We' hides the evidence an interviewer is listening for."
        }
      ],
      framework: {
        name: "Context, role, result",
        steps: [
          { label: "Context", detail: "What existed before, and what was wrong with it." },
          { label: "Your role", detail: "The part you owned, and who owned the rest." },
          { label: "Result", detail: "What changed, measured however you actually measured it." }
        ]
      },
      pitfalls: [
        "Opening with a tool list instead of the problem.",
        "Describing team outcomes without naming your own contribution."
      ],
      evidenceAnchors: [anchor],
      agenda: [
        "Establish what the candidate personally owned and the shape of the problem",
        "Press for the decision they made without asking anyone",
        "Test how they know the work mattered"
      ]
    },
    {
      title: "Defend one decision",
      summary: "Pick a real trade-off and hold it up to pressure.",
      roundType: "technical",
      minutes: 12,
      coachNote:
        "Interviewers do not test whether you were right. They test whether you knew what you were choosing between.",
      objective: "Whether your decisions were reasoned or inherited.",
      keyIdeas: [
        {
          title: "Name the alternative you rejected",
          detail:
            "A decision with no discarded option reads as a default. State the other path and the cost that ruled it out."
        },
        {
          title: "Know your constraint",
          detail:
            "Time, data volume, team size, or money. Every real decision is downstream of one; say which."
        }
      ],
      framework: {
        name: "Options, constraint, consequence",
        steps: [
          { label: "Options", detail: "The two or three paths that were genuinely on the table." },
          { label: "Constraint", detail: "The thing that made the choice for you." },
          {
            label: "Consequence",
            detail: "What it cost you later, and whether you would repeat it."
          }
        ]
      },
      pitfalls: [
        "Describing what you built rather than why that shape.",
        "Claiming there was no alternative worth considering."
      ],
      evidenceAnchors: [anchor],
      agenda: [
        "Get one consequential design decision from the candidate's real work",
        "Press on the alternative they rejected and why",
        "Find what the choice cost them afterwards"
      ]
    },
    {
      title: "Own what went wrong",
      summary: "A failure told without polish, and what changed after.",
      roundType: "behavioral",
      minutes: 10,
      coachNote:
        "This is the round candidates rehearse least and interviewers weigh most. A specific failure with a specific fix beats a tidy non-answer.",
      objective: "Whether you can hold responsibility without collapsing or deflecting.",
      keyIdeas: [
        {
          title: "Pick something that actually cost something",
          detail:
            "An outage, a rewrite, a missed call. Failures with no consequence read as evasion."
        },
        {
          title: "End on the change, not the apology",
          detail: "What did you or the team do differently afterwards, in process or in code?"
        }
      ],
      framework: {
        name: "What happened, your part, what changed",
        steps: [
          { label: "What happened", detail: "The symptom, and who noticed it first." },
          { label: "Your part", detail: "Your own contribution to it, stated plainly." },
          { label: "What changed", detail: "The concrete thing that stops a repeat." }
        ]
      },
      pitfalls: [
        "Choosing a failure that was really someone else's.",
        "Stopping at the lesson without naming the change."
      ],
      evidenceAnchors: [anchor],
      agenda: [
        "Get one specific failure or decision that went wrong",
        "Establish the candidate's own part in it",
        "Find what concretely changed afterwards"
      ]
    },
    {
      title: "Make the impact land",
      summary: "Turn your numbers into something an interviewer can trust.",
      roundType: "hiring-manager",
      minutes: 12,
      coachNote:
        "Numbers on a resume invite exactly one question: compared to what? Have the baseline ready.",
      objective: "Whether your claimed impact survives a follow-up.",
      keyIdeas: [
        {
          title: "Always carry the baseline",
          detail: "A number without a before is decoration. Know what it was and how you measured."
        },
        {
          title: "Attribute honestly",
          detail:
            "Say what else was changing at the same time. Interviewers trust the candidate who volunteers it."
        }
      ],
      framework: {
        name: "Before, change, after",
        steps: [
          { label: "Before", detail: "The number, and how it was measured." },
          { label: "Change", detail: "What you did, and over what period." },
          { label: "After", detail: "The new number, plus what else could explain it." }
        ]
      },
      pitfalls: [
        "Quoting a percentage with no baseline.",
        "Taking credit for a number the whole team moved."
      ],
      evidenceAnchors: [anchor],
      agenda: [
        "Pick a quantified claim and establish the baseline",
        "Ask how it was measured and by whom",
        "Separate the candidate's contribution from other causes"
      ]
    }
  ];

  return {
    builtAt: Date.now(),
    headline: "A four-session plan built from the evidence in your resume.",
    sessions: sessions.map((session, index) => ({
      ...session,
      id: randomUUID(),
      order: index + 1
    }))
  };
}
