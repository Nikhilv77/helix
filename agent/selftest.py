"""Drives the turn pipeline without LiveKit or a microphone.

Exercises exactly what happens after speech is transcribed:
Interviewer.on_user_turn_completed -> handle_turn -> /api/interview/decide ->
session.say(). The AgentSession is stubbed so the only real dependency is the
Next.js decide endpoint.

    .venv/bin/python selftest.py
"""

from __future__ import annotations

import asyncio
import sys

import aiohttp

from trailgrad import TrailgradClient
from main import Interviewer, TurnState, handle_turn

API = "http://localhost:3001"

SETUP = {
    "role": "backend",
    "level": "3-5",
    "roundType": "behavioral",
    "intensity": "realistic",
    "context": "Rebuilt a payments retry pipeline with idempotency keys and dead-letter queues.",
}

ANSWERS = [
    "It went pretty well overall and the team was happy with the outcome.",
    "I mostly handled the backend side of things on that project.",
    "I added idempotency keys in Redis and cut duplicate charges from forty a week to zero.",
]


class FakeSession:
    """Stands in for AgentSession; records what would have been spoken."""

    def __init__(self) -> None:
        self.spoken: list[str] = []

    async def say(self, text: str) -> None:
        self.spoken.append(text)

    async def aclose(self) -> None:
        pass


class FakeMessage:
    def __init__(self, text: str) -> None:
        self.text_content = text


async def main() -> int:
    async with aiohttp.ClientSession() as http:
        async with http.post(f"{API}/api/interview/start", json=SETUP) as response:
            payload = await response.json()

        if not payload.get("success"):
            print("FAIL: could not start a session:", payload.get("error"))
            return 1

        session_id = payload["data"]["sessionId"]
        started_at = payload["data"]["startedAt"]
        print(f"session   {session_id}")
        print(f"opening   {payload['data']['utterance'][:88]}…\n")

        trailgrad = TrailgradClient(http)
        fake = FakeSession()
        state = TurnState(started_at_ms=started_at)

        async def on_turn(text: str) -> None:
            await handle_turn(fake, trailgrad, session_id, state, text)

        # The real Agent subclass, driven through its real end-of-turn hook.
        interviewer = Interviewer(on_turn)

        for answer in ANSWERS:
            before = len(fake.spoken)
            print(f"YOU       {answer}")
            await interviewer.on_user_turn_completed(None, FakeMessage(answer))

            if len(fake.spoken) == before:
                print("FAIL: the agent said nothing back\n")
                return 1

            print(f"TRAILGRAD     {fake.spoken[-1]}\n")

        print(f"PASS — {len(fake.spoken)} replies for {len(ANSWERS)} answers")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
