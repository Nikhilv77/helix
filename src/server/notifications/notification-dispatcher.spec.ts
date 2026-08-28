import { NotificationDispatcher } from "./notification-dispatcher";
import {
  NotificationKind,
  type DeliverInput,
  type EmailDeliveryRecord,
  type NotificationService
} from "./notification.service";
import type { EmailChannel } from "./email-channel";

const onboarding = {
  ownerId: "candidate-1",
  kind: NotificationKind.TEACHER_WELCOME,
  title: "Your first practice path is ready",
  body: "Start with one focused question.",
  href: "/practice",
  subjectId: "onboarding-v1"
};

const IN_APP_ONLY_KINDS: NotificationKind[] = [
  NotificationKind.TEACHER_RECOMMENDATION,
  NotificationKind.TEACHER_ENCOURAGEMENT,
  NotificationKind.TEACHER_REMINDER,
  NotificationKind.HELP_REQUEST_OPENED,
  NotificationKind.HELP_REQUEST_CLAIMED,
  NotificationKind.HELP_REQUEST_RESOLVED,
  NotificationKind.HELP_REQUEST_EXPIRED,
  NotificationKind.HELP_FEEDBACK_RECEIVED
];

function harness(
  options: {
    recorded?: boolean;
    emailed?: boolean;
    allowed?: boolean;
    pendingKind?: NotificationKind;
  } = {}
) {
  let notification: EmailDeliveryRecord = {
    id: "n-1",
    ownerId: onboarding.ownerId,
    kind: options.pendingKind ?? onboarding.kind,
    title: onboarding.title,
    body: onboarding.body,
    href: onboarding.href,
    subjectId: onboarding.subjectId,
    emailSubject: null as string | null,
    emailBody: null as string | null,
    emailHtml: null as string | null,
    emailFromName: null as string | null,
    emailAttempts: 1,
    emailSentAt: null
  };
  const recordForDispatch = jest.fn().mockImplementation(async (input: DeliverInput) => {
    if (options.recorded === false) return null;
    notification = {
      ...notification,
      ownerId: input.ownerId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      subjectId: input.subjectId ?? null,
      emailSubject: input.email?.subject ?? null,
      emailBody: input.email?.body ?? null,
      emailHtml: input.email?.html ?? null,
      emailFromName: input.email?.fromName ?? null
    };
    return { notification, created: true };
  });
  const claimEmailDelivery = jest
    .fn()
    .mockImplementation(async () => ({ token: "lease-1", notification }));
  const completeEmailDelivery = jest.fn().mockResolvedValue(true);
  const cancelEmailDelivery = jest.fn().mockResolvedValue(true);
  const recipientAllowsKind = jest.fn().mockResolvedValue(options.allowed ?? true);
  const dueEmailDeliveryIds = jest.fn().mockResolvedValue([notification.id]);
  const send = jest.fn().mockResolvedValue(options.emailed ?? true);

  const dispatcher = new NotificationDispatcher(
    {
      recordForDispatch,
      claimEmailDelivery,
      completeEmailDelivery,
      cancelEmailDelivery,
      recipientAllowsKind,
      dueEmailDeliveryIds
    } as unknown as NotificationService,
    { configured: true, send } as unknown as EmailChannel,
    "https://app.trailgrad.com"
  );

  return {
    dispatcher,
    recordForDispatch,
    claimEmailDelivery,
    completeEmailDelivery,
    cancelEmailDelivery,
    recipientAllowsKind,
    dueEmailDeliveryIds,
    send
  };
}

describe("dispatch", () => {
  it("writes the inbox row before it emails", async () => {
    const { dispatcher, recordForDispatch, send } = harness();
    const result = await dispatcher.dispatch(onboarding);

    expect(recordForDispatch).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ recorded: true, emailed: true });
  });

  it("does not email when the notification was suppressed", async () => {
    // Suppressed means muted or duplicate. Emailing anyway defeats both, and a
    // duplicate email is worse than a duplicate row because it cannot be undone.
    const { dispatcher, send } = harness({ recorded: false });

    await expect(dispatcher.dispatch(onboarding)).resolves.toEqual({
      recorded: false,
      emailed: false
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps the record when email fails", async () => {
    const { dispatcher, completeEmailDelivery } = harness({ emailed: false });

    // The durable record must not depend on a third party being up.
    await expect(dispatcher.dispatch(onboarding)).resolves.toEqual({
      recorded: true,
      emailed: false
    });
    expect(completeEmailDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ token: "lease-1" }),
      false
    );
  });

  it.each(IN_APP_ONLY_KINDS)("keeps %s in-app only", async (kind) => {
    const { dispatcher, recordForDispatch, claimEmailDelivery, send } = harness();

    await dispatcher.dispatch({ ...onboarding, kind, subjectId: `${kind}-1` });

    expect(recordForDispatch).toHaveBeenCalledWith(expect.objectContaining({ kind }), false);
    expect(send).not.toHaveBeenCalled();
    expect(claimEmailDelivery).not.toHaveBeenCalled();
  });

  it("retries due rows through the same leased delivery path", async () => {
    const { dispatcher, dueEmailDeliveryIds, send } = harness();

    await expect(dispatcher.retryPending()).resolves.toEqual({ attempted: 1, emailed: 1 });
    expect(dueEmailDeliveryIds).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("cancels a peer-help email queued before email became onboarding-only", async () => {
    const { dispatcher, send, cancelEmailDelivery } = harness({
      pendingKind: NotificationKind.HELP_REQUEST_OPENED
    });

    await expect(dispatcher.retryPending()).resolves.toEqual({ attempted: 1, emailed: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(cancelEmailDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ token: "lease-1" }),
      "Email disabled for notification kind"
    );
  });

  it("reuses persisted HTML and sender identity during delivery", async () => {
    const { dispatcher, send } = harness();

    await dispatcher.dispatch({
      ...onboarding,
      email: {
        subject: "Ethan from Trailgrad — your path is ready",
        body: "Your path is ready.",
        html: "<html>Welcome</html>",
        fromName: "Ethan from Trailgrad"
      }
    });

    expect(send).toHaveBeenCalledWith(
      "candidate-1",
      expect.objectContaining({
        subject: "Ethan from Trailgrad — your path is ready",
        html: "<html>Welcome</html>",
        fromName: "Ethan from Trailgrad"
      })
    );
  });

  it("cancels an email lease when the recipient cannot receive its kind", async () => {
    const { dispatcher, send, cancelEmailDelivery } = harness({ allowed: false });

    await expect(dispatcher.dispatch(onboarding)).resolves.toEqual({
      recorded: true,
      emailed: false
    });
    expect(send).not.toHaveBeenCalled();
    expect(cancelEmailDelivery).toHaveBeenCalledTimes(1);
  });
});

describe("email body", () => {
  it("absolutises the onboarding link without coaching settings copy", async () => {
    const { dispatcher, send } = harness();
    await dispatcher.dispatch(onboarding);

    const [, message] = send.mock.calls[0] as [string, { subject: string; text: string }];
    expect(message.subject).toBe(onboarding.title);
    expect(message.text).toContain("https://app.trailgrad.com/practice");
    expect(message.text).not.toContain("Notification settings:");
  });

  it("skips links entirely when no origin is configured", async () => {
    const notification = {
      id: "n-1",
      ownerId: onboarding.ownerId,
      kind: onboarding.kind,
      title: onboarding.title,
      body: onboarding.body,
      href: onboarding.href,
      subjectId: onboarding.subjectId,
      emailSubject: null,
      emailBody: null,
      emailHtml: null,
      emailFromName: null,
      emailAttempts: 1,
      emailSentAt: null
    };
    const recordForDispatch = jest.fn().mockResolvedValue({ notification, created: true });
    const claimEmailDelivery = jest.fn().mockResolvedValue({ token: "lease-1", notification });
    const send = jest.fn().mockResolvedValue(true);
    const dispatcher = new NotificationDispatcher(
      {
        recordForDispatch,
        claimEmailDelivery,
        completeEmailDelivery: jest.fn().mockResolvedValue(true),
        recipientAllowsKind: jest.fn().mockResolvedValue(true)
      } as unknown as NotificationService,
      { configured: true, send } as unknown as EmailChannel,
      undefined
    );

    await dispatcher.dispatch(onboarding);
    const [, message] = send.mock.calls[0] as [string, { text: string }];

    // A relative path in an email goes nowhere; better to send none.
    expect(message.text).not.toContain("/practice");
    expect(message.text).toBe(onboarding.body);
  });
});
