export const PEER_HELP_ENDED_EVENT = "trailgrad:peer-help-ended";
export const PEER_HELP_PROMPT_VISIBILITY_EVENT = "trailgrad:peer-help-prompt-visibility";
export const SHOW_CURRENT_PEER_HELP_EVENT = "trailgrad:show-current-peer-help";

let centeredPromptCount = 0;

export function isPeerHelpPromptVisible(): boolean {
  return centeredPromptCount > 0;
}

/** Keep the small room nudge behind whichever centered peer-help prompt owns focus. */
export function holdPeerHelpPrompt(): () => void {
  centeredPromptCount += 1;
  announcePromptVisibility();
  let released = false;

  return () => {
    if (released) return;
    released = true;
    centeredPromptCount = Math.max(0, centeredPromptCount - 1);
    announcePromptVisibility();
  };
}

export function showCurrentPeerHelp(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SHOW_CURRENT_PEER_HELP_EVENT));
}

export function announcePeerHelpEnded(requestId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PEER_HELP_ENDED_EVENT, { detail: { requestId } }));
}

function announcePromptVisibility(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PEER_HELP_PROMPT_VISIBILITY_EVENT, {
      detail: { visible: isPeerHelpPromptVisible() }
    })
  );
}
