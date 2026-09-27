import { staticVoiceUrl } from "@/lib/avatars/static-voice";
import { RESUME_ROAST_FIXED_VOICE_LINES, RESUME_ROAST_VOICE_PERSONA } from "./resume-roast-lines";

describe("Resume Roast voice lines", () => {
  // A wording change without `pnpm voice:lines` silently falls back to slow,
  // paid live speech; this keeps the pre-recorded set in step with the page.
  it.each(RESUME_ROAST_FIXED_VOICE_LINES)("has pre-recorded audio for %s", (line) => {
    expect(staticVoiceUrl(line, RESUME_ROAST_VOICE_PERSONA, "deepgram")).toMatch(
      /^\/voice\/james-[a-f0-9]{12}\.mp3$/
    );
  });
});
