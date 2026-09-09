import { DocumentTitle } from "@/components/document-title";
import type { CandidateProfile } from "@/lib/shared/types";
import { PreparationWelcome } from "./preparation-welcome";
import { PreparationWelcomeLoading } from "./preparation-welcome-loading";

interface PreparationWelcomeScreenProps {
  profile: CandidateProfile;
  blocking: boolean;
}

export function PreparationWelcomeScreen({ profile, blocking }: PreparationWelcomeScreenProps) {
  return (
    <>
      <DocumentTitle title="Home" />
      <PreparationWelcome profile={profile} blocking={blocking} />
      <PreparationWelcomeLoading />
    </>
  );
}
