import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Web App Manifest", () => {
  it("has version_code set to 9", () => {
    const manifestPath = path.resolve(process.cwd(), "public/manifest.webmanifest");
    const content = fs.readFileSync(manifestPath, "utf-8");
    const json = JSON.parse(content);
    expect(json.version_code).toBe(9);
    expect(json.version).toBe("1.0.9");
  });
});
