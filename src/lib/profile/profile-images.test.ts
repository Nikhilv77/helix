import { describe, expect, it } from "vitest";

import { isProfileAvatarSource, profileAvatars } from "./profile-images";

describe("profile avatar catalog", () => {
  it("allows every image exposed by the profile picker", () => {
    expect(profileAvatars).toHaveLength(13);
    expect(profileAvatars.every(({ src }) => isProfileAvatarSource(src))).toBe(true);
  });

  it("includes the newly generated images without accepting arbitrary paths", () => {
    expect(isProfileAvatarSource("/images/profile/avatars/avatar-13.jpg")).toBe(true);
    expect(isProfileAvatarSource("/images/profile/avatars/not-in-picker.jpg")).toBe(false);
  });
});
