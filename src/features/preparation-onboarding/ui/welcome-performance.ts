export interface WelcomeDeviceSignals {
  coarsePointer: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
}

export interface WelcomePerformanceProfile {
  touchPresentation: boolean;
  lightweightAvatar: boolean;
}

/** Keep the live avatar on capable phones, but avoid WebGL on constrained ones. */
export function welcomePerformanceProfile(
  signals: WelcomeDeviceSignals
): WelcomePerformanceProfile {
  const constrained =
    signals.saveData === true ||
    (signals.deviceMemory !== undefined && signals.deviceMemory <= 2) ||
    (signals.hardwareConcurrency !== undefined &&
      signals.hardwareConcurrency > 0 &&
      signals.hardwareConcurrency <= 2);

  return {
    touchPresentation: signals.coarsePointer,
    lightweightAvatar: signals.coarsePointer && constrained
  };
}
