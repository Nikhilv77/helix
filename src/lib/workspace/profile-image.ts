"use client";

import { useEffect, useState } from "react";

export const WORKSPACE_PROFILE_IMAGE_CHANGE_EVENT = "trailgrad:workspace-profile-image";

/** Update persistent workspace chrome immediately after a profile image save. */
export function publishWorkspaceProfileImage(profileImage: string | null): void {
  window.dispatchEvent(
    new CustomEvent<string | null>(WORKSPACE_PROFILE_IMAGE_CHANGE_EVENT, {
      detail: profileImage
    })
  );
}

export function useWorkspaceProfileImage(initialProfileImage: string | null): string | null {
  const [profileImage, setProfileImage] = useState(initialProfileImage);

  useEffect(() => {
    setProfileImage(initialProfileImage);
  }, [initialProfileImage]);

  useEffect(() => {
    const updateProfileImage = (event: Event) => {
      const next = (event as CustomEvent<unknown>).detail;
      if (next === null || typeof next === "string") setProfileImage(next);
    };

    window.addEventListener(WORKSPACE_PROFILE_IMAGE_CHANGE_EVENT, updateProfileImage);
    return () =>
      window.removeEventListener(WORKSPACE_PROFILE_IMAGE_CHANGE_EVENT, updateProfileImage);
  }, []);

  return profileImage;
}
