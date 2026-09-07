import type { ChangeSet, VerificationCheck } from "../core/types/index.js";

export interface VerifierContext {
  repositoryPath: string;
  changeSet: ChangeSet;
}

export interface Verifier {
  readonly id: string;
  readonly name: string;
  run(context: VerifierContext): Promise<VerificationCheck>;
}
