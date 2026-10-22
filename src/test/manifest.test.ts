import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("PWABuilder Manifest configuration", () => {
  it("has valid manifest.webmanifest with requested package, version code, and app name", () => {
    const manifestPath = path.resolve(process.cwd(), "public/manifest.webmanifest");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);

    expect(manifest.name).toBe("Nume: Scientific Calculator Pro");
    expect(manifest.package_name).toBe("scientific.calculator.cm");
    expect(manifest.id).toBe("scientific.calculator.cm");
    expect(manifest.version_code).toBe(9);
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  it("mirrors configuration in public/manifest.json for fallback compatibility", () => {
    const jsonPath = path.resolve(process.cwd(), "public/manifest.json");
    expect(fs.existsSync(jsonPath)).toBe(true);

    const raw = fs.readFileSync(jsonPath, "utf-8");
    const manifest = JSON.parse(raw);

    expect(manifest.name).toBe("Nume: Scientific Calculator Pro");
    expect(manifest.package_name).toBe("scientific.calculator.cm");
    expect(manifest.version_code).toBe(9);
  });
});
