import type { DsaTemplateLanguage } from "./dsa-code-templates";

const DSA_DRAFT_PREFIX = "trailgrad.dsa-draft.v1";
const MAX_DRAFT_LENGTH = 20_000;

type DraftStorage = Pick<Storage, "getItem" | "setItem">;

export function dsaCodeDraftKey(slug: string, language: DsaTemplateLanguage): string {
  return `${DSA_DRAFT_PREFIX}:${encodeURIComponent(slug)}:${language}`;
}

export function readDsaCodeDraft(
  storage: DraftStorage,
  slug: string,
  language: DsaTemplateLanguage
): string | null {
  try {
    const draft = storage.getItem(dsaCodeDraftKey(slug, language));
    return draft && draft.length <= MAX_DRAFT_LENGTH ? draft : null;
  } catch {
    return null;
  }
}

export function writeDsaCodeDraft(
  storage: DraftStorage,
  slug: string,
  language: DsaTemplateLanguage,
  code: string
): boolean {
  if (code.length > MAX_DRAFT_LENGTH) return false;
  try {
    storage.setItem(dsaCodeDraftKey(slug, language), code);
    return true;
  } catch {
    return false;
  }
}
