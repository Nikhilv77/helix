import { EmailChannel } from "./email-channel";

describe("email channel", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("sends a stable idempotency key to Resend", async () => {
    const send = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = send as unknown as typeof fetch;
    const channel = new EmailChannel(
      "re_test",
      "Trailgrad <hello@trailgrad.com>",
      async () => "helper@example.com"
    );

    await expect(
      channel.send("helper-1", {
        subject: "Someone needs help",
        text: "Open Trailgrad",
        idempotencyKey: "notification/123"
      })
    ).resolves.toBe(true);

    expect(send).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({ "idempotency-key": "notification/123" })
      })
    );
  });

  it("keeps email disabled when no API key is configured", async () => {
    const send = jest.fn();
    global.fetch = send as unknown as typeof fetch;
    const channel = new EmailChannel(undefined, undefined, async () => "helper@example.com");

    await expect(channel.send("helper-1", { subject: "Hi", text: "Body" })).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
