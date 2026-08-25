import { describe, expect, it } from "vitest";
import type { CandidateProfile } from "../shared/types";
import { ApiClientError } from "../api/api-client";
import { loadPostAuthProfile } from "./post-auth";

const profile = { onboardingCompletedAt: null } as CandidateProfile;

describe("loadPostAuthProfile", () => {
  it("reconciles the anonymous owner before loading the signed-in profile", async () => {
    const order: string[] = [];

    await expect(
      loadPostAuthProfile({
        reconcile: async () => {
          order.push("reconcile");
          return { moved: 2 };
        },
        loadProfile: async () => {
          order.push("profile");
          return profile;
        }
      })
    ).resolves.toBe(profile);
    expect(order).toEqual(["reconcile", "profile"]);
  });

  it("surfaces a reconciliation 401 so the continuation screen retries", async () => {
    let profileLoaded = false;
    const unauthorized = new ApiClientError({
      code: "AUTH_REQUIRED",
      message: "Authentication is required",
      status: 401
    });

    await expect(
      loadPostAuthProfile({
        reconcile: async () => Promise.reject(unauthorized),
        loadProfile: async () => {
          profileLoaded = true;
          return profile;
        }
      })
    ).rejects.toBe(unauthorized);
    expect(profileLoaded).toBe(false);
  });

  it("does not block sign-in when reconciliation has a non-auth failure", async () => {
    await expect(
      loadPostAuthProfile({
        reconcile: async () => {
          throw new ApiClientError({
            code: "RECONCILE_UNAVAILABLE",
            message: "Try later",
            status: 503
          });
        },
        loadProfile: async () => profile
      })
    ).resolves.toBe(profile);
  });
});
