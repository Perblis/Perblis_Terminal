import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OtpInput } from "./otp-input";

describe("OtpInput", () => {
  it("auto-advances and fires onComplete with the full code", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<OtpInput onComplete={onComplete} autoFocus={false} />);

    await user.click(screen.getByLabelText("Digit 1"));
    await user.keyboard("482910");

    expect(onComplete).toHaveBeenCalledWith("482910");
  });

  it("is paste-aware from the first cell", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<OtpInput onComplete={onComplete} autoFocus={false} />);

    const first = screen.getByLabelText("Digit 1");
    await user.click(first);
    await user.paste("739201");

    expect(onComplete).toHaveBeenCalledWith("739201");
  });

  it("ignores non-digit input", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<OtpInput onComplete={onComplete} autoFocus={false} />);

    await user.click(screen.getByLabelText("Digit 1"));
    await user.keyboard("ab!");

    expect(onComplete).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Digit 1") as HTMLInputElement).value).toBe("");
  });
});
