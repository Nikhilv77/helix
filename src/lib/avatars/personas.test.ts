import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ALL_PERSONAS,
  DEFAULT_TEACHER_SELECTION_ID,
  INTERVIEWERS,
  MAYA,
  ONBOARDING_PERSONAS,
  SELECTABLE_TEACHERS,
  personaById,
  personaForSession,
  selectableTeacherById,
  welcomePersonaFromQuery,
  type PersonaGender
} from "./personas";

/**
 * Gender of every Deepgram voice the cast uses, taken from the `feminine` /
 * `masculine` tags on Deepgram's live model list rather than guessed from the
 * name. Aura-1 and Aura-2 use different model ids, so this checked-in table
 * also prevents a valid voice from one generation being sent as the other.
 */
const VOICE_GENDER: Record<string, PersonaGender> = {
  "aura-2-asteria-en": "feminine",
  "aura-2-aurora-en": "feminine",
  "aura-2-helena-en": "feminine",
  "aura-2-thalia-en": "feminine",
  "aura-2-theia-en": "feminine",
  "aura-2-vesta-en": "feminine",
  "aura-2-athena-en": "feminine",
  "aura-2-mars-en": "masculine",
  "aura-2-neptune-en": "masculine",
  "aura-2-apollo-en": "masculine",
  "aura-2-arcas-en": "masculine",
  "aura-2-atlas-en": "masculine",
  "aura-2-orion-en": "masculine",
  "aura-2-zeus-en": "masculine",
  "aura-asteria-en": "feminine",
  "aura-stella-en": "feminine",
  "aura-hera-en": "feminine",
  "aura-luna-en": "feminine",
  "aura-orion-en": "masculine",
  "aura-arcas-en": "masculine",
  "aura-perseus-en": "masculine",
  "aura-zeus-en": "masculine"
};

/**
 * Morph targets AvatarStage drives. Each entry is a set of alternatives: the
 * rig accepts `jawOpen` or `mouthOpen`, and a combined `mouthSmile` or the
 * split left/right pair, so a model only has to satisfy one option per row.
 */
const REQUIRED_MORPHS: string[][] = [
  ["jawOpen", "mouthOpen"],
  ["mouthClose"],
  ["mouthSmile", "mouthSmileLeft"],
  ["mouthSmile", "mouthSmileRight"],
  ["browInnerUp"],
  ["eyeBlinkLeft"],
  ["eyeBlinkRight"],
  ["viseme_aa"],
  ["viseme_E"],
  ["viseme_I"],
  ["viseme_O"],
  ["viseme_U"],
  ["viseme_sil"],
  ["viseme_PP"]
];

/** Morph target names declared by a .glb, read straight from its JSON chunk. */
function morphTargetsOf(modelPath: string): Set<string> {
  const file = readFileSync(join(process.cwd(), "public", modelPath));
  // GLB: 12-byte header, then a JSON chunk with its own 8-byte length/type.
  const jsonLength = file.readUInt32LE(12);
  const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString("utf8"));

  const names = new Set<string>();
  for (const mesh of gltf.meshes ?? []) {
    for (const name of mesh.extras?.targetNames ?? []) names.add(name);
  }
  return names;
}

describe("interviewer personas", () => {
  it("gives every persona a unique id", () => {
    const ids = ALL_PERSONAS.map((persona) => persona.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the intended onboarding carousel order", () => {
    expect(ONBOARDING_PERSONAS.map((persona) => persona.id)).toEqual([
      "ryan",
      "sophia",
      "maya",
      "olivia",
      "daniel",
      "ethan",
      "pooja",
      "alex"
    ]);
    expect(SELECTABLE_TEACHERS).toEqual(ONBOARDING_PERSONAS);

    const centre = ONBOARDING_PERSONAS.findIndex(
      (persona) => persona.id === DEFAULT_TEACHER_SELECTION_ID
    );
    expect(ONBOARDING_PERSONAS[centre]?.id).toBe("sophia");
    expect(
      ONBOARDING_PERSONAS[(centre - 1 + ONBOARDING_PERSONAS.length) % ONBOARDING_PERSONAS.length]
        ?.id
    ).toBe("ryan");
    expect(ONBOARDING_PERSONAS[(centre + 1) % ONBOARDING_PERSONAS.length]?.id).toBe("maya");
  });

  it("keeps James and Claire available only as interviewers", () => {
    expect(SELECTABLE_TEACHERS.map((persona) => persona.id)).not.toContain("james");
    expect(SELECTABLE_TEACHERS.map((persona) => persona.id)).not.toContain("claire");
    expect(selectableTeacherById("james")).toBeNull();
    expect(selectableTeacherById("claire")).toBeNull();
    expect(personaById("james")?.name).toBe("James");
    expect(personaById("claire")?.name).toBe("Claire");
  });

  it("only shares a voice for the intentionally separated Pooja and Olivia pair", () => {
    const personasByVoice = new Map<string, string[]>();
    for (const persona of ALL_PERSONAS) {
      const ids = personasByVoice.get(persona.voice) ?? [];
      ids.push(persona.id);
      personasByVoice.set(persona.voice, ids);
    }

    const sharedVoices = [...personasByVoice.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([voice, ids]) => ({ voice, ids: ids.sort() }));

    expect(sharedVoices).toEqual([{ voice: "aura-luna-en", ids: ["olivia", "pooja"] }]);
  });

  it.each(ALL_PERSONAS)("$name ships a model the rig can drive", (persona) => {
    const targets = morphTargetsOf(persona.model);
    const missing = REQUIRED_MORPHS.filter(
      (alternatives) => !alternatives.some((name) => targets.has(name))
    );
    expect(missing).toEqual([]);
  });

  it.each(ALL_PERSONAS)("$name keeps its rig inside the usable range", (persona) => {
    const { restingSmile, blinkIntervalMs, motion, browActivity, mouthActivity } = persona.rig;
    // Past roughly 0.08 the smile target pushes the lips out into a pout.
    expect(restingSmile).toBeGreaterThanOrEqual(0);
    expect(restingSmile).toBeLessThanOrEqual(0.08);
    expect(blinkIntervalMs[0]).toBeLessThan(blinkIntervalMs[1]);
    expect(blinkIntervalMs[0]).toBeGreaterThan(0);
    expect(motion).toBeGreaterThan(0);
    expect(browActivity).toBeGreaterThanOrEqual(0);
    if (mouthActivity !== undefined) {
      expect(mouthActivity).toBeGreaterThan(0);
      // A few model exports have notably quieter mouth targets. The safe
      // upper bound still leaves the authored shapes below their extremes.
      expect(mouthActivity).toBeLessThanOrEqual(1.4);
    }
  });

  it.each(ALL_PERSONAS)("$name speaks with a voice matching the face", (persona) => {
    // An unlisted voice means nobody checked it against Deepgram — which is how
    // a non-existent model id would otherwise reach production and fail at
    // synthesis rather than at build.
    expect(VOICE_GENDER[persona.voice]).toBeDefined();
    expect(VOICE_GENDER[persona.voice]).toBe(persona.gender);
  });

  it("gives every persona a greeting that names nobody else", () => {
    for (const persona of ALL_PERSONAS) {
      expect(persona.greeting.length).toBeGreaterThan(10);
      const impostors = ALL_PERSONAS.filter(
        (other) => other.id !== persona.id && persona.greeting.includes(other.name)
      );
      expect(impostors).toEqual([]);
    }
  });

  it("introduces every persona in their own words", () => {
    const bios = new Set<string>();
    const taglines = new Set<string>();

    for (const persona of ALL_PERSONAS) {
      // The picker renders these directly; an empty one leaves a blank card.
      expect(persona.tagline.trim().length).toBeGreaterThan(8);
      expect(persona.bio.trim().length).toBeGreaterThan(40);

      // Copy pasted between two teachers is the failure this guards: the whole
      // step exists so they read as different people.
      bios.add(persona.bio);
      taglines.add(persona.tagline);

      const impostors = ALL_PERSONAS.filter(
        (other) => other.id !== persona.id && persona.bio.includes(other.name)
      );
      expect(impostors).toEqual([]);
    }

    expect(bios.size).toBe(ALL_PERSONAS.length);
    expect(taglines.size).toBe(ALL_PERSONAS.length);
  });

  it("returns the same interviewer for a session every time", () => {
    const first = personaForSession("session-abc123");
    expect(personaForSession("session-abc123")).toBe(first);
    expect(INTERVIEWERS).toContain(first);
  });

  it("falls back to Maya without a session", () => {
    expect(personaForSession(null)).toBe(MAYA);
    expect(personaForSession("")).toBe(MAYA);
  });

  it("spreads sessions across the whole cast", () => {
    const seen = new Set(
      Array.from({ length: 3000 }, (_, i) => personaForSession(`session-${i}`).id)
    );
    expect(seen.size).toBe(INTERVIEWERS.length);
  });

  it("looks personas up by id", () => {
    expect(personaById("daniel")?.name).toBe("Daniel");
    expect(personaById("nobody")).toBeNull();
    expect(personaById(null)).toBeNull();
  });

  it("recognizes every valid teacher in welcome links", () => {
    expect(welcomePersonaFromQuery("claire")?.name).toBe("Claire");
    expect(welcomePersonaFromQuery("maya")?.name).toBe("Maya");
    expect(welcomePersonaFromQuery("nobody")).toBeNull();
  });
});
