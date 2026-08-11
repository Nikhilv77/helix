import {
  ClipboardCheck,
  FileUp,
  GraduationCap,
  Mic,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Exchange } from "../blueprint-art";

export const exchanges: Exchange[] = [
  {
    action: "probe",
    question: "Tell me about the payments service you owned.",
    answer: "We rebuilt it to be more reliable and it went really well for the team.",
    reply: "You said “we rebuilt it” — what did you personally design?",
    elapsed: "02:14",
    note: "Follow-up 1 of 2"
  },
  {
    action: "challenge",
    question: "How did you stop duplicate charges?",
    answer: "We added idempotency keys, so double charges became impossible.",
    reply: "Where did those keys live, and what happened when that store went down?",
    elapsed: "05:41",
    note: "Needs detail"
  },
  {
    action: "interrupt",
    question: "Walk me through the migration.",
    answer:
      "So originally the team had this legacy setup, and there was a lot of history there, and I think around that time we were also…",
    reply: "Let me stop you there — what was the outcome?",
    elapsed: "08:03",
    note: "Needs a point"
  },
  {
    action: "move_on",
    question: "What broke in production?",
    answer: "A retry storm took the queue down. I added jitter and capped depth — p99 fell 40%.",
    reply: "Good. Next — tell me about a design decision you argued against.",
    elapsed: "11:27",
    note: "Good answer"
  }
];

export const FLOW_ACCENT = "#5b9dff";

export const flowSteps: Array<{ label: string; detail: string; icon: LucideIcon }> = [
  {
    label: "Upload",
    detail: "Your real resume, read in memory and never stored.",
    icon: FileUp
  },
  {
    label: "Learn",
    detail: "Maya briefs each stage before you touch a question.",
    icon: GraduationCap
  },
  {
    label: "Interview",
    detail: "A live voice round on what you just learned.",
    icon: Mic
  },
  {
    label: "Report",
    detail: "Clear notes, and one thing to fix next.",
    icon: ClipboardCheck
  }
];
