"""Trailgrad voice agent.

Architecture note: this service has no LLM and no interview state. It converts
speech to text, hands the text to /api/interview/decide, and speaks whatever
comes back. Every decision — probe, challenge, move on, when to stop — belongs
to the Next.js app.

The interview session id travels in the room name (`interview-<uuid>`), which
the token endpoint mints.
"""

from __future__ import annotations

import asyncio
import fcntl
import hashlib
import json
import logging
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import IO

import aiohttp
from collections.abc import Awaitable, Callable
from livekit import agents
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    TurnHandlingOptions,
    UserInputTranscribedEvent,
    UserStateChangedEvent,
    inference,
    llm,
)
from livekit.plugins import deepgram, silero

from config import TRAILGRAD, SPEECH
from trailgrad import TrailgradApiError, TrailgradClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("trailgrad.agent")

ROOM_PREFIX = "interview-"
TYPED_ANSWER_TOPIC = "trailgrad.typed-answer"
SILENCE_NUDGE_DELAYS = (8.0, 18.0)
SILENCE_NUDGES = (
    "Take your time. You can start with the specific project or experience behind that.",
    "A simple way in is to walk me through what happened first, then what you personally did.",
)
_worker_lock: IO[str] | None = None


def acquire_worker_lock() -> Path:
    """Allow one worker for this LiveKit project and agent name per host."""
    global _worker_lock

    scope = f"{os.getenv('LIVEKIT_URL', '')}:{TRAILGRAD.agent_name}"
    digest = hashlib.sha256(scope.encode()).hexdigest()[:12]
    path = Path(tempfile.gettempdir()) / f"trailgrad-voice-worker-{digest}.lock"
    handle = path.open("w", encoding="utf-8")

    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        handle.close()
        raise SystemExit(
            f"Another Trailgrad voice worker is already running for "
            f"{TRAILGRAD.agent_name!r}. Stop it before starting another."
        ) from None

    handle.write(str(os.getpid()))
    handle.flush()
    _worker_lock = handle
    return path


def _log_config() -> None:
    """Print the resolved config at boot.

    A stale process silently running old settings has cost real debugging
    time — this makes what is actually live visible in the first line.
    """
    logger.info(
        "config agent=%s stt=%s/%s eot=%dms turn_delay=%.2f-%.1fs tts=%s api=%s",
        TRAILGRAD.agent_name,
        SPEECH.stt_model,
        SPEECH.stt_language,
        SPEECH.stt_eot_timeout_ms,
        SPEECH.turn_min_delay_s,
        SPEECH.turn_max_delay_s,
        SPEECH.tts_model,
        TRAILGRAD.api_base_url,
    )


server = AgentServer()


def build_stt():
    if SPEECH.stt_model.startswith("flux-"):
        options = {
            "model": SPEECH.stt_model,
            "eot_threshold": SPEECH.stt_eot_threshold,
            "eot_timeout_ms": SPEECH.stt_eot_timeout_ms,
        }
        if SPEECH.stt_eager_eot_threshold > 0:
            options["eager_eot_threshold"] = SPEECH.stt_eager_eot_threshold
        if SPEECH.stt_model.endswith("-multi"):
            options["language_hint"] = [SPEECH.stt_language]
        return deepgram.STTv2(**options)

    return deepgram.STT(
        model=SPEECH.stt_model,
        language=SPEECH.stt_language,
        interim_results=True,
        filler_words=SPEECH.stt_filler_words,
        endpointing_ms=SPEECH.endpointing_ms,
    )


def turn_detection():
    if SPEECH.stt_model.startswith("flux-"):
        return "stt"
    return inference.TurnDetector()


class Interviewer(Agent):
    """A mouth, not a mind. Instructions are intentionally empty."""

    def __init__(self, on_turn: Callable[[str], Awaitable[None]]) -> None:
        super().__init__(instructions="")
        self._on_turn = on_turn

    async def on_user_turn_completed(
        self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage
    ) -> None:
        """The framework's own end-of-turn signal.

        Dispatching off raw VAD state changes was cutting answers off after the
        first fragment: Deepgram finalises at every pause, so "Yeah. So" and "I"
        arrived as separate complete answers. This fires once after the active
        turn detector reports end-of-turn, with the whole utterance assembled.
        """
        text = (new_message.text_content or "").strip()
        logger.info("end of turn: %r", text[:90])
        if text:
            await self._on_turn(text)
        else:
            logger.warning("end of turn with empty transcript")


def session_id_from_room(room_name: str) -> str:
    if not room_name.startswith(ROOM_PREFIX):
        raise ValueError(f"room {room_name!r} is not an interview room")

    value = room_name[len(ROOM_PREFIX) :]
    session_id = value[:36]
    try:
        uuid.UUID(session_id)
    except ValueError as error:
        raise ValueError(f"room {room_name!r} has no interview session id") from error

    if len(value) > 36 and value[36] != "-":
        raise ValueError(f"room {room_name!r} has an invalid connection suffix")
    return session_id


def metadata_from_job(ctx: agents.JobContext) -> dict:
    try:
        metadata = json.loads(ctx.job.metadata or "{}")
        return metadata if isinstance(metadata, dict) else {}
    except (TypeError, ValueError, json.JSONDecodeError):
        logger.warning("invalid interview dispatch metadata")
        return {}


def tts_model_from_metadata(metadata: dict) -> str:
    """Resolve the validated teacher voice attached by the web app dispatch."""
    voice = metadata.get("voice")
    if isinstance(voice, str) and voice.startswith("aura-2-") and voice.endswith("-en"):
        return voice
    return SPEECH.tts_model


@server.rtc_session(agent_name=TRAILGRAD.agent_name)
async def interview_session(ctx: agents.JobContext) -> None:
    try:
        session_id = session_id_from_room(ctx.room.name)
    except ValueError:
        # LiveKit's console/test rooms get dispatched here too. Decline quietly
        # rather than crashing the job.
        logger.warning("declining non-interview room %r", ctx.room.name)
        return

    metadata = metadata_from_job(ctx)
    capability = metadata.get("interviewCapability")
    if not isinstance(capability, str) or not capability.startswith("iat1."):
        logger.error("declining interview %s without a session capability", session_id)
        return

    tts_model = tts_model_from_metadata(metadata)
    logger.info("joining interview %s with voice %s", session_id, tts_model)

    http = aiohttp.ClientSession()

    async def close_http() -> None:
        await http.close()

    ctx.add_shutdown_callback(close_http)

    trailgrad = TrailgradClient(http, capability)
    try:
        snapshot = await trailgrad.get_session(session_id)
    except Exception:
        logger.exception("could not load interview %s", session_id)
        return

    # No `llm=` argument at all. The parameter is NotGivenOr[...] and does
    # not accept None — omitting it is how you run a session with no LLM,
    # which is what keeps question generation out of this service.
    session = AgentSession(
        stt=build_stt(),
        # Aura-2: the voice is baked into the model id, no `voice` param.
        tts=deepgram.TTS(model=tts_model),
        vad=silero.VAD.load(),
        # Defaults (0.5s) are tuned for "what's the weather". A candidate
        # recalling an incident pauses mid-answer, and cutting in there is what
        # made this feel like it kept hanging up.
        turn_handling=TurnHandlingOptions(
            turn_detection=turn_detection(),
            endpointing={
                "min_delay": SPEECH.turn_min_delay_s,
                "max_delay": SPEECH.turn_max_delay_s,
            },
            interruption={
                "enabled": True,
                "min_duration": 0.4,
                "min_words": 1,
                "resume_false_interruption": True,
                "false_interruption_timeout": 1.2,
            },
            # There is no in-session LLM to speculate with. Leaving this on
            # creates work without reducing the HTTP decision latency.
            preemptive_generation={"enabled": False},
        ),
        aec_warmup_duration=1.0,
        user_away_timeout=None,
    )

    state = TurnState(started_at_ms=snapshot.started_at)
    silence_task: asyncio.Task[None] | None = None

    def cancel_silence_nudge() -> None:
        nonlocal silence_task
        if silence_task is not None:
            silence_task.cancel()
            silence_task = None

    def schedule_silence_nudge() -> None:
        nonlocal silence_task
        cancel_silence_nudge()

        async def nudge_sequence() -> None:
            try:
                for delay, text in zip(SILENCE_NUDGE_DELAYS, SILENCE_NUDGES):
                    await asyncio.sleep(delay)
                    if state.busy:
                        return
                    await session.say(text, allow_interruptions=True)
            except asyncio.CancelledError:
                return
            except Exception:
                logger.exception("silence nudge failed")

        silence_task = asyncio.create_task(nudge_sequence())

    @session.on("user_input_transcribed")
    def _on_transcript(event: UserInputTranscribedEvent) -> None:
        logger.info(
            "STT %s: %r", "final" if event.is_final else "interim", event.transcript[:70]
        )
        state.note_transcript(event.transcript, event.is_final)

    @session.on("conversation_item_added")
    def _on_item(event: object) -> None:
        logger.info("conversation item: %r", event)

    @session.on("agent_state_changed")
    def _on_agent_state(event: object) -> None:
        logger.info(
            "agent state: %s -> %s",
            getattr(event, "old_state", "unknown"),
            getattr(event, "new_state", "unknown"),
        )

    @session.on("error")
    def _on_error(event: object) -> None:
        logger.error("session error: %r", event)

    @session.on("close")
    def _on_close(event: object) -> None:
        logger.info("session closed: %r", event)

    # Only used to stamp when the answer began. The end of the turn comes from
    # Interviewer.on_user_turn_completed, not from raw voice activity.
    @session.on("user_state_changed")
    def _on_user_state(event: UserStateChangedEvent) -> None:
        logger.info("user state: %s -> %s", event.old_state, event.new_state)
        if event.new_state == "speaking":
            cancel_silence_nudge()
            state.mark_speech_start()

    async def on_turn(text: str) -> None:
        await handle_turn(
            session,
            trailgrad,
            session_id,
            state,
            text,
            on_waiting=schedule_silence_nudge,
        )

    @ctx.room.on("data_received")
    def _on_data(packet: object) -> None:
        if getattr(packet, "topic", None) != TYPED_ANSWER_TOPIC:
            return

        try:
            payload = json.loads(getattr(packet, "data", b"").decode("utf-8"))
            text = str(payload.get("text", "")).strip()
            turn_id = str(payload.get("turnId", ""))
            uuid.UUID(turn_id)
            start_ms = max(0, int(payload.get("startMs", 0)))
            end_ms = max(start_ms, int(payload.get("endMs", start_ms)))
        except (UnicodeDecodeError, ValueError, TypeError, json.JSONDecodeError):
            logger.warning("ignoring malformed typed answer")
            return

        if not text:
            return

        logger.info("typed answer received: %r", text[:90])
        asyncio.create_task(
            handle_turn(
                session,
                trailgrad,
                session_id,
                state,
                text,
                timing=(start_ms, end_ms),
                turn_id=turn_id,
                on_waiting=schedule_silence_nudge,
            )
        )

    await session.start(room=ctx.room, agent=Interviewer(on_turn))

    # The opening question was written by the planner when the session was
    # created, so it is spoken verbatim rather than generated.
    if snapshot.opening_utterance:
        logger.info("speaking opening: %s", snapshot.opening_utterance[:80])
        await session.say(snapshot.opening_utterance)
        logger.info("opening delivered")
        schedule_silence_nudge()
    else:
        logger.warning("no opening utterance on session %s", session_id)


class TurnState:
    """Accumulates one spoken answer and its wall-clock bounds."""

    def __init__(self, started_at_ms: int) -> None:
        self._session_start_ms = started_at_ms
        self._finals: list[str] = []
        self._partial = ""
        self._speech_started_ms: int | None = None
        self._busy = False

    def _now_offset_ms(self) -> int:
        return max(0, int(time.time() * 1000) - self._session_start_ms)

    def mark_speech_start(self) -> None:
        if self._speech_started_ms is None:
            self._speech_started_ms = self._now_offset_ms()

    def note_transcript(self, text: str, is_final: bool) -> None:
        if is_final:
            self._finals.append(text)
            self._partial = ""
        else:
            self._partial = text

    @property
    def busy(self) -> bool:
        return self._busy

    def begin_dispatch(self, text: str) -> tuple[str, int, int] | None:
        """Returns (answer, start_ms, end_ms) and clears the buffer."""
        # The framework hands over the assembled turn; the local buffer is only
        # a fallback for the rare case where it arrives empty.
        answer = text.strip() or " ".join(p.strip() for p in self._finals if p.strip()).strip()

        if not answer:
            logger.info("no transcript to dispatch; ignoring turn")
            return None

        if self._busy:
            logger.info("turn already in flight; ignoring")
            return None

        start_ms = self._speech_started_ms if self._speech_started_ms is not None else 0
        end_ms = self._now_offset_ms()

        self._finals.clear()
        self._partial = ""
        self._speech_started_ms = None
        self._busy = True

        return answer, start_ms, end_ms

    def begin_typed_dispatch(
        self, text: str, start_ms: int, end_ms: int
    ) -> tuple[str, int, int] | None:
        answer = text.strip()
        if not answer or self._busy:
            return None

        self._finals.clear()
        self._partial = ""
        self._speech_started_ms = None
        self._busy = True
        return answer, max(0, start_ms), max(start_ms, end_ms)

    def end_dispatch(self) -> None:
        self._busy = False


async def handle_turn(
    session: AgentSession,
    trailgrad: TrailgradClient,
    session_id: str,
    state: TurnState,
    text: str,
    timing: tuple[int, int] | None = None,
    turn_id: str | None = None,
    on_waiting: Callable[[], None] | None = None,
) -> None:
    dispatch = (
        state.begin_typed_dispatch(text, timing[0], timing[1])
        if timing is not None
        else state.begin_dispatch(text)
    )
    if dispatch is None:
        return

    answer, start_ms, end_ms = dispatch
    logger.info("answer (%dms): %s", end_ms - start_ms, answer[:80])

    decision_started = time.monotonic()
    try:
        decision = await trailgrad.decide(
            session_id,
            turn_id or str(uuid.uuid4()),
            answer,
            start_ms,
            end_ms,
        )
    except TrailgradApiError as error:
        logger.error("decide failed: %s", error)
        state.end_dispatch()
        await say_recovery(session)
        return
    except asyncio.TimeoutError:
        logger.error("decide timed out")
        state.end_dispatch()
        await say_recovery(session)
        return
    except Exception:
        # These run in a fire-and-forget task, where an unhandled exception
        # vanishes without a trace. Always log.
        logger.exception("decide raised")
        state.end_dispatch()
        await say_recovery(session)
        return

    logger.info(
        "decision action=%s q=%d/%d follow_ups=%d latency=%dms",
        decision.action,
        decision.question_index + 1,
        decision.question_count,
        decision.follow_up_count,
        int((time.monotonic() - decision_started) * 1000),
    )

    # Streams to the room as it synthesises; it does not wait for the full clip.
    try:
        await session.say(decision.utterance)
        if decision.phase != "done" and on_waiting is not None:
            on_waiting()
    except Exception:
        logger.exception("say failed")
    finally:
        state.end_dispatch()

    if decision.phase == "done":
        logger.info("interview complete, leaving room")
        await session.aclose()


async def say_recovery(session: AgentSession) -> None:
    """Keep a transient backend failure inside the conversation."""
    try:
        await session.say(
            "I missed that response on my side. Please say it once more.",
            allow_interruptions=True,
        )
    except Exception:
        logger.exception("recovery speech failed")


if __name__ == "__main__":
    lock_path = acquire_worker_lock()
    _log_config()
    logger.info("worker lock acquired path=%s pid=%d", lock_path, os.getpid())
    agents.cli.run_app(server)
