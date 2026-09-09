"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMayaVoice, voiceUrl, type VoiceState } from "@/infrastructure/realtime/use-maya-voice";
import {
  baselineQuestionTeacherCue,
  firstBaselineSection,
  nextBaselineSection
} from "../domain/preparation-onboarding-flow";
import type { BaselineSection, PreparationOnboardingState } from "../domain/preparation-onboarding";
import type { Role } from "@/lib/shared/types";
import type { BaselineFlowStage } from "./baseline-assessment";
import { TARGET_SETUP_COPY } from "./target-setup";

interface VoiceSlide {
  title: string;
  body: string;
  voiceText?: string;
}

export function useWelcomeVoice({
  teacherId,
  current,
  slides,
  visible,
  touchPresentation,
  step,
  targetStage,
  baselineStage,
  activeBaselineSection,
  onboarding,
  targetRole
}: {
  teacherId: string;
  current: VoiceSlide;
  slides: VoiceSlide[];
  visible: boolean;
  touchPresentation: boolean;
  step: number;
  targetStage: number;
  baselineStage: BaselineFlowStage;
  activeBaselineSection: BaselineSection | null;
  onboarding: PreparationOnboardingState;
  targetRole: Role;
}) {
  const voiceEnabled = useRef(true);
  const voicePreloads = useRef(new Map<string, HTMLAudioElement>());
  const {
    state: voiceState,
    speak: speakLine,
    stop: stopVoice,
    awaitingGesture,
    setAwaitingGesture
  } = useMayaVoice();
  const warmVoice = useCallback(
    (line: string) => {
      if (!line.trim()) return;
      const url = voiceUrl(line, teacherId);
      if (voicePreloads.current.has(url)) return;
      const warm = new Audio(url);
      warm.preload = "auto";
      voicePreloads.current.set(url, warm);
      warm.load();
      if (voicePreloads.current.size > 3) {
        const oldestUrl = voicePreloads.current.keys().next().value;
        if (oldestUrl) {
          const oldest = voicePreloads.current.get(oldestUrl);
          oldest?.pause();
          oldest?.removeAttribute("src");
          voicePreloads.current.delete(oldestUrl);
        }
      }
    },
    [teacherId]
  );

  useEffect(
    () => () => {
      for (const element of voicePreloads.current.values()) {
        element.pause();
        element.removeAttribute("src");
      }
      voicePreloads.current.clear();
    },
    []
  );

  useEffect(() => {
    if (!visible || !voiceEnabled.current || awaitingGesture) return;
    const start = window.setTimeout(() => void speakLine(slideVoiceText(current)), 60);
    return () => window.clearTimeout(start);
  }, [awaitingGesture, current, speakLine, visible]);

  useEffect(() => {
    if (!visible || touchPresentation) return;
    const next = slides[step + 1];
    if (next) warmVoice(slideVoiceText(next));
  }, [slides, step, touchPresentation, visible, warmVoice]);

  useEffect(() => {
    if (!visible || touchPresentation || step !== 1) return;
    const nextTarget = TARGET_SETUP_COPY[targetStage + 1];
    if (nextTarget) warmVoice(`${nextTarget.title} ${nextTarget.body}`);
  }, [step, targetStage, touchPresentation, visible, warmVoice]);

  useEffect(() => {
    if (!visible || touchPresentation) return;
    const nextSection =
      baselineStage === "intro"
        ? firstBaselineSection(targetRole)
        : activeBaselineSection
          ? nextBaselineSection(activeBaselineSection)
          : null;
    if (!nextSection) return;
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
    touchPresentation,
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
    void speakLine(slideVoiceText(current));
  }, [current, setAwaitingGesture, speakLine, stopVoice, voiceState]);

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
