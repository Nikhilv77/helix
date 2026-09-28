/**
 * The first name to greet someone by. Resumes often print names in capitals
 * ("PRIYA MENON") or all lower case; both are shown as "Priya", while a name
 * written in mixed case ("McKenzie") is kept exactly as written.
 */
export function displayFirstName(fullName: string | null | undefined): string {
  const name = fullName?.trim().split(/\s+/)[0] ?? "";
  const singleCase = name === name.toUpperCase() || name === name.toLowerCase();
  if (!name || !singleCase) return name;
  return name[0]!.toUpperCase() + name.slice(1).toLowerCase();
}
