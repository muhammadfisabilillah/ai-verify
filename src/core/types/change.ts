export type ChangeType =
  | "added"
  | "modified"
  | "deleted"
  | "renamed";

export type ChangeSource =
  | "human"
  | "ai"
  | "mixed"
  | "unknown";

export interface FileChange {
  path: string;
  changeType: ChangeType;
  additions: number;
  deletions: number;
  source: ChangeSource;
  language?: string;
}

export interface ChangeSet {
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
}
