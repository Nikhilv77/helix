"""Provider and model configuration.

Everything swappable lives here. STT and TTS both run on Deepgram so they draw
on one credit pool and one key; swapping either is a one-line change.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class SpeechConfig:
    # --- Speech to text -----------------------------------------------------
    # Streaming with interim results, so the interruption watchdog can see a
    # partial transcript before the turn ends.
    stt_model: str = os.getenv("HELIX_STT_MODEL", "nova-3")
    # "multi" runs Deepgram's multilingual model, which handles accented
    # English far better than the en-US model. Pinning en-US was turning real
    # sentences into fragments like "I just they're".
    stt_language: str = os.getenv("HELIX_STT_LANGUAGE", "multi")

    # Deepgram keeps filler words in the transcript by default, which the
    # Phase 5 filler-rate metric depends on. Do not turn this off.
    stt_filler_words: bool = True

    # Deepgram's own utterance finalisation. Short values chop a sentence into
    # fragments at every natural pause, so this stays generous and LiveKit's
    # semantic turn detector decides when the turn is actually over.
    # Deepgram only decides when to emit a final here; LiveKit's semantic turn
    # detector owns the actual end of turn, so this stays short. 900ms was
    # starving the pipeline of finals entirely.
    endpointing_ms: int = int(os.getenv("HELIX_ENDPOINTING_MS", "300"))

    # --- Turn taking --------------------------------------------------------
    # How long a silence must run before the turn is considered finished.
    # Candidates think mid-answer; cutting in at 0.5s makes it feel twitchy.
    turn_min_delay_s: float = float(os.getenv("HELIX_TURN_MIN_DELAY_S", "1.4"))
    turn_max_delay_s: float = float(os.getenv("HELIX_TURN_MAX_DELAY_S", "5.0"))

    # --- Text to speech -----------------------------------------------------
    # Deepgram Aura-2. The voice is part of the model id — there is no separate
    # voice parameter. "asteria" is Deepgram's clearest female read, which suits
    # an interviewer better than an upbeat assistant voice.
    tts_model: str = os.getenv("HELIX_TTS_MODEL", "aura-2-asteria-en")


@dataclass(frozen=True)
class HelixConfig:
    """Where the interview brain lives. The agent owns no interview state."""

    api_base_url: str = os.getenv("HELIX_API_BASE_URL", "http://localhost:3001")
    request_timeout_s: float = float(os.getenv("HELIX_API_TIMEOUT_S", "20"))


SPEECH = SpeechConfig()
HELIX = HelixConfig()
