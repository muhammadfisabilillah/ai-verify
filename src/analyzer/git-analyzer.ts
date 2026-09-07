import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import type {
  AnalysisRequest,
  ChangeSet,
  FileChange,
} from "../core/types/index.js";

import type { Analyzer } from "./analyzer.js";
import { detectLanguage } from "./language.js";

const execFileAsync = promisify(execFile);

type GitChangeStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed";

interface GitChange {
  path: string;
  changeType: GitChangeStatus;
}

export class GitAnalyzer implements Analyzer {
  async analyze(request: AnalysisRequest): Promise<ChangeSet> {
    const repositoryPath = path.resolve(request.repositoryPath);

    await this.assertGitRepository(repositoryPath);

    const changes = await this.getGitChanges(
      repositoryPath,
      request.includeUncommittedChanges,
    );

    const files: FileChange[] = [];

    for (const change of changes) {
      const fileChange = await this.createFileChange(
        repositoryPath,
        change,
      );

      files.push(fileChange);
    }

    return {
      files,
      totalAdditions: files.reduce(
        (total, file) => total + file.additions,
        0,
      ),
      totalDeletions: files.reduce(
        (total, file) => total + file.deletions,
        0,
      ),
    };
  }

  private async assertGitRepository(
    repositoryPath: string,
  ): Promise<void> {
    try {
      await execFileAsync(
        "git",
        ["rev-parse", "--is-inside-work-tree"],
        {
          cwd: repositoryPath,
        },
      );
    } catch {
      throw new Error(
        `The target directory is not a Git repository: ${repositoryPath}`,
      );
    }
  }

  private async getGitChanges(
    repositoryPath: string,
    includeUncommittedChanges: boolean,
  ): Promise<GitChange[]> {
    const args = includeUncommittedChanges
      ? ["diff", "HEAD", "--name-status", "-M"]
      : ["diff", "HEAD~1", "HEAD", "--name-status", "-M"];

    const { stdout } = await execFileAsync("git", args, {
      cwd: repositoryPath,
    });

    const changes = this.parseNameStatus(stdout);

    if (!includeUncommittedChanges) {
      return changes;
    }

    const untrackedFiles = await this.getUntrackedFiles(repositoryPath);

    return [
      ...changes,
      ...untrackedFiles.map((filePath) => ({
        path: filePath,
        changeType: "added" as const,
      })),
    ];
  }

  private parseNameStatus(output: string): GitChange[] {
    if (!output.trim()) {
      return [];
    }

    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => this.parseNameStatusLine(line));
  }

  private parseNameStatusLine(line: string): GitChange[] {
    const parts = line.split("\t");

    if (parts.length < 2) {
      return [];
    }

    const status = parts[0];
    const firstPath = parts[1];

    if (!status || !firstPath) {
      return [];
    }

    const statusCode = status[0];

    switch (statusCode) {
      case "A":
        return [
          {
            path: firstPath,
            changeType: "added",
          },
        ];

      case "M":
        return [
          {
            path: firstPath,
            changeType: "modified",
          },
        ];

      case "D":
        return [
          {
            path: firstPath,
            changeType: "deleted",
          },
        ];

      case "R": {
        const newPath = parts[2];

        if (!newPath) {
          return [];
        }

        return [
          {
            path: newPath,
            changeType: "renamed",
          },
        ];
      }

      default:
        return [];
    }
  }

  private async getUntrackedFiles(
    repositoryPath: string,
  ): Promise<string[]> {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "--others", "--exclude-standard"],
      {
        cwd: repositoryPath,
      },
    );

    if (!stdout.trim()) {
      return [];
    }

    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private async createFileChange(
    repositoryPath: string,
    change: GitChange,
  ): Promise<FileChange> {
    const stats = await this.getFileStats(
      repositoryPath,
      change,
    );

    const language = detectLanguage(change.path);

    const fileChange: FileChange = {
      path: change.path,
      changeType: change.changeType,
      additions: stats.additions,
      deletions: stats.deletions,
      source: "unknown",
    };

    if (language !== undefined) {
      fileChange.language = language;
    }

    return fileChange;
  }

  private async getFileStats(
    repositoryPath: string,
    change: GitChange,
  ): Promise<{
    additions: number;
    deletions: number;
  }> {
    if (change.changeType === "added") {
      const isTracked = await this.isTrackedFile(
        repositoryPath,
        change.path,
      );

      if (!isTracked) {
        return this.countUntrackedFileLines(
          repositoryPath,
          change.path,
        );
      }
    }

    try {
      const { stdout } = await execFileAsync(
        "git",
        ["diff", "HEAD", "--numstat", "-M", "--", change.path],
        {
          cwd: repositoryPath,
        },
      );

      const line = stdout
        .split("\n")
        .map((value) => value.trim())
        .find(Boolean);

      if (!line) {
        return {
          additions: 0,
          deletions: 0,
        };
      }

      const parts = line.split("\t");

      return {
        additions: this.parseStat(parts[0]),
        deletions: this.parseStat(parts[1]),
      };
    } catch {
      return {
        additions: 0,
        deletions: 0,
      };
    }
  }

  private async isTrackedFile(
    repositoryPath: string,
    filePath: string,
  ): Promise<boolean> {
    try {
      await execFileAsync(
        "git",
        ["ls-files", "--error-unmatch", "--", filePath],
        {
          cwd: repositoryPath,
        },
      );

      return true;
    } catch {
      return false;
    }
  }

  private async countUntrackedFileLines(
    repositoryPath: string,
    filePath: string,
  ): Promise<{
    additions: number;
    deletions: number;
  }> {
    try {
      const absolutePath = path.join(repositoryPath, filePath);

      const { stdout } = await execFileAsync(
        "wc",
        ["-l", absolutePath],
      );

      const lineCount = Number.parseInt(
        stdout.trim().split(/\s+/)[0] ?? "0",
        10,
      );

      return {
        additions: Number.isNaN(lineCount) ? 0 : lineCount,
        deletions: 0,
      };
    } catch {
      return {
        additions: 0,
        deletions: 0,
      };
    }
  }

  private parseStat(value: string | undefined): number {
    if (!value || value === "-") {
      return 0;
    }

    const parsed = Number.parseInt(value, 10);

    return Number.isNaN(parsed) ? 0 : parsed;
  }
}
