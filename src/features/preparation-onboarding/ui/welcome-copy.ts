import type { CandidateProfile } from "@/lib/shared/types";

export function preparationWelcomeIntroCopy(
  profile: Pick<CandidateProfile, "headline" | "resume">,
  teacherName: string
) {
  const resume = profile.resume;
  const firstName = resume?.fullName.trim().split(/\s+/)[0] || "there";
  const topEvidence = resume?.experience[0]
    ? `${resume.experience[0].role || "your work"} at ${resume.experience[0].organization}`
    : resume?.projects[0]?.name || profile.headline || "your resume evidence";
  const title = `Hi ${firstName}, I’m ${teacherName}.`;
  const body = `I’ve looked through your background, including ${topEvidence} and ${resume?.skills.length ?? 0} supported skills. Now let’s make sure I’m preparing you for the right job.`;

  return { title, body, voiceText: `${title} ${body}` };
}
