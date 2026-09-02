import { EmailChannel } from "./email-channel";

describe("email channel", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sends a stable idempotency key to Resend", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = send as unknown as typeof fetch;
    const channel = new EmailChannel(
      "re_test",
      "Trailgrad <hello@trailgrad.com>",
      async () => "helper@example.com"
    );

    await expect(
      channel.send("helper-1", {
        subject: "Your practice path is ready",
        text: "Start your first Trailgrad practice question.",
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

  it("uses the teacher as the visible sender and embeds the Trailgrad logo", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = send as unknown as typeof fetch;
    const channel = new EmailChannel(
      "re_test",
      "Trailgrad Test <onboarding@resend.dev>",
      async () => "candidate@example.com"
    );

    await channel.send("candidate-1", {
      subject: "Your practice path is ready",
      text: "Your practice path is ready.",
      html: '<html><img src="cid:trailgrad-logo"></html>',
      fromName: "Ethan from Trailgrad"
    });

    const request = send.mock.calls[0]![1] as { body: string };
    const body = JSON.parse(request.body) as {
      from: string;
      html: string;
      attachments: Array<{
        content: string;
        filename: string;
        content_id: string;
        content_type: string;
      }>;
    };
    expect(body.from).toBe("Ethan from Trailgrad <onboarding@resend.dev>");
    expect(body.html).toContain("cid:trailgrad-logo");
    expect(body.attachments).toEqual([
      expect.objectContaining({
        filename: "trailgrad-logo.png",
        content_id: "trailgrad-logo",
        content_type: "image/png"
      })
    ]);
    const attachment = body.attachments[0];
    expect(attachment).toBeDefined();
    expect(attachment!.content.length).toBeGreaterThan(1_000);
  });

  it("keeps email disabled when no API key is configured", async () => {
    const send = vi.fn();
    global.fetch = send as unknown as typeof fetch;
    const channel = new EmailChannel(undefined, undefined, async () => "helper@example.com");

    await expect(channel.send("helper-1", { subject: "Hi", text: "Body" })).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
