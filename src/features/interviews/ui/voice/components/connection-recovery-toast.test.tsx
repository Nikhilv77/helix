import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionRecoveryToast } from "./connection-recovery-toast";

describe("ConnectionRecoveryToast", () => {
  afterEach(cleanup);

  it("puts the recovery action in a prominent alert", () => {
    const reconnect = vi.fn();
    render(
      <ConnectionRecoveryToast
        message="The interviewer disconnected. Your saved answers are safe."
        onReconnect={reconnect}
      />
    );

    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("heading", { name: "James lost the connection" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reconnect now" }));
    expect(reconnect).toHaveBeenCalledOnce();
  });
});
