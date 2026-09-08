export type PreparationReplay = {
  status: string;
  focusRevisionId?: string;
  blockId: string | null;
};

export async function resolveStoryPracticePreparationReplay<TBlock>(input: {
  existing: PreparationReplay | null;
  focusRevisionId: string;
  succeededStatus: string;
  inProgressStatus: string;
  current(): Promise<TBlock | null>;
  requestConflict(): Error;
  inProgress(): Error;
}): Promise<{ replayed: true; block: TBlock | null } | null> {
  if (
    input.existing?.focusRevisionId !== undefined &&
    input.existing.focusRevisionId !== input.focusRevisionId
  ) {
    throw input.requestConflict();
  }
  if (input.existing?.status === input.succeededStatus && input.existing.blockId) {
    return { replayed: true, block: await input.current() };
  }
  if (input.existing?.status === input.inProgressStatus) throw input.inProgress();
  return null;
}

export async function confirmStoryPracticeFocus<TFocus, TSaved, TPublic>(input: {
  confirm(): Promise<TFocus>;
  save(focus: TFocus): Promise<TSaved>;
  present(focus: TFocus, saved: TSaved): TPublic;
}): Promise<TPublic> {
  const focus = await input.confirm();
  const saved = await input.save(focus);
  return input.present(focus, saved);
}

export function storyPracticeFailureCode(prefix: string, stage: string): string {
  return `${prefix}_${stage.replaceAll("-", "_").toUpperCase()}_FAILED`;
}

export function boundedStoryPracticeDiagnostic(error: unknown, fallback: string): string {
  return (error instanceof Error ? error.message : fallback).slice(0, 700);
}
