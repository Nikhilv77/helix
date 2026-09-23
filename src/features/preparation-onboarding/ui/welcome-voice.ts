"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMayaVoice, type VoiceState } from "@/infrastructure/realtime/use-maya-voice";
import {
  baselineQuestionTeacherCue,
  firstBaselineSection,
  nextBaselineSection
} from "../domain/preparation-onboarding-flow";
import type { BaselineSection, PreparationOnboardingState } from "../domain/preparation-onboarding";
import type { Role } from "@/lib/shared/types";
import { baselineIntroCopy, type BaselineFlowStage } from "./baseline-assessment";
import { TARGET_SETUP_COPY } from "./target-setup";

interface VoiceSlide {
  title: string;
  body: string;
  voiceText?: string;
}

export function useWelcomeVoice({
  teacherId,
  current,
  playbackKey,
  slides,
  visible,
  step,
  alreadyOnboarded,
  baselineStage,
  activeBaselineSection,
  onboarding,
  targetRole
}: {
  teacherId: string;
  current: VoiceSlide;
  /** Changes only when navigation reveals a new spoken screen. */
  playbackKey: string;
  slides: VoiceSlide[];
  visible: boolean;
  step: number;
  alreadyOnboarded: boolean;
  baselineStage: BaselineFlowStage;
  activeBaselineSection: BaselineSection | null;
  onboarding: PreparationOnboardingState;
  targetRole: Role;
}) {
  const voiceEnabled = useRef(true);
  const {
    state: voiceState,
    speak: speakLine,
    stop: stopVoice,
    preload: preloadVoice,
    awaitingGesture,
    setAwaitingGesture
  } = useMayaVoice();
  const warmVoice = useCallback(
    (line: string) => {
      if (!line.trim()) return;
      preloadVoice(line, teacherId);
    },
    [preloadVoice, teacherId]
  );
  const currentVoiceText = slideVoiceText(current);
  const currentVoiceTextRef = useRef(currentVoiceText);
  currentVoiceTextRef.current = currentVoiceText;

  useEffect(() => {
    // Usually this exact line was already warmed on the onboarding route. This
    // is also a safe fallback for returning users and direct modal loads.
    warmVoice(currentVoiceText);
  }, [currentVoiceText, warmVoice]);

  useEffect(() => {
    // Returning candidates can land directly on this final slide. Start its
    // request during the component's first client render, before the modal is
    // made visible and before its automatic playback effect runs.
    if (alreadyOnboarded) warmVoice(welcomeBackVoiceText());
  }, [alreadyOnboarded, warmVoice]);

  useEffect(() => {
    if (!visible || !voiceEnabled.current || awaitingGesture) return;
    const start = window.setTimeout(() => void speakLine(currentVoiceTextRef.current), 60);
    return () => window.clearTimeout(start);
  }, [awaitingGesture, playbackKey, speakLine, visible]);

  useEffect(() => {
    if (!visible) return;
    const next = slides[step + 1];
    if (next) warmVoice(slideVoiceText(next));
  }, [slides, step, visible, warmVoice]);

  useEffect(() => {
    if (!visible || step !== 1) return;
    // Target setup is a short, finite flow. Warming every line as soon as the
    // user enters it keeps the voice response immediate after any selection,
    // including the preparation-areas screen on touch devices.
    for (const target of TARGET_SETUP_COPY) warmVoice(`${target.title} ${target.body}`);
    warmVoice(baselineIntroVoiceText(targetRole));
  }, [step, targetRole, visible, warmVoice]);

  useEffect(() => {
    if (!visible) return;
    const nextSection =
      baselineStage === "intro"
        ? firstBaselineSection(targetRole)
        : activeBaselineSection
          ? nextBaselineSection(activeBaselineSection)
          : null;
    if (!nextSection) {
      // The completion screen arrives only after the final answer is saved.
      // Prime it while that last question is still on screen so its voice does
      // not wait on the mutation response.
      if (activeBaselineSection) warmVoice(completionVoiceText());
      return;
    }
    const nextQuestion = onboarding.questions[nextSection];
    if (nextQuestion)
      warmVoice(
        `${baselineQuestionTeacherCue(nextSection, onboarding.questionIds[nextSection])} ${nextQuestion.prompt}`
      );
  }, [
    activeBaselineSection,
    baselineStage,
    onboarding.questionIds,
    onboarding.questions,
    targetRole,
    visible,
    warmVoice
  ]);

  useEffect(() => {
    if (!awaitingGesture) return;
    const unlock = () => setAwaitingGesture(false);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [awaitingGesture, setAwaitingGesture]);

  const toggleVoice = useCallback(() => {
    if (voiceState === "speaking" || voiceState === "loading") {
      voiceEnabled.current = false;
      setAwaitingGesture(false);
      stopVoice();
      return;
    }
    voiceEnabled.current = true;
    void speakLine(currentVoiceText);
  }, [currentVoiceText, setAwaitingGesture, speakLine, stopVoice, voiceState]);

  return {
    voiceState,
    speaking: voiceState === "speaking",
    awaitingGesture,
    stopVoice,
    toggleVoice
  };
}

export function voiceLabel(state: VoiceState, teacherName: string): string {
  return {
    idle: `Hear ${teacherName}`,
    loading: "Loading voice",
    speaking: "Stop voice",
    unavailable: "Retry voice"
  }[state];
}

function slideVoiceText(slide: VoiceSlide): string {
  return slide.voiceText ?? `${slide.title} ${slide.body}`;
}

function baselineIntroVoiceText(role: Role) {
  return baselineIntroCopy(role).voiceText;
}

function completionVoiceText() {
  return "We have your first evidence. This is a starting picture, not a readiness verdict. Trailgrad will earn real scores from your future practice and interviews—not invent them today.";
}

function welcomeBackVoiceText() {
  return "You’re already onboarded. Your learning path is ready and waiting for you. Enjoy learning, keep building momentum, and take the next step whenever you’re ready.";
}
