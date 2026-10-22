import { parse } from "mathjs";

type Polynomial = [number, number, number];
export type EquationSolution = { summary: string; steps: string[]; roots: number[] };

const tidy = (value: number) => (Math.abs(value) < 1e-10 ? 0 : value);
const format = (value: number) => String(Number(tidy(value).toPrecision(10)));

function polynomialFromExpression(expression: string): Polynomial {
  const node = parse(expression) as any;
  const visit = (part: any): Polynomial => {
    if (part.isConstantNode && typeof part.value === "number") return [part.value, 0, 0];
    if (part.isSymbolNode && part.name === "x") return [0, 1, 0];
    if (part.isOperatorNode) {
      const args = part.args as any[];
      if (part.op === "+" || part.op === "-") {
        if (args.length === 1) return part.op === "-" ? visit(args[0]).map((n) => -n) as Polynomial : visit(args[0]);
        const left = visit(args[0]);
        const right = visit(args[1]);
        return left.map((n, i) => n + (part.op === "+" ? 1 : -1) * right[i]) as Polynomial;
      }
      if (part.op === "*") {
        const left = visit(args[0]);
        const right = visit(args[1]);
        const result = [0, 0, 0, 0, 0];
        left.forEach((a, i) => right.forEach((b, j) => { result[i + j] += a * b; }));
        if (result.slice(3).some((n) => Math.abs(n) > 1e-10)) throw new Error("Only linear and quadratic equations are supported.");
        return result.slice(0, 3) as Polynomial;
      }
      if (part.op === "/") {
        const numerator = visit(args[0]);
        const denominator = visit(args[1]);
        if (denominator[1] !== 0 || denominator[2] !== 0 || denominator[0] === 0) {
          throw new Error("Divide only by a non-zero number, not by an expression containing x.");
        }
        return numerator.map((n) => n / denominator[0]) as Polynomial;
      }
      if (part.op === "^") {
        const base = visit(args[0]);
        const exponent = visit(args[1]);
        if (exponent[1] !== 0 || exponent[2] !== 0 || ![0, 1, 2].includes(exponent[0])) {
          throw new Error("Only x to the power of 1 or 2 is supported.");
        }
        if (exponent[0] === 0) return [1, 0, 0];
        if (exponent[0] === 1) return base;
        const squared = [
          base[0] * base[0],
          2 * base[0] * base[1],
          base[1] * base[1] + 2 * base[0] * base[2],
          2 * base[1] * base[2],
          base[2] * base[2],
        ];
        if (squared.slice(3).some((n) => Math.abs(n) > 1e-10)) throw new Error("Only quadratic equations are supported.");
        return squared.slice(0, 3) as Polynomial;
      }
    }
    throw new Error("Use numbers, x, and +, −, ×, ÷, or powers up to 2.");
  };
  return visit(node);
}

export function solveEquation(input: string): EquationSolution {
  const normalized = input
    .trim()
    .replace(/[⁰¹²³]/g, (digit) => `^${"⁰¹²³".indexOf(digit)}`)
    .replace(/[−–]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/,/g, "")
    .replace(/(\d)(x)/gi, "$1*$2")
    .replace(/(x)(\d)/gi, "$1*$2");
  const sides = normalized.split("=");
  if (sides.length !== 2 || !sides[0].trim() || !sides[1].trim()) {
    throw new Error("Enter one equation with an equals sign, for example 2x+5=15.");
  }
  const left = polynomialFromExpression(sides[0]);
  const right = polynomialFromExpression(sides[1]);
  const [c, b, a] = left.map((n, i) => tidy(n - right[i])) as Polynomial;
  const steps = [`Start with ${input.trim()}.`, "Move all terms to one side so the equation equals zero."];

  if (a === 0 && b === 0) {
    if (c === 0) return { summary: "Every real number is a solution.", steps: [...steps, "Both sides simplify to the same expression."], roots: [] };
    return { summary: "There is no solution.", steps: [...steps, `${format(c)} = 0 is false.`], roots: [] };
  }
  if (a === 0) {
    steps.push(`The equation is ${format(b)}x ${c < 0 ? "−" : "+"} ${format(Math.abs(c))} = 0.`);
    steps.push(`Subtract ${format(c)} and divide by ${format(b)}: x = −(${format(c)}) ÷ ${format(b)}.`);
    const root = -c / b;
    steps.push(`Therefore, x = ${format(root)}.`);
    return { summary: `x = ${format(root)}`, steps, roots: [root] };
  }

  steps.push(`Write it as ${format(a)}x² ${b < 0 ? "−" : "+"} ${format(Math.abs(b))}x ${c < 0 ? "−" : "+"} ${format(Math.abs(c))} = 0.`);
  steps.push(`Identify a = ${format(a)}, b = ${format(b)}, and c = ${format(c)}.`);
  const discriminant = tidy(b * b - 4 * a * c);
  steps.push(`Find the discriminant: Δ = b² − 4ac = ${format(discriminant)}.`);
  if (discriminant < 0) return { summary: "No real solutions.", steps: [...steps, "A negative discriminant means the roots are not real numbers."], roots: [] };
  const rootDelta = Math.sqrt(discriminant);
  const first = tidy((-b + rootDelta) / (2 * a));
  const second = tidy((-b - rootDelta) / (2 * a));
  steps.push(`Use x = (−b ± √Δ) ÷ 2a = (${format(-b)} ± ${format(rootDelta)}) ÷ ${format(2 * a)}.`);
  steps.push(`Therefore, x₁ = ${format(first)} and x₂ = ${format(second)}.`);
  const roots = first === second ? [first] : [first, second];
  return { summary: roots.length === 1 ? `x = ${format(first)}` : `x = ${format(first)} or ${format(second)}`, steps, roots };
}