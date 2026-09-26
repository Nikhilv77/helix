/**
 * Text-to-speech model and style shared by live speech and the pre-generated
 * greetings. Changing either means regenerating greetings (`pnpm voice:lines`).
 */
export const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
export const GEMINI_TTS_STYLE_VERSION = "teacher-natural-v1";
