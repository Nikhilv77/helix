import { ConciergeNotifier, formatConciergeMessage, type ConciergeRequest } from "./concierge-notifier";

const request: ConciergeRequest = {
  requestId: "req-42",
  questionTitle: "LRU Cache",
  questionSlug: "lru-cache",
  language: "java",
  difficulty: "medium",
  timeSpentMs: 18 * 60 * 1000,
  hintsUsed: 3,
  summary: {
    headline: "Reads are not affecting their eviction order.",
    understands: ["Hash map gives O(1) lookup", "Handles a miss correctly"],
    blockedOn: "The test where a recently-read key should survive eviction is the one failing.",
    estimatedMinutes: 6,
    opener: "Ask what happens to ordering when a key is read."
  }
};

describe("concierge message", () => {
  it("leads with what a helper decides on", () => {
    const message = formatConciergeMessage(request);

    expect(message).toContain("LRU Cache");
    expect(message).toContain("medium, java");
    expect(message).toContain(request.summary.headline);
    expect(message).toContain(request.summary.blockedOn);
    expect(message).toContain("~6 min to help");
    expect(message).toContain("18 min on the problem");
    expect(message).toContain("3 AI hints taken");
    expect(message).toContain("/dsa-questions/lru-cache");
  });

  it("says so rather than rendering an empty bullet when nothing was credited", () => {
    const message = formatConciergeMessage({
      ...request,
      summary: { ...request.summary, understands: [] }
    });

    expect(message).toContain("(nothing recorded)");
  });
});

describe("concierge notifier", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("posts text and content so one payload suits Slack and Discord", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await new ConciergeNotifier("https://hooks.example.com/abc").notify(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/abc");

    const body = JSON.parse(String(init.body));
    expect(body.text).toContain("LRU Cache");
    // Slack reads `text`, Discord reads `content`; each ignores the other.
    expect(body.content).toBe(body.text);
  });

  it("does not call out at all when no webhook is configured", async () => {
    await new ConciergeNotifier(undefined).notify(request);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows a webhook failure — the request is already stored", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await expect(
      new ConciergeNotifier("https://hooks.example.com/abc").notify(request)
    ).resolves.toBeUndefined();
  });

  it("swallows a network error too", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(
      new ConciergeNotifier("https://hooks.example.com/abc").notify(request)
    ).resolves.toBeUndefined();
  });
});
