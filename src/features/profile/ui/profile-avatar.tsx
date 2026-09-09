import Image from "next/image";

export const PROFILE_FALLBACK_IMAGE = "/images/profile/fallback/profile-fallback.png";

/** Shared profile image used whenever a candidate has not selected one yet. */
export function ProfileAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Image
      src={PROFILE_FALLBACK_IMAGE}
      alt={name ? `${name} avatar` : "Account avatar"}
      width={128}
      height={128}
      sizes="128px"
      quality={72}
      className={className}
    />
  );
}
