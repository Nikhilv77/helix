import { describe, expect, it } from "vitest";

import { peerHelpRoomHref, safePeerHelpReturnTo } from "./help-room-navigation";

describe("peer-help room navigation", () => {
  it("preserves a safe workspace origin", () => {
    expect(peerHelpRoomHref("request-1", "/dsa-questions/two-sum?tab=code")).toBe(
      "/trailmate/room/request-1?from=%2Fdsa-questions%2Ftwo-sum%3Ftab%3Dcode"
    );
  });

  it.each(["https://evil.example", "//evil.example", "/trailmate/room/request-2", "\\evil"])(
    "falls back to Peer Help for unsafe origin %s",
    (origin) => {
      expect(safePeerHelpReturnTo(origin)).toBe("/trailmate");
    }
  );
});
