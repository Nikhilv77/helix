export type BlogSection = {
  heading: string;
  kicker?: string;
  paragraphs: string[];
  bullets?: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  dek: string;
  category: string;
  publishedAt: string;
  readTime: string;
  coverImage: string;
  coverAlt: string;
  metric: string;
  metricLabel: string;
  summary: string[];
  sections: BlogSection[];
  nextPractice: string[];
};

export const blogPosts = [
  {
    slug: "turn-your-resume-into-interview-evidence",
    title: "Turn your resume into interview evidence",
    dek: "A strong resume is not a list of claims. It is a map of the proof you need ready before the interview starts.",
    category: "Resume Strategy",
    publishedAt: "August 9, 2026",
    readTime: "6 min read",
    coverImage: "/images/blog/resume-to-evidence.webp",
    coverAlt: "A resume transforming into structured interview evidence cards",
    metric: "4",
    metricLabel: "Evidence layers",
    summary: [
      "Separate claims from proof before you practice.",
      "Attach scope, tradeoffs, and outcome to every project.",
      "Turn each bullet into one likely follow-up question."
    ],
    sections: [
      {
        kicker: "The shift",
        heading: "Interviewers do not interview your resume. They interview your proof.",
        paragraphs: [
          "Most candidates read their resume like a timeline. Hiring teams read it like a risk document. Every bullet creates a question: what did you actually own, how hard was it, and what changed because you were there?",
          "The easiest way to prepare is to stop treating resume bullets as finished copy. Treat each one as a compact claim that needs evidence behind it."
        ]
      },
      {
        heading: "Build an evidence stack for every important bullet",
        paragraphs: [
          "For each project, capture four layers: the context, your role, the technical or product tradeoff, and the outcome. If any layer is missing, the answer will feel thin under follow-up pressure.",
          "The goal is not to memorize a script. The goal is to make the answer defensible from multiple angles, so you can adapt when the interviewer asks the question differently."
        ],
        bullets: [
          "Context: what was broken, slow, risky, or unclear?",
          "Ownership: what did you decide or build yourself?",
          "Tradeoff: what alternative did you reject and why?",
          "Outcome: what metric, behavior, or team result changed?"
        ]
      },
      {
        heading: "Convert claims into questions",
        paragraphs: [
          "Once the evidence stack exists, write the question your interviewer is likely to ask. A bullet about performance becomes a question about measurement. A bullet about leadership becomes a question about conflict. A bullet about architecture becomes a question about constraints.",
          "This is where practice becomes much more targeted. You are no longer answering generic prompts. You are rehearsing the pressure points created by your own story."
        ]
      }
    ],
    nextPractice: [
      "Pick the three strongest bullets on your resume.",
      "Write the four evidence layers under each one.",
      "Ask one follow-up that would make the claim harder to defend."
    ]
  },
  {
    slug: "practice-interviews-with-pressure-without-rambling",
    title: "Practice interviews with pressure, without rambling",
    dek: "The best mock interview is not longer. It is tighter, more specific, and much less forgiving of vague answers.",
    category: "Mock Interviews",
    publishedAt: "August 9, 2026",
    readTime: "7 min read",
    coverImage: "/images/blog/mock-interview-pressure.webp",
    coverAlt: "A laptop mock interview interface with a microphone and audio waveform",
    metric: "90",
    metricLabel: "Second answer cap",
    summary: [
      "Use time pressure to expose vague answers early.",
      "Practice follow-ups, not just first responses.",
      "Stop when the signal is clear instead of over-explaining."
    ],
    sections: [
      {
        kicker: "The mistake",
        heading: "Most practice rounds reward talking, not clarity.",
        paragraphs: [
          "A candidate can spend twenty minutes answering a mock question and still avoid the hard part. Long answers often hide the missing evidence because there is enough language around the gap.",
          "Pressure helps because it forces structure. If you cannot explain the setup, decision, and result inside a short window, the problem is usually not confidence. It is answer design."
        ]
      },
      {
        heading: "Use a hard cap for the first answer",
        paragraphs: [
          "Start with a ninety-second cap. That is enough room for a clear story, but not enough room to wander through every detail. The first pass should land the headline, the constraint, your action, and the result.",
          "After that, let the follow-up do the deeper work. Real interviews are conversational. A clean first answer gives the interviewer something precise to inspect."
        ],
        bullets: [
          "Open with the result or decision, not background.",
          "Name the constraint before describing the work.",
          "Use one concrete metric, even if it is directional.",
          "Leave one obvious thread for a follow-up."
        ]
      },
      {
        heading: "Practice interruption as a feature",
        paragraphs: [
          "A good interviewer may interrupt when an answer becomes vague. That can feel harsh in practice, but it is useful. It shows exactly where the story lost signal.",
          "When you get interrupted, do not restart the whole answer. Land the missing piece. The skill is recovery, not perfection."
        ]
      }
    ],
    nextPractice: [
      "Record one answer with a ninety-second timer.",
      "Mark the first sentence where you drift into background.",
      "Rewrite the answer so the result appears before the midpoint."
    ]
  },
  {
    slug: "use-interview-reports-to-improve-faster",
    title: "Use interview reports to improve faster",
    dek: "A useful report does not bury you in charts. It tells you what changed, what still leaks signal, and what to fix next.",
    category: "Feedback Loops",
    publishedAt: "August 9, 2026",
    readTime: "5 min read",
    coverImage: "/images/blog/report-feedback-loop.webp",
    coverAlt: "A polished report dashboard with score rings, evidence bars, and improvement arrows",
    metric: "1",
    metricLabel: "Next focus",
    summary: [
      "Look for the one failure pattern that repeated.",
      "Separate delivery issues from evidence issues.",
      "Make the next round smaller and sharper."
    ],
    sections: [
      {
        kicker: "The loop",
        heading: "Feedback only works when it chooses.",
        paragraphs: [
          "A report with ten recommendations feels productive, but it usually slows improvement. Candidates need a narrow next move: one answer pattern to fix, one skill to repeat, one metric to watch.",
          "The best feedback loop is simple. Practice, review, choose the next focus, then practice again with that focus visible."
        ]
      },
      {
        heading: "Diagnose the type of miss",
        paragraphs: [
          "Most weak interview answers fail in one of two ways. Either the evidence is missing, or the delivery hides it. Those problems need different fixes.",
          "If the evidence is missing, rehearse the project details. If the delivery hides it, tighten the structure and remove background. A good report should make that difference obvious."
        ],
        bullets: [
          "Evidence miss: no metric, vague ownership, missing tradeoff.",
          "Delivery miss: slow setup, repeated points, unclear ending.",
          "Readiness signal: specific proof appears before the follow-up."
        ]
      },
      {
        heading: "Make the next round smaller",
        paragraphs: [
          "After a full mock interview, resist the urge to practice everything again. Pick one answer type and run a smaller round around it.",
          "Small loops make improvement visible. They also keep practice emotionally manageable, which matters more than most candidates admit."
        ]
      }
    ],
    nextPractice: [
      "Read your last mock feedback and choose one repeated issue.",
      "Decide whether it is an evidence problem or a delivery problem.",
      "Run a ten-minute follow-up round focused only on that issue."
    ]
  }
] satisfies BlogPost[];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
