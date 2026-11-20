import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EquationSolverView } from "@/components/EquationSolverView";
import { resetAllFeatureTrials } from "@/lib/trialManager";

describe("EquationSolverView Camera Scan & Photo Upload", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllFeatureTrials();
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => "blob:mock-preview");
    } else {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-preview");
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Camera Scan and Upload Photo controls and solves uploaded handwritten algebra photo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      if (url.includes("/api/solve-math-image")) {
        return new Response(
          JSON.stringify({
            detectedEquation: "2x + 5 = 15",
            mathType: "linear",
            summary: "x = 5",
            steps: ["Subtract 5 from both sides", "Divide by 2"],
            formulaNote: "Linear isolation of x.",
            roots: [5],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 404 });
    });

    render(<EquationSolverView isPro={true} onRequestUpgrade={() => {}} />);

    expect(screen.getByRole("button", { name: /Camera Scan/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Upload Photo/i })).toBeInTheDocument();

    const uploadInput = screen.getByLabelText("Upload math photo") as HTMLInputElement;
    const fakePhoto = new File(["fake-image-bytes"], "handwritten-algebra.jpg", {
      type: "image/jpeg",
    });

    fireEvent.change(uploadInput, { target: { files: [fakePhoto] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/solve-math-image",
        expect.objectContaining({ method: "POST" })
      );
      expect((screen.getByLabelText("Equation") as HTMLTextAreaElement).value).toBe("2x + 5 = 15");
      expect(screen.getByText("x = 5")).toBeInTheDocument();
    });
  });

  it("solves higher-order handwritten math (systems/cubic) returned by Vision scanner", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      if (url.includes("/api/solve-math-image")) {
        return new Response(
          JSON.stringify({
            detectedEquation: "x + y = 10, x - y = 2",
            mathType: "system",
            summary: "x = 6, y = 4",
            steps: ["Add both equations: 2x = 12 -> x = 6", "Substitute back: 6 + y = 10 -> y = 4"],
            formulaNote: "Elimination method for simultaneous linear equations.",
            roots: [6, 4],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 404 });
    });

    render(<EquationSolverView isPro={true} onRequestUpgrade={() => {}} />);

    const cameraCaptureInput = screen.getByLabelText("Capture math photo with camera") as HTMLInputElement;
    const fakeCapture = new File(["fake-capture"], "system-capture.jpg", {
      type: "image/jpeg",
    });

    fireEvent.change(cameraCaptureInput, { target: { files: [fakeCapture] } });

    await waitFor(() => {
      expect((screen.getByLabelText("Equation") as HTMLTextAreaElement).value).toBe(
        "x + y = 10, x - y = 2"
      );
      expect(screen.getByText("x = 6, y = 4")).toBeInTheDocument();
    });
  });
});
