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

  it("handles uppercase X without throwing", () => {
    const answer = solveEquation("2X + 5 = 15");
    expect(answer.roots).toEqual([5]);
  });

  it("handles parentheses and implicit multiplication 2(x+3) = 10", () => {
    const answer = solveEquation("2(x+3) = 10");
    expect(answer.roots).toEqual([2]);
  });

  it("handles explicit multiplication with parentheses 2*(x+3) = 10", () => {
    const answer = solveEquation("2*(x+3) = 10");
    expect(answer.roots).toEqual([2]);
  });

  it("handles factored quadratic (x-1)*(x+2) = 0", () => {
    const answer = solveEquation("(x-1)*(x+2) = 0");
    expect(answer.roots).toEqual([1, -2]);
  });

  it("handles implicit multiplication factored (x-1)(x+2) = 0", () => {
    const answer = solveEquation("(x-1)(x+2) = 0");
    expect(answer.roots).toEqual([1, -2]);
  });

  it("handles expression without equals sign by defaulting to = 0", () => {
    const answer = solveEquation("2x + 10");
    expect(answer.roots).toEqual([-5]);
  });

  it("handles trailing equals sign 2x + 10 =", () => {
    const answer = solveEquation("2x + 10 =");
    expect(answer.roots).toEqual([-5]);
  });

  it("handles full-width unicode equals 2x ＝ 8", () => {
    const answer = solveEquation("2x ＝ 8");
    expect(answer.roots).toEqual([4]);
  });
});

