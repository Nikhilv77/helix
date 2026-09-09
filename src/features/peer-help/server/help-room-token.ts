import { AccessToken, RoomConfiguration, TrackSource } from "livekit-server-sdk";

import type { Seat } from "./help-session.service";

export const HELP_ROOM_MAX_PARTICIPANTS = 2;
export const HELP_ROOM_EMPTY_TIMEOUT_SECONDS = 60;
export const HELP_ROOM_DEPARTURE_TIMEOUT_SECONDS = 30;

export interface HelpRoomTokenInput {
  apiKey: string;
  apiSecret: string;
  requestId: string;
  roomName: string;
  seat: Seat;
  remainingMs: number;
}

/**
 * Mint the narrowest token a two-person audio help room needs.
 *
 * RoomConfiguration is carried by both tokens, but only the first connection
 * uses it while auto-creating the room. No agent dispatch is present.
 */
export async function createHelpRoomToken(input: HelpRoomTokenInput): Promise<string> {
  const token = new AccessToken(input.apiKey, input.apiSecret, {
    // One identity per seat: a second tab replaces the first instead of
    // becoming a third person in a nominally one-to-one conversation.
    identity: `${input.seat}-${input.requestId}`,
    ttl: Math.max(1, Math.ceil(input.remainingMs / 1_000)),
    attributes: {
      helpRequestId: input.requestId,
      helpSeat: input.seat
    }
  });

  token.roomConfig = new RoomConfiguration({
    name: input.roomName,
    emptyTimeout: HELP_ROOM_EMPTY_TIMEOUT_SECONDS,
    departureTimeout: HELP_ROOM_DEPARTURE_TIMEOUT_SECONDS,
    maxParticipants: HELP_ROOM_MAX_PARTICIPANTS,
    // Explicitly empty: this room is human-to-human and must never dispatch Maya.
    agents: []
  });

  token.addGrant({
    room: input.roomName,
    roomJoin: true,
    canPublish: true,
    canPublishSources: [TrackSource.MICROPHONE],
    canSubscribe: true,
    // Both seats publish collaboration data. Code snapshots are still accepted
    // only from the learner identity and the helper editor remains read-only.
    canPublishData: true,
    canUpdateOwnMetadata: false
  });

  return token.toJwt();
}
