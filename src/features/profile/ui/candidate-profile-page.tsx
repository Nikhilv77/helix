"use client";

import { useEffect, useState } from "react";
import { ApiClientError, saveProfile } from "@/lib/api/api-client";
import type { CandidateProfile, CandidateProfileInput } from "@/lib/shared/types";
import { publishWorkspaceProfileImage } from "@/lib/workspace/profile-image";
import { ProfileHero } from "./candidate-profile-editor-profile";
import { SignatureStoryCard } from "./candidate-profile-editor-visuals";
import { toInput } from "./candidate-profile-editor-utils";
import { ProfileImagePicker } from "./profile-image-picker";
import { ResumeUpdateModal } from "./resume-update-modal";

export function CandidateProfilePage({ initialProfile }: { initialProfile: CandidateProfile }) {
  const [profile, setProfile] = useState<CandidateProfileInput>(toInput(initialProfile));
  const [saved, setSaved] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePicker, setImagePicker] = useState<"cover" | "avatar" | null>(null);
  const [resumeUpdateOpen, setResumeUpdateOpen] = useState(false);

  useEffect(() => {
    if (saved.profileImage || saving || imagePicker) return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("help") === "1" || query.has("request")) return;

    const timer = window.setTimeout(() => setImagePicker("avatar"), 520);
    return () => window.clearTimeout(timer);
  }, [imagePicker, saved.profileImage, saving]);

  async function saveImagePatch(patch: Partial<CandidateProfileInput>) {
    const nextInput = { ...profile, ...patch };
    setProfile(nextInput);
    setImagePicker(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSaving(true);
    setError(null);

    try {
      const next = await saveProfile(nextInput);
      setSaved(next);
      setProfile(toInput(next));
      if ("profileImage" in patch) publishWorkspaceProfileImage(next.profileImage);
    } catch (caught) {
      setProfile(toInput(saved));
      setError(
        caught instanceof ApiClientError ? caught.message : "Your profile image could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-theme mx-auto w-full max-w-[84rem] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
      <ProfileHero
        profile={profile}
        saved={saved}
        onCoverEdit={() => setImagePicker("cover")}
        onAvatarEdit={() => setImagePicker("avatar")}
        onResumeUpdate={() => setResumeUpdateOpen(true)}
      />

      <ProfileImagePicker
        open={imagePicker}
        profile={profile}
        error={error}
        requireAvatar={!saved.profileImage && imagePicker === "avatar"}
        onClose={() => {
          setImagePicker(null);
          setError(null);
        }}
        onCoverChange={(coverImage) => void saveImagePatch({ coverImage })}
        onAvatarChange={(profileImage) => void saveImagePatch({ profileImage })}
      />

      <ResumeUpdateModal
        open={resumeUpdateOpen}
        profile={saved}
        onClose={() => setResumeUpdateOpen(false)}
        onUpdated={(next) => {
          setSaved(next);
          setProfile(toInput(next));
          setResumeUpdateOpen(false);
        }}
      />

      <SignatureStoryCard story={profile.stories[0]} />
    </div>
  );
}
