export type DsaLanguage = "python" | "javascript" | "cpp" | "java";

export type DsaRunResult = {
  status: string;
  accepted: boolean;
  stdout: string;
  stderr: string;
  compileOutput: string;
  time: string | null;
  memory: number | null;
  tests: Array<{
    index: number;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    error: string | null;
  }>;
};

export type VoiceStatus = "connecting" | "waiting" | "live" | "reconnecting" | "ended" | "error";

export type AgentState = "initializing" | "idle" | "listening" | "thinking" | "speaking";
