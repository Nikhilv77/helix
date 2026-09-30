/**
 * Resumes often give the name in capitals ("PRIYA MENON"). Show an all-caps
 * name in title case; any name with lowercase letters is left as written.
 */
export function displayName(value?: string | null): string {
  const name = value?.trim() ?? "";
  if (!name || name !== name.toUpperCase() || !/[A-Z]/.test(name)) return name;
  return name
    .toLowerCase()
    .replace(
      /(^|[\s'-])(\p{L})/gu,
      (_, gap: string, letter: string) => `${gap}${letter.toUpperCase()}`
    );
}
