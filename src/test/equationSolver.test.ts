import { describe, expect, it } from "vitest";
import { solveEquation } from "@/lib/equationSolver";

describe("equation solver", () => {
  it("solves the requested linear example with working", () => {
    const answer = solveEquation("2x+5=15");
    expect(answer.roots).toEqual([5]);
    expect(answer.steps.length).toBeGreaterThan(2);
  });

  it("solves the requested quadratic example with both roots", () => {
    const answer = solveEquation("x²-5x+6=0");
    expect(answer.roots).toEqual([3, 2]);
    expect(answer.steps.some((step) => step.includes("discriminant"))).toBe(true);
  });

  it("handles parentheses and implicit multiplication", () => {
    const answer = solveEquation("2(x+3)=16");
    expect(answer.roots).toEqual([5]);
  });
});
