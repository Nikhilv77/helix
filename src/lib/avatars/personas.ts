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
  /**
   * Per-face multiplier for jaw and viseme movement. Some otherwise identical
   * Avatar rigs exaggerate their mouth shapes more than others.
   */
  mouthActivity?: number;
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
  /** Static headshot used where a live 3D stage would be too heavy or too small. */
  portrait: string;
  gender: PersonaGender;
  /**
   * Deepgram Aura model id — the voice is baked into the id, there is no
   * separate voice parameter. Mirrors TRAILGRAD_TTS_MODEL in the agent.
   *
   * Every id here is checked against Deepgram's live model list. Aura-1 and
   * Aura-2 voice names overlap only partially, so verify both the name and the
   * generation prefix before shipping; a bad id fails at synthesis time.
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
  browActivity: 0.12,
  mouthActivity: 1
};

/**
 * Maya is the safe default for older profiles and remains an onboarding option.
 * Once someone chooses a teacher, that persona follows them throughout the app.
 */
export const MAYA: InterviewerPersona = {
  id: "maya",
  name: "Maya",
  model: "/avatars/maya.glb",
  portrait: "/images/teacher-portraits/maya.jpg",
  gender: "feminine",
  voice: "aura-asteria-en",
  manner: "Clear, confident, and energetic. Turns uncertainty into a concrete next step.",
  tagline: "Clear, confident, knows the way",
  bio: "I bring clarity and momentum when a topic feels messy. We'll find the important idea, make it practical, and keep moving.",
  greeting: "Hi, I'm Maya. We'll make the hard parts clear and keep moving.",
  rig: DEFAULT_RIG
};

export const INTERVIEWERS: InterviewerPersona[] = [
  {
    id: "claire",
    name: "Claire",
    model: "/avatars/claire.glb",
    portrait: "/images/teacher-portraits/claire.jpg",
    gender: "feminine",
    voice: "aura-2-athena-en",
    manner: "Encouraging. Gives you room to finish a thought before probing.",
    tagline: "Encouraging, patient, still probing",
    bio: "I've sat on both sides of this table. You won't get cut off here — finish the thought, then we go deeper together.",
    greeting: "Hey, I'm Claire. No rush with me — take the space you need.",
    rig: {
      restingSmile: 0.055,
      blinkIntervalMs: [3000, 6800],
      motion: 1.05,
      browActivity: 0.18,
      mouthActivity: 1.04
    }
  },
  {
    id: "daniel",
    name: "Daniel",
    model: "/avatars/daniel.glb",
    portrait: "/images/teacher-portraits/daniel.jpg",
    gender: "masculine",
    voice: "aura-orion-en",
    manner: "Calm and approachable. Makes difficult ideas comfortable to work through.",
    tagline: "Calm, approachable, easy to think with",
    bio: "I keep the room calm enough for you to think properly. Take your time, talk it through, and we'll make the difficult parts manageable together.",
    greeting: "Hi, I'm Daniel. Take your time—we'll work through it together.",
    rig: {
      restingSmile: 0.005,
      blinkIntervalMs: [4200, 8000],
      motion: 0.62,
      browActivity: 0.05,
      mouthActivity: 1.1
    }
  },
  {
    id: "olivia",
    name: "Olivia",
    model: "/avatars/olivia.glb",
    portrait: "/images/teacher-portraits/olivia.jpg",
    gender: "feminine",
    voice: "aura-luna-en",
    manner: "Friendly and naturally engaging. Keeps practice conversational without losing the point.",
    tagline: "Friendly, natural, keeps you engaged",
    bio: "I like practice to feel like a real conversation, not a lecture. We'll stay curious, keep the energy easy, and still get to the useful detail.",
    greeting: "Hey, I'm Olivia. Let's make this feel like a real conversation.",
    rig: {
      restingSmile: 0.02,
      blinkIntervalMs: [2000, 4400],
      motion: 1.15,
      browActivity: 0.2,
      mouthActivity: 1.03
    }
  },
  {
    id: "james",
    name: "James",
    model: "/avatars/james.glb",
    portrait: "/images/teacher-portraits/james.jpg",
    gender: "masculine",
    voice: "aura-2-neptune-en",
    manner: "Formal and reserved. Structured, one question at a time.",
    tagline: "Formal, structured, no surprises",
    bio: "One question at a time, in order, no games. If you like knowing exactly where you stand at every moment, we'll get along.",
    greeting: "Good to meet you. I'm James. Shall we begin?",
    rig: {
      restingSmile: 0.0,
      blinkIntervalMs: [3800, 7400],
      motion: 0.72,
      browActivity: 0.07,
      mouthActivity: 1.12
    }
  },
  {
    id: "pooja",
    name: "Pooja",
    model: "/avatars/pooja.glb",
    portrait: "/images/teacher-portraits/pooja.jpg",
    gender: "feminine",
    voice: "aura-hera-en",
    manner: "Warm and professional. Gives polished guidance without making it feel formal.",
    tagline: "Warm, polished, quietly reassuring",
    bio: "I bring a warm, professional rhythm to practice. We'll work carefully, communicate clearly, and turn rough answers into polished ones.",
    greeting: "Hi, I'm Pooja. Let's work through this clearly, one step at a time.",
    rig: {
      restingSmile: 0.045,
      blinkIntervalMs: [3200, 6600],
      motion: 0.95,
      browActivity: 0.14,
      mouthActivity: 1.04
    }
  },
  {
    id: "alex",
    name: "Alex",
    model: "/avatars/alex.glb",
    portrait: "/images/teacher-portraits/alex.jpg",
    gender: "masculine",
    voice: "aura-zeus-en",
    manner: "Grounded and reassuring. Gives direct advice with a steady, trustworthy presence.",
    tagline: "Grounded, smooth, straight with you",
    bio: "I'll give you the honest version without making the room tense. We'll focus on what matters, make sound choices, and build confidence from there.",
    greeting: "I'm Alex. Let's look at what matters and make a solid plan.",
    rig: {
      restingSmile: 0.015,
      blinkIntervalMs: [2400, 5200],
      motion: 1.1,
      browActivity: 0.13,
      // Alex's mouth targets have a larger authored range than the rest of the
      // cast. Keep his speech clear without stretching the lips into a pout.
      mouthActivity: 0.72
    }
  },
  {
    id: "sophia",
    name: "Sophia",
    model: "/avatars/sophia.glb",
    portrait: "/images/teacher-portraits/sophia.jpg",
    gender: "feminine",
    voice: "aura-stella-en",
    manner: "Clear and professional. Keeps you engaged while turning vague ideas into precise ones.",
    tagline: "Clear, professional, keeps you sharp",
    bio: "I keep the conversation focused and engaging. Bring me the rough version of an idea and we'll sharpen it until it is precise and convincing.",
    greeting: "Hi, I'm Sophia. Let's sharpen the idea until it holds up.",
    rig: {
      restingSmile: 0.02,
      blinkIntervalMs: [4000, 7600],
      motion: 0.68,
      browActivity: 0.08,
      mouthActivity: 1.06
    }
  },
  {
    id: "ryan",
    name: "Ryan",
    model: "/avatars/ryan.glb",
    portrait: "/images/teacher-portraits/ryan.jpg",
    gender: "masculine",
    voice: "aura-perseus-en",
    manner: "Confident and precise. Pushes for clear reasoning and professional communication.",
    tagline: "Confident, precise, raises the bar",
    bio: "I'll help you sound as capable as your thinking really is. We'll tighten the reasoning, remove the ambiguity, and make every answer interview-ready.",
    greeting: "Ryan here. Let's make your thinking clear and interview-ready.",
    rig: {
      restingSmile: 0.06,
      blinkIntervalMs: [2800, 6000],
      motion: 1.25,
      browActivity: 0.19,
      // Ryan's model has the least pronounced jaw target in the cast.
      mouthActivity: 1.34
    }
  },
  {
    id: "ethan",
    name: "Ethan",
    model: "/avatars/ethan.glb",
    portrait: "/images/teacher-portraits/ethan.jpg",
    gender: "masculine",
    voice: "aura-arcas-en",
    manner: "Natural and easygoing. Explains clearly and keeps the session comfortable.",
    tagline: "Natural, smooth, easy to learn with",
    bio: "I keep things relaxed so you can focus on understanding. Ask the unfinished question, think out loud, and we'll make the idea click without forcing it.",
    greeting: "Hey, I'm Ethan. Get comfortable—we'll make this click.",
    rig: {
      restingSmile: 0.04,
      blinkIntervalMs: [2200, 4800],
      motion: 1.35,
      browActivity: 0.22,
      mouthActivity: 1.1
    }
  }
];

export const ALL_PERSONAS: InterviewerPersona[] = [MAYA, ...INTERVIEWERS];

/**
 * Coaches a candidate may choose for everyday practice. James and Claire are
 * intentionally interview-only: James owns the general interview room, while
 * Claire owns DSA and Core Technical assessments.
 */
export const SELECTABLE_TEACHERS: InterviewerPersona[] = ALL_PERSONAS.filter(
  (persona) => persona.id !== "james" && persona.id !== "claire"
);

/**
 * Presentation order for the onboarding carousel. This is intentionally kept
 * separate from `INTERVIEWERS`, whose order participates in the deterministic
 * session fallback for older interview records.
 */
export const ONBOARDING_PERSONAS: InterviewerPersona[] = [
  "alex",
  "pooja",
  "olivia",
  "ethan",
  "ryan",
  "daniel",
  "sophia",
  "maya"
].map((id) => {
  const persona = SELECTABLE_TEACHERS.find((candidate) => candidate.id === id);
  if (!persona) throw new Error(`Unknown onboarding persona: ${id}`);
  return persona;
});

export function personaById(id: string | null | undefined): InterviewerPersona | null {
  if (!id) return null;
  return ALL_PERSONAS.find((persona) => persona.id === id) ?? null;
}

/** Rejects interview-only personas when reading or saving a coach choice. */
export function selectableTeacherById(id: string | null | undefined): InterviewerPersona | null {
  if (!id) return null;
  return SELECTABLE_TEACHERS.find((persona) => persona.id === id) ?? null;
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

/**
 * Reads the `?welcome=` parameter that follows onboarding.
 *
 * It used to be the literal `maya`, from when she was the only teacher. It now
 * carries whichever teacher the candidate picked, and `maya` still resolves so
 * links already sent out keep working.
 */
export function welcomePersonaFromQuery(
  value: string | null | undefined
): InterviewerPersona | null {
  return personaById(value?.trim().toLowerCase());
}
