import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { publishWorkspaceProfileImage, useWorkspaceProfileImage } from "./profile-image";

describe("workspace profile image state", () => {
  it("updates persistent chrome when the profile editor publishes a saved image", () => {
    const { result } = renderHook(() => useWorkspaceProfileImage("/avatars/old.jpg"));

    act(() => publishWorkspaceProfileImage("/avatars/new.jpg"));

    expect(result.current).toBe("/avatars/new.jpg");
  });

  it("also follows a refreshed server value", () => {
    const { result, rerender } = renderHook(
      ({ image }: { image: string | null }) => useWorkspaceProfileImage(image),
      { initialProps: { image: "/avatars/old.jpg" } }
    );

    rerender({ image: "/avatars/server.jpg" });

    expect(result.current).toBe("/avatars/server.jpg");
  });
});
