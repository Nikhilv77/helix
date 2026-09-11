export type AppliedEngineeringTechnology = "javascript";
export type AppliedEngineeringTechnologyOption = {
  value: AppliedEngineeringTechnology;
  label: string;
  detail: string;
  resumeMatched: boolean;
};

/** Only offer stacks backed by reviewed, executable Applied Engineering incidents. */
export function appliedEngineeringTechnologyOptions(
  resumeSkills: readonly string[]
): AppliedEngineeringTechnologyOption[] {
  return [
    {
      value: "javascript",
      label: "JavaScript",
      detail: "Node.js production incidents, diagnosis, repair, and safe delivery",
      resumeMatched: resumeSkills.some((skill) =>
        /\b(?:javascript|node(?:\.js|js)?)\b/i.test(skill)
      )
    }
  ];
}
