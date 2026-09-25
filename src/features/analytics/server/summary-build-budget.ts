/** Bound expensive per-user summary rebuilds within one app process. */
const MAX_CONCURRENT_BUILDS = 2;
let activeBuilds = 0;
const waiters: Array<() => void> = [];

export async function withSummaryBuildSlot<T>(work: () => Promise<T>): Promise<T> {
  if (activeBuilds < MAX_CONCURRENT_BUILDS) activeBuilds += 1;
  else await new Promise<void>((resolve) => waiters.push(resolve));

  try {
    return await work();
  } finally {
    const next = waiters.shift();
    if (next) next();
    else activeBuilds -= 1;
  }
}
