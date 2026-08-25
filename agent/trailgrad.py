"""HTTP client for the Trailgrad interview brain.

The decision logic lives in the Next.js app and is not duplicated here. This
module only moves text back and forth.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

import aiohttp

from config import TRAILGRAD

logger = logging.getLogger("trailgrad.client")


@dataclass
class Decision:
    action: str
    utterance: str
    phase: str
    question_index: int
    question_count: int
    follow_up_count: int
    elapsed_ms: int


@dataclass
class SessionSnapshot:
    session_id: str
    phase: str
    question_index: int
    question_count: int
    started_at: int
    opening_utterance: str


class TrailgradClient:
    def __init__(
        self,
        session: aiohttp.ClientSession,
        interview_capability: str | None = None,
    ) -> None:
        self._http = session
        self._base = TRAILGRAD.api_base_url.rstrip("/")
        self._headers = (
            {"Authorization": f"Bearer {interview_capability}"}
            if interview_capability
            else None
        )

    async def get_session(self, session_id: str) -> SessionSnapshot:
        payload = await self._get(f"/api/interview/{session_id}")

        turns = payload.get("turns", [])
        opening = next(
            (turn["text"] for turn in turns if turn.get("speaker") == "agent"),
            "",
        )

        return SessionSnapshot(
            session_id=payload["sessionId"],
            phase=payload["phase"],
            question_index=payload["questionIndex"],
            question_count=payload["questionCount"],
            started_at=payload["startedAt"],
            opening_utterance=opening,
        )

    async def decide(
        self,
        session_id: str,
        turn_id: str,
        answer: str,
        start_ms: int,
        end_ms: int,
    ) -> Decision:
        """One turn. The response is spoken verbatim — the agent never writes."""
        body = {
            "sessionId": session_id,
            "turnId": turn_id,
            "userAnswer": answer,
            "startMs": start_ms,
            "endMs": end_ms,
        }
        for attempt in range(3):
            try:
                payload = await self._post("/api/interview/decide", body)
                break
            except TrailgradApiError as error:
                if error.code != "ANSWER_IN_PROGRESS" or attempt == 2:
                    raise
            except (aiohttp.ClientError, asyncio.TimeoutError):
                if attempt == 2:
                    raise
            await asyncio.sleep(0.2 * (attempt + 1))
        else:  # pragma: no cover - the loop either breaks or raises
            raise RuntimeError("interview decision retry exhausted")

        return Decision(
            action=payload["action"],
            utterance=payload["utterance"],
            phase=payload["phase"],
            question_index=payload["questionIndex"],
            question_count=payload["questionCount"],
            follow_up_count=payload["followUpCount"],
            elapsed_ms=payload["elapsedMs"],
        )

    async def _get(self, path: str) -> dict:
        async with self._http.get(
            f"{self._base}{path}",
            headers=self._headers,
            timeout=aiohttp.ClientTimeout(total=TRAILGRAD.request_timeout_s),
        ) as response:
            return self._unwrap(await response.json(), path)

    async def _post(self, path: str, body: dict) -> dict:
        async with self._http.post(
            f"{self._base}{path}",
            json=body,
            headers=self._headers,
            timeout=aiohttp.ClientTimeout(total=TRAILGRAD.request_timeout_s),
        ) as response:
            return self._unwrap(await response.json(), path)

    @staticmethod
    def _unwrap(payload: dict, path: str) -> dict:
        """The API wraps everything in a success/error envelope."""
        if not payload.get("success"):
            error = payload.get("error", {})
            raise TrailgradApiError(
                code=error.get("code", "UNKNOWN"),
                message=error.get("message", "Request failed"),
                path=path,
            )
        return payload["data"]


class TrailgradApiError(RuntimeError):
    def __init__(self, code: str, message: str, path: str) -> None:
        super().__init__(f"{code}: {message} ({path})")
        self.code = code
