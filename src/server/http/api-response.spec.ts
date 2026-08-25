import { ApiRouteError } from "./api-error";
import { apiError } from "./api-response";

describe("apiError", () => {
  it("adds a Retry-After header to timed rate-limit responses", () => {
    const response = apiError(
      new ApiRouteError(429, "RATE_LIMITED", "Slow down", { retryAfterMs: 2_001 }),
      "/api/test"
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3");
  });

  it("does not add Retry-After to ordinary errors", () => {
    const response = apiError(new ApiRouteError(400, "BAD_REQUEST", "Nope"), "/api/test");

    expect(response.headers.get("retry-after")).toBeNull();
  });
});
