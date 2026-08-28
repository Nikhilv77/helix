const avatarEntries = [
  ["/images/profile/avatars/avatar-01.jpg", "7bc1f6d0"],
  ["/images/profile/avatars/avatar-02.jpg", "8f147db2"],
  ["/images/profile/avatars/avatar-03.jpg", "54f51d79"],
  ["/images/profile/avatars/avatar-04.jpg", "62bce4f4"],
  ["/images/profile/avatars/avatar-05.jpg", "bf8776bd"],
  ["/images/profile/avatars/avatar-06.jpg", "3f796daa"],
  ["/images/profile/avatars/avatar-07.jpg", "508f88d1"],
  ["/images/profile/avatars/avatar-08.jpg", "14c75c1d"],
  ["/images/profile/avatars/avatar-09.jpg", "8b0bc5aa"],
  ["/images/profile/avatars/avatar-10.jpg", "433fd7e1"],
  ["/images/profile/avatars/avatar-11.jpg", "44abf066"],
  ["/images/profile/avatars/avatar-12.jpg", "14772eb8"],
  ["/images/profile/avatars/avatar-13.jpg", "58dd05e2"]
] as const;

export type ProfileAvatarSource = (typeof avatarEntries)[number][0];

export const profileAvatars = avatarEntries.map(([src, version]) => ({
  src,
  displaySrc: `${src}?v=${version}`,
  width: 1024,
  height: 1024
}));

const profileAvatarSources = new Set<string>(profileAvatars.map(({ src }) => src));

/** Keep profile persistence restricted to assets that the avatar picker actually exposes. */
export function isProfileAvatarSource(value: string): value is ProfileAvatarSource {
  return profileAvatarSources.has(value);
}
