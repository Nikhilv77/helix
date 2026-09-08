import type { StoryPracticeHistoryPort } from "./contracts";

export class StoryPracticeHistoryReader<TBlock, THistory> {
  constructor(private readonly port: StoryPracticeHistoryPort<TBlock, THistory>) {}

  current(ownerId: string): Promise<TBlock | null> {
    return this.port.current(ownerId);
  }

  block(ownerId: string, blockId: string): Promise<TBlock> {
    return this.port.historyBlock(ownerId, blockId);
  }

  list(ownerId: string): Promise<THistory> {
    return this.port.list(ownerId);
  }
}
