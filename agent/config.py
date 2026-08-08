"""Provider and model configuration.

Everything swappable lives here. STT and TTS both run on Deepgram so they draw
on one credit pool and one key; swapping either is a one-line change.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from dotenv import load_dotenv


# Configuration dataclasses are evaluated at import time, so the local file
# must be loaded before their defaults read os.environ.
load_dotenv(".env.local")


@dataclass(frozen=True)
class SpeechConfig:
    # --- Speech to text -----------------------------------------------------
    # Flux is designed for conversational voice agents and emits semantic
    # end-of-turn events. That avoids choosing between clipped answers and a
    # multi-second fixed silence delay.
    stt_model: str = os.getenv("TRAILGRAD_STT_MODEL", "flux-general-en")
    stt_language: str = os.getenv("TRAILGRAD_STT_LANGUAGE", "en")
    stt_eager_eot_threshold: float = float(
        os.getenv("TRAILGRAD_STT_EAGER_EOT_THRESHOLD", "0.5")
    )
    stt_eot_threshold: float = float(os.getenv("TRAILGRAD_STT_EOT_THRESHOLD", "0.7"))
    stt_eot_timeout_ms: int = int(os.getenv("TRAILGRAD_STT_EOT_TIMEOUT_MS", "1600"))

    # Deepgram keeps filler words in the transcript by default, which the
    # Phase 5 filler-rate metric depends on. Do not turn this off.
    stt_filler_words: bool = True

    # Nova fallback only. Flux uses its EOT settings above.
    endpointing_ms: int = int(os.getenv("TRAILGRAD_ENDPOINTING_MS", "300"))

    # --- Turn taking --------------------------------------------------------
    # How long a silence must run before the turn is considered finished.
    # Candidates think mid-answer; cutting in at 0.5s makes it feel twitchy.
    turn_min_delay_s: float = float(os.getenv("TRAILGRAD_TURN_MIN_DELAY_S", "0.35"))
    turn_max_delay_s: float = float(os.getenv("TRAILGRAD_TURN_MAX_DELAY_S", "1.8"))

    # --- Text to speech -----------------------------------------------------
    # Deepgram Aura-2. The voice is part of the model id — there is no separate
    # voice parameter. "asteria" is Deepgram's clearest female read, which suits
    # an interviewer better than an upbeat assistant voice.
    tts_model: str = os.getenv("TRAILGRAD_TTS_MODEL", "aura-2-asteria-en")


@dataclass(frozen=True)
class TrailgradConfig:
    """Where the interview brain lives. The agent owns no interview state."""

    api_base_url: str = os.getenv("TRAILGRAD_API_BASE_URL", "http://localhost:3001")
    request_timeout_s: float = float(os.getenv("TRAILGRAD_API_TIMEOUT_S", "10"))
    # Must match LIVEKIT_AGENT_NAME in the Next.js app. Versioning this name
    # prevents an older deployed worker from receiving a newly created call.
    #
    # Still "helix-…" after the Trailgrad rename, for that same reason: the web
    # app dispatches to this exact string, so it can only change in a deploy
    # that ships both sides at once.
    agent_name: str = os.getenv("LIVEKIT_AGENT_NAME", "helix-interviewer-v2")


SPEECH = SpeechConfig()
TRAILGRAD = TrailgradConfig()
