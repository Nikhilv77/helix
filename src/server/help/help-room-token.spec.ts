import { TokenVerifier } from "livekit-server-sdk";

import {
  HELP_ROOM_DEPARTURE_TIMEOUT_SECONDS,
  HELP_ROOM_EMPTY_TIMEOUT_SECONDS,
  HELP_ROOM_MAX_PARTICIPANTS,
  createHelpRoomToken
} from "./help-room-token";

const API_KEY = "test-key";
const API_SECRET = "a-test-secret-that-is-long-enough-for-hs256";

async function claims(seat: "learner" | "helper") {
  const jwt = await createHelpRoomToken({
    apiKey: API_KEY,
    apiSecret: API_SECRET,
    requestId: "request-1",
    roomName: "help-request-1",
    seat,
    remainingMs: 15 * 60_000
  });
  return new TokenVerifier(API_KEY, API_SECRET).verify(jwt);
}

describe("help room token", () => {
  it("is bound to one seat, one room, and microphone-only publication", async () => {
    const token = await claims("helper");

    expect(token.sub).toBe("helper-request-1");
    expect(token.video).toMatchObject({
      room: "help-request-1",
      roomJoin: true,
      canPublish: true,
      canPublishSources: ["microphone"],
      canSubscribe: true,
      canPublishData: false,
      canUpdateOwnMetadata: false
    });
  });

  it("lets only the learner publish workspace data", async () => {
    const learner = await claims("learner");
    const helper = await claims("helper");

    expect(learner.video?.canPublishData).toBe(true);
    expect(helper.video?.canPublishData).toBe(false);
  });

  it("auto-creates a two-person room with bounded empty time and no agents", async () => {
    const token = await claims("learner");

    expect(token.roomConfig).toMatchObject({
      name: "help-request-1",
      emptyTimeout: HELP_ROOM_EMPTY_TIMEOUT_SECONDS,
      departureTimeout: HELP_ROOM_DEPARTURE_TIMEOUT_SECONDS,
      maxParticipants: HELP_ROOM_MAX_PARTICIPANTS,
      agents: []
    });
  });
});
