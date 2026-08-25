/**
 * The interviewers.
 *
 * A persona is a model plus a voice plus a handful of rig constants. The
 * constants matter more than they look: AvatarStage drives every face through
 * the same amplitude-based mouth rig, so two personas sharing a mesh still read
 * as different people once their blink rate, resting mouth and idle motion
 * differ. Personality is mostly not geometry.
 *
 * Models live in /public/avatars. Every one of them must carry ARKit
 * blendshapes and Oculus visemes — see the README there.
 */

export interface AvatarRig {
  /**
   * Resting mouth curve while listening. 0 reads neutral-to-severe, 0.06 is a
   * warm half-smile. Above ~0.08 the RPM and Rocketbox smile targets push the
   * lips out and it turns into a pout.
   */
  restingSmile: number;
  /** Sampled uniformly for the gap between blinks. Faster reads as more alert. */
  blinkIntervalMs: [number, number];
  /** Scales idle breathing and head sway. Below 1 is composed, above is animated. */
  motion: number;
  /** How far the inner brow rides with the jaw while speaking. 0 is deadpan. */
  browActivity: number;
}

/**
 * Presented gender of the model, so a face is never paired with a voice that
 * contradicts it. Matches Deepgram's own `feminine` / `masculine` voice tags.
 */
export type PersonaGender = "feminine" | "masculine";

export interface InterviewerPersona {
  id: string;
  /** Shown to candidates. */
  name: string;
  /** Path under /public. */
  model: string;
  gender: PersonaGender;
  /**
   * Deepgram Aura-2 model id — the voice is baked into the id, there is no
   * separate voice parameter. Mirrors TRAILGRAD_TTS_MODEL in the agent.
   *
   * Every id here was checked against Deepgram's live model list; three
   * plausible-looking names that do not exist (`stella`, `perseus`, `angus`)
   * were caught that way. Verify a new one before shipping it, because a bad id
   * fails at synthesis time rather than at build time.
   */
  voice: string;
  /** Browser playback multiplier for generated voice clips. Defaults to 1. */
  speechRate?: number;
  /** One line of manner, for briefing copy and prompt conditioning. */
  manner: string;
  /**
   * Short label under the name on the picker — how they'd describe their own
   * style in three or four words.
   */
  tagline: string;
  /**
   * First-person intro shown under the avatar on the picker. Written in their
   * own voice, because the whole point of the step is deciding whose company
   * you want for an hour.
   */
  bio: string;
  /** Spoken on the picker so a candidate hears the voice before committing. */
  greeting: string;
  rig: AvatarRig;
}

export const DEFAULT_RIG: AvatarRig = {
  restingSmile: 0.025,
  blinkIntervalMs: [2600, 6400],
  motion: 1,
  browActivity: 0.12
};

/**
 * Maya is the default for older profiles and the first onboarding option. Once
 * someone chooses a teacher, that persona follows them throughout the app.
 */
export const MAYA: InterviewerPersona = {
  id: "maya",
  name: "Maya",
  model: "/avatars/maya.glb",
  gender: "feminine",
  voice: "aura-2-asteria-en",
  manner: "Warm and direct. Keeps the conversation moving.",
  tagline: "Warm, direct, keeps it moving",
  bio: "I'm the one who greets you everywhere else in Trailgrad. Warm, direct, and allergic to wasting your time.",
  greeting: "Hi, I'm Maya. Let's get you ready.",
  rig: DEFAULT_RIG
};

export const INTERVIEWERS: InterviewerPersona[] = [
  {
    id: "claire",
    name: "Claire",
    model: "/avatars/claire.glb",
    gender: "feminine",
    voice: "aura-2-athena-en",
    manner: "Encouraging. Gives you room to finish a thought before probing.",
    tagline: "Encouraging, patient, still probing",
    bio: "I've sat on both sides of this table. You won't get cut off here — finish the thought, then we go deeper together.",
    greeting: "Hey, I'm Claire. No rush with me — take the space you need.",
    rig: { restingSmile: 0.055, blinkIntervalMs: [3000, 6800], motion: 1.05, browActivity: 0.18 }
  },
  {
    id: "daniel",
    name: "Daniel",
    model: "/avatars/daniel.glb",
    gender: "masculine",
    voice: "aura-2-mars-en",
    manner: "Senior and measured. Long pauses, few tells.",
    tagline: "Senior, measured, hard to read",
    bio: "Twelve years, mostly staff level. I ask less than you'd expect and hear more than you'd think. The silence is me thinking, not judging.",
    greeting: "Daniel. Let's get into it.",
    rig: { restingSmile: 0.005, blinkIntervalMs: [4200, 8000], motion: 0.62, browActivity: 0.05 }
  },
  {
    id: "olivia",
    name: "Olivia",
    model: "/avatars/olivia.glb",
    gender: "feminine",
    voice: "aura-2-aurora-en",
    manner: "Sharp and fast. Follows every vague claim to the mechanism.",
    tagline: "Fast, sharp, chases the detail",
    bio: "I move quick and I'll follow every “we basically just…” until there's a real mechanism behind it. Bring specifics and we'll have fun.",
    greeting: "Olivia. Fair warning — I ask a lot of follow-ups.",
    rig: { restingSmile: 0.02, blinkIntervalMs: [2000, 4400], motion: 1.15, browActivity: 0.2 }
  },
  {
    id: "james",
    name: "James",
    model: "/avatars/james.glb",
    gender: "masculine",
    voice: "aura-2-neptune-en",
    manner: "Formal and reserved. Structured, one question at a time.",
    tagline: "Formal, structured, no surprises",
    bio: "One question at a time, in order, no games. If you like knowing exactly where you stand at every moment, we'll get along.",
    greeting: "Good to meet you. I'm James. Shall we begin?",
    rig: { restingSmile: 0.0, blinkIntervalMs: [3800, 7400], motion: 0.72, browActivity: 0.07 }
  },
  {
    id: "pooja",
    name: "Pooja",
    model: "/avatars/pooja.glb",
    gender: "feminine",
    voice: "aura-2-thalia-en",
    speechRate: 1.14,
    manner: "Methodical and warm. Builds from fundamentals upward.",
    tagline: "Methodical, warm, builds up",
    bio: "We start at the foundation and build upward. No skipped steps, no faking confidence. By the end you'll know why, not just what.",
    greeting: "Hi, I'm Pooja. Let's build this from the ground up.",
    rig: { restingSmile: 0.045, blinkIntervalMs: [3200, 6600], motion: 0.95, browActivity: 0.14 }
  },
  {
    id: "alex",
    name: "Alex",
    model: "/avatars/alex.glb",
    gender: "masculine",
    voice: "aura-2-zeus-en",
    manner: "Brisk and pragmatic. Wants the trade-off, not the tour.",
    tagline: "Brisk, pragmatic, trade-offs first",
    bio: "Skip the setup and give me the trade-off. I care about what you'd cut and why — not the guided tour of your architecture.",
    greeting: "Alex. Let's skip the warm-up and get to the interesting part.",
    rig: { restingSmile: 0.015, blinkIntervalMs: [2400, 5200], motion: 1.1, browActivity: 0.13 }
  },
  {
    id: "sophia",
    name: "Sophia",
    model: "/avatars/sophia.glb",
    gender: "feminine",
    voice: "aura-2-theia-en",
    manner: "Calm and analytical. Quiet until something does not add up.",
    tagline: "Calm, analytical, quietly lethal",
    bio: "I stay quiet while you talk, then ask the one question that finds the gap. It's never personal — that's just the interesting part.",
    greeting: "Sophia. I'll listen more than I talk.",
    rig: { restingSmile: 0.02, blinkIntervalMs: [4000, 7600], motion: 0.68, browActivity: 0.08 }
  },
  {
    id: "ryan",
    name: "Ryan",
    model: "/avatars/ryan.glb",
    gender: "masculine",
    voice: "aura-2-arcas-en",
    manner: "Casual and conversational. Low pressure, still thorough.",
    tagline: "Casual, low pressure, thorough",
    bio: "Low stakes, real talk. We're two people figuring out a system together. Still thorough — nobody just needs to sweat through it.",
    greeting: "Hey, what's up? I'm Ryan. Relax, it's just a conversation.",
    rig: { restingSmile: 0.06, blinkIntervalMs: [2800, 6000], motion: 1.25, browActivity: 0.19 }
  },
  {
    id: "ethan",
    name: "Ethan",
    model: "/avatars/ethan.glb",
    gender: "masculine",
    voice: "aura-2-atlas-en",
    manner: "Energetic. Thinks out loud and expects you to as well.",
    tagline: "High energy, thinks out loud",
    bio: "I think out loud and I want you to as well. Half-formed ideas are welcome here — that's usually where the good stuff is hiding.",
    greeting: "Hey! Ethan. Let's think out loud together.",
    rig: { restingSmile: 0.04, blinkIntervalMs: [2200, 4800], motion: 1.35, browActivity: 0.22 }
  }
];

export const ALL_PERSONAS: InterviewerPersona[] = [MAYA, ...INTERVIEWERS];

export function personaById(id: string | null | undefined): InterviewerPersona | null {
  if (!id) return null;
  return ALL_PERSONAS.find((persona) => persona.id === id) ?? null;
}

/**
 * FNV-1a. Only needs to spread ids evenly and agree between server and client,
 * which rules out Math.random and anything seeded by wall-clock time.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The interviewer for a session.
 *
 * Derived from the session id rather than stored, so a candidate who reloads
 * mid-interview does not find a different face waiting, and no migration is
 * needed to ship this. Persist a column and prefer it here once candidates are
 * allowed to choose.
 */
export function personaForSession(sessionId: string | null | undefined): InterviewerPersona {
  if (!sessionId) return MAYA;
  // The index is always in range; the fallback satisfies noUncheckedIndexedAccess.
  return INTERVIEWERS[hash(sessionId) % INTERVIEWERS.length] ?? MAYA;
}
