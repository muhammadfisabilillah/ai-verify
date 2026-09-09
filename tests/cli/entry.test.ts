import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { isEntryModule } from "../../src/cli/index.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("isEntryModule", () => {
  it("matches direct invocation", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ai-verify-entry-"));
    tempDirs.push(dir);
    const target = path.join(dir, "cli.js");
    writeFileSync(target, "export {};\n");

    expect(isEntryModule(target, pathToFileURL(target).href)).toBe(true);
  });

  it("matches invocation through a symlink (npm .bin, npx, global install)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ai-verify-entry-"));
    tempDirs.push(dir);
    const target = path.join(dir, "cli.js");
    const link = path.join(dir, "ai-verify");
    writeFileSync(target, "export {};\n");
    symlinkSync(target, link);

    expect(isEntryModule(link, pathToFileURL(target).href)).toBe(true);
  });

  it("rejects other modules, missing paths, and undefined argv", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ai-verify-entry-"));
    tempDirs.push(dir);
    const target = path.join(dir, "cli.js");
    const other = path.join(dir, "other.js");
    writeFileSync(target, "export {};\n");
    writeFileSync(other, "export {};\n");

    expect(isEntryModule(other, pathToFileURL(target).href)).toBe(false);
    expect(
      isEntryModule(
        path.join(dir, "does-not-exist.js"),
        pathToFileURL(target).href,
      ),
    ).toBe(false);
    expect(isEntryModule(undefined, pathToFileURL(target).href)).toBe(false);
  });
});
