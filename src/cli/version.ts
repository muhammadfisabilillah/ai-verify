import { createRequire } from "node:module";

export function getVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../../package.json") as { version?: unknown };

    return typeof pkg.version === "string" ? pkg.version : "unknown";
  } catch {
    return "unknown";
  }
}
