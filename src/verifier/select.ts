import type { ChangeSet } from "../core/types/index.js";

import { TypeCheckVerifier, isTypeScriptFile } from "./typecheck.js";
import type { Verifier } from "./verifier.js";

export function selectVerifiers(changeSet: ChangeSet): Verifier[] {
  const verifiers: Verifier[] = [];

  const touchesTypeScript = changeSet.files.some((file) =>
    isTypeScriptFile(file.path, file.language),
  );

  if (touchesTypeScript) {
    verifiers.push(new TypeCheckVerifier());
  }

  return verifiers;
}
