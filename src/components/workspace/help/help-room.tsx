"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical, Loader2, UsersRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import type {
  DsaEditorLanguage,
  DsaEditorSelection
} from "@/components/interview/dsa/dsa-code-editor";
import { readDsaCodeDraft, writeDsaCodeDraft } from "@/lib/dsa/code-draft";
import type { HelpSnapshot, WorkspaceState } from "@/lib/help/snapshot";
import type { HelpHistoryParticipant } from "@/lib/help/help-history";
import { HelpCall, type HelpDataChannel } from "./help-call";
import { HelpCodePanel } from "./help-code-panel";
import { HelpRating } from "./help-rating";
import { HELP_ROOM_PANEL_RULE } from "./help-room-surface";
import { HelpTestResults } from "./help-test-results";
import { SafetyControls } from "./safety-controls";
import { SharedHelpBoard, type CollaborationMessage } from "./shared-help-board";
import { ProfileAvatar } from "../profile/profile-avatar";

interface HelpRoomData {
  requestId: string;
  seat: "learner" | "helper";
  peer: HelpHistoryParticipant | null;
  slug: string;
  title: string;
  questionPrompt: string | null;
  language: DsaEditorLanguage;
  capturedWorkspace: WorkspaceState;
  collaborationState: string | null;
}

interface RunResult {
  accepted: boolean;
  status: string;
  compileOutput?: string;
  stderr?: string;
  stdout?: string;
  tests: Array<{
    index: number;
    input: string;
    expectedOutput: string;
    actualOutput?: string;
    passed: boolean;
    error?: string | null;
  }>;
}

const DEFAULT_BOARD_WIDTH = 320;
const MIN_BOARD_WIDTH = 256;
const MIN_EDITOR_WIDTH = 416;
const RESULTS_WIDTH = 264;
const DIVIDER_SPACE = 24;

export function HelpRoom({ requestId, returnTo }: { requestId: string; returnTo: string }) {
  const router = useRouter();
  const [room, setRoom] = useState<HelpRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<HelpDataChannel | null>(null);
  const [message, setMessage] = useState<CollaborationMessage | null>(null);
  const [helperSnapshot, setHelperSnapshot] = useState<HelpSnapshot | null>(null);
  const [code, setCode] = useState("");
  const [selection, setSelection] = useState<DsaEditorSelection | null>(null);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [failingTests, setFailingTests] = useState<number | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [ended, setEnded] = useState(false);
  const [boardWidth, setBoardWidth] = useState(DEFAULT_BOARD_WIDTH);
  const roomGrid = useRef<HTMLDivElement>(null);
  const snapshot = useRef<WorkspaceState>({
    code: "",
    language: "javascript",
    testOutput: null,
    failingTests: null,
    selection: null
  });

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/help/room/${encodeURIComponent(requestId)}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !payload.data) {
          throw new Error(payload?.error?.message ?? "Could not open this Trailmate room.");
        }
        return payload.data as HelpRoomData;
      })
      .then((data) => {
        if (cancelled) return;
        setRoom(data);
        const saved =
          data.seat === "learner"
            ? readDsaCodeDraft(window.localStorage, data.slug, data.language)
            : null;
        const initialCode = saved ?? data.capturedWorkspace.code;
        setCode(initialCode);
        setSelection(data.capturedWorkspace.selection);
        setTestOutput(data.capturedWorkspace.testOutput);
        setFailingTests(data.capturedWorkspace.failingTests);
        if (data.capturedWorkspace.tests?.length) {
          setRunResult({
            accepted: data.capturedWorkspace.failingTests === 0,
            status:
              data.capturedWorkspace.runStatus ??
              `${data.capturedWorkspace.tests.filter((test) => test.passed).length}/${data.capturedWorkspace.tests.length} tests passed`,
            tests: data.capturedWorkspace.tests
          });
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not open this Trailmate room."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    if (!room || room.seat !== "learner") return;
    const timer = window.setTimeout(() => {
      writeDsaCodeDraft(window.localStorage, room.slug, room.language, code);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [code, room]);

  snapshot.current = {
    code,
    language: room?.language ?? "javascript",
    testOutput,
    failingTests,
    selection,
    runStatus: runResult?.status ?? null,
    tests:
      runResult?.tests.map((test) => ({
        index: test.index,
        input: test.input,
        expectedOutput: test.expectedOutput,
        actualOutput: test.actualOutput ?? "",
        passed: test.passed,
        error: test.error ?? null
      })) ?? null
  };

  const runCode = useCallback(async () => {
    if (!room || room.seat !== "learner" || running || !code.trim()) return;
    setRunning(true);
    setRunError(null);
    try {
      const response = await fetch("/api/code/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          code,
          language: room.language,
          slug: room.slug
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error?.message ?? "Code execution failed.");
      }
      const result = payload.data as RunResult;
      setRunResult(result);
      const failing = result.tests.filter((test) => !test.passed).length;
      setFailingTests(failing);
      setTestOutput(
        [result.compileOutput, result.stderr, result.stdout].filter(Boolean).join("\n").trim() ||
          `${result.status}: ${failing} of ${result.tests.length} failing`
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Code execution failed.";
      setRunResult(null);
      setFailingTests(null);
      setRunError(message);
      setTestOutput(message);
    } finally {
      setRunning(false);
    }
  }, [code, room, running]);

  const beginBoardResize = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const grid = roomGrid.current;
    if (!grid) return;

    event.preventDefault();
    const bounds = grid.getBoundingClientRect();
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const updateWidth = (pointerEvent: PointerEvent) => {
      const availableMaximum = Math.max(
        MIN_BOARD_WIDTH,
        bounds.width - MIN_EDITOR_WIDTH - RESULTS_WIDTH - DIVIDER_SPACE
      );
      const requested = pointerEvent.clientX - bounds.left;
      setBoardWidth(Math.min(availableMaximum, Math.max(MIN_BOARD_WIDTH, requested)));
    };
    const stopResize = () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", updateWidth);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };

    updateWidth(event.nativeEvent);
    window.addEventListener("pointermove", updateWidth);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  }, []);

  const clampBoardWidth = useCallback((requested: number) => {
    const bounds = roomGrid.current?.getBoundingClientRect();
    const availableMaximum = bounds
      ? Math.max(MIN_BOARD_WIDTH, bounds.width - MIN_EDITOR_WIDTH - RESULTS_WIDTH - DIVIDER_SPACE)
      : 900;
    return Math.min(availableMaximum, Math.max(MIN_BOARD_WIDTH, requested));
  }, []);

  useEffect(() => {
    const fitBoardToViewport = () => setBoardWidth((current) => clampBoardWidth(current));
    window.addEventListener("resize", fitBoardToViewport);
    return () => window.removeEventListener("resize", fitBoardToViewport);
  }, [clampBoardWidth]);

  if (loading) {
    return (
      <div className="grid min-h-[calc(100dvh-4.25rem)] place-items-center">
        <span className="inline-flex items-center gap-2 text-sm text-cream/45">
          <Loader2 size={15} className="animate-spin" /> Opening Trailmate room…
        </span>
      </div>
    );
  }

  if (!room || error) {
    return (
      <div className="mx-auto grid min-h-[calc(100dvh-4.25rem)] max-w-lg place-items-center px-5 text-center">
        <div>
          <p className="text-lg font-semibold text-cream">Room unavailable</p>
          <p className="mt-2 text-sm leading-6 text-cream/45">{error}</p>
          <Link href="/help" className="mt-5 inline-block text-sm text-[var(--workspace-accent)]">
            Back to Trailmate
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="relative mx-auto w-full max-w-[104rem] px-3 pb-8 pt-3 sm:px-5 md:pt-5">
      <header className="mb-3 flex min-h-16 flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-[rgba(25,26,29,0.58)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-4">
        {room.peer?.profileImage ? (
          <Image
            src={room.peer.profileImage}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl object-cover"
          />
        ) : (
          <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]">
            <ProfileAvatar
              name={room.peer?.label ?? "Peer"}
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
            <UsersRound size={17} className="relative" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
            Live Trailmate
          </p>
          <h1 className="truncate text-[15px] font-semibold text-cream">
            {room.title} with {room.peer?.label ?? "your peer"}
          </h1>
        </div>
        <span className="rounded-full bg-white/[0.045] px-2.5 py-1 text-[11px] text-cream/44 ring-1 ring-inset ring-white/[0.045]">
          {room.seat === "learner" ? "Candidate" : "Trailmate"}
        </span>
        <span className="flex-1" />
        <HelpCall
          requestId={requestId}
          peerName={room.peer?.label ?? "your peer"}
          autoJoin
          snapshot={room.seat === "learner" ? () => snapshot.current : undefined}
          onSnapshot={room.seat === "helper" ? setHelperSnapshot : undefined}
          onDataChannel={(next) => setChannel(next)}
          onDataMessage={(payload, topic) =>
            setMessage((current) => ({ payload, topic, nonce: (current?.nonce ?? 0) + 1 }))
          }
          onEnded={({ canRate }) => {
            if (room.seat === "learner" && canRate) setEnded(true);
            else router.replace(returnTo);
          }}
        />
      </header>

      <div
        ref={roomGrid}
        style={{ "--help-board-width": `${boardWidth}px` } as CSSProperties}
        className="grid gap-3 xl:h-[calc(100dvh-13rem)] xl:min-h-[40rem] xl:max-h-[54rem] xl:grid-cols-[var(--help-board-width)_0.75rem_minmax(26rem,1fr)_0.75rem_16.5rem] xl:gap-0"
      >
        <SharedHelpBoard
          requestId={requestId}
          channel={channel}
          message={message}
          initialState={room.collaborationState}
        />

        <button
          type="button"
          onPointerDown={beginBoardResize}
          onDoubleClick={() => setBoardWidth(clampBoardWidth(DEFAULT_BOARD_WIDTH))}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home") {
              return;
            }
            event.preventDefault();
            setBoardWidth((current) => {
              return clampBoardWidth(
                event.key === "Home"
                  ? DEFAULT_BOARD_WIDTH
                  : current + (event.key === "ArrowLeft" ? -24 : 24)
              );
            });
          }}
          className="group relative hidden cursor-col-resize touch-none items-center justify-center overflow-hidden text-cream/20 outline-none transition-colors hover:text-cream/55 focus-visible:text-cream/70 xl:flex"
          aria-label="Resize shared board and code editor"
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={MIN_BOARD_WIDTH}
          aria-valuemax={900}
          aria-valuenow={Math.round(boardWidth)}
          title="Drag to resize · Double-click to reset"
        >
          <span className="absolute inset-y-6 left-1/2 w-px -translate-x-1/2 bg-white/[0.045] transition group-hover:bg-white/[0.11]" />
          <span className="relative flex h-10 w-5 items-center justify-center">
            <GripVertical size={13} aria-hidden="true" />
          </span>
        </button>

        <HelpCodePanel
          seat={room.seat}
          language={room.language}
          code={code}
          onCodeChange={setCode}
          onSelectionChange={setSelection}
          onRun={() => void runCode()}
          running={running}
          snapshot={helperSnapshot}
          captured={room.capturedWorkspace}
        />

        <span className="hidden xl:block" aria-hidden="true" />

        <HelpTestResults
          workspace={
            room.seat === "helper" ? (helperSnapshot ?? room.capturedWorkspace) : snapshot.current
          }
          running={room.seat === "learner" && running}
          error={room.seat === "learner" ? runError : null}
        />
      </div>

      <div className={`mt-3 flex justify-end border-t ${HELP_ROOM_PANEL_RULE} pt-3`}>
        <SafetyControls requestId={requestId} onActioned={() => router.push("/help")} />
      </div>

      {ended && room.seat === "learner" ? (
        <HelpRating requestId={requestId} onCompleted={() => router.replace(returnTo)} />
      ) : null}
    </main>
  );
}
