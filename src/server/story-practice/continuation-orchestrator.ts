export async function resolveStoryPracticeContinuationReplay<TBlock>(input: {
  existing: { status: string; blockId: string | null } | null;
  succeededStatus: string;
  inProgressStatus: string;
  current(): Promise<TBlock | null>;
  inProgress(): Error;
}): Promise<{ replayed: true; block: TBlock | null } | null> {
  if (input.existing?.status === input.succeededStatus && input.existing.blockId) {
    return { replayed: true, block: await input.current() };
  }
  if (input.existing?.status === input.inProgressStatus) throw input.inProgress();
  return null;
}

export function assertStoryPracticeContinuationReady<TReport>(
  block: {
    status: string;
    assessment: { status: string; report: TReport | null } | null;
  },
  notReady: () => Error
): asserts block is {
  status: string;
  assessment: { status: string; report: TReport };
} {
  if (
    block.status !== "ASSESSED" ||
    block.assessment?.status !== "COMPLETED" ||
    !block.assessment.report
  ) {
    throw notReady();
  }
}
