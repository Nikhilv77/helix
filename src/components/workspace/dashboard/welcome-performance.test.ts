import { describe, expect, it } from "vitest";
import { welcomePerformanceProfile } from "./welcome-performance";

describe("welcomePerformanceProfile", () => {
  it("keeps the live avatar on capable touch devices", () => {
    expect(
      welcomePerformanceProfile({
        coarsePointer: true,
        deviceMemory: 8,
        hardwareConcurrency: 8
      })
    ).toEqual({ touchPresentation: true, lightweightAvatar: false });

    expect(
      welcomePerformanceProfile({
        coarsePointer: true,
        deviceMemory: 4,
        hardwareConcurrency: 4
      })
    ).toEqual({ touchPresentation: true, lightweightAvatar: false });
  });

  it("uses the lightweight avatar on constrained or data-saving phones", () => {
    expect(
      welcomePerformanceProfile({ coarsePointer: true, deviceMemory: 2 })
    ).toMatchObject({ lightweightAvatar: true });
    expect(
      welcomePerformanceProfile({ coarsePointer: true, saveData: true })
    ).toMatchObject({ lightweightAvatar: true });
  });

  it("does not replace the desktop avatar based on memory alone", () => {
    expect(
      welcomePerformanceProfile({ coarsePointer: false, deviceMemory: 2 })
    ).toEqual({ touchPresentation: false, lightweightAvatar: false });
  });
});
