import { describe, expect, it, vi, beforeEach } from "vitest";
import { copyToClipboard } from "@/lib/clipboard";

describe("copyToClipboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false for empty input", async () => {
    const res = await copyToClipboard("");
    expect(res).toBe(false);
  });

  it("copies via modern navigator.clipboard when available", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
    // Set isSecureContext
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });

    const success = await copyToClipboard("x = 5");
    expect(success).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith("x = 5");
  });

  it("falls back to document.execCommand when navigator.clipboard fails", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
    });
    document.execCommand = vi.fn().mockReturnValue(true);

    const success = await copyToClipboard("42");
    expect(success).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });
});
