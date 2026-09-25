export const SUMMARY_DATA_CHANGED_EVENT = "trailgrad:summary-data-changed";
export const SUMMARY_DATA_CHANGED_STORAGE_KEY = "trailgrad:summary-data-version";

/** Notify the current tab and other tabs after a successful workspace write. */
export function markSummaryDataChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SUMMARY_DATA_CHANGED_EVENT));
  try {
    window.localStorage.setItem(
      SUMMARY_DATA_CHANGED_STORAGE_KEY,
      `${Date.now()}:${Math.random()}`
    );
  } catch {
    // The current tab still receives the event when storage is unavailable.
  }
}

/** For feature-owned API writes that do not use the shared API client. */
export async function workspaceMutationFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);
  if (response.ok && init?.method && init.method.toUpperCase() !== "GET") {
    markSummaryDataChanged();
  }
  return response;
}
