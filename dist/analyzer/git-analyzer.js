import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { detectLanguage } from "./language.js";
const execFileAsync = promisify(execFile);
export class GitAnalyzer {
    async analyze(request) {
        const repositoryPath = path.resolve(request.repositoryPath);
        const args = this.buildDiffArgs(request.includeUncommittedChanges);
        const { stdout } = await execFileAsync("git", args, {
            cwd: repositoryPath,
        });
        const files = this.parseNumstat(stdout);
        return {
            files,
            totalAdditions: files.reduce((total, file) => total + file.additions, 0),
            totalDeletions: files.reduce((total, file) => total + file.deletions, 0),
        };
    }
    buildDiffArgs(includeUncommittedChanges) {
        if (includeUncommittedChanges) {
            return ["diff", "HEAD", "--numstat"];
        }
        return ["diff", "HEAD~1", "HEAD", "--numstat"];
    }
    parseNumstat(output) {
        if (!output.trim()) {
            return [];
        }
        return output
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .flatMap((line) => this.parseLine(line));
    }
    parseLine(line) {
        const parts = line.split("\t");
        if (parts.length < 3) {
            return [];
        }
        const [additionsRaw, deletionsRaw, filePath] = parts;
        if (!filePath) {
            return [];
        }
        const additions = this.parseStat(additionsRaw);
        const deletions = this.parseStat(deletionsRaw);
        const language = detectLanguage(filePath);
        const fileChange = {
            path: filePath,
            changeType: "modified",
            additions,
            deletions,
            source: "unknown",
        };
        if (language !== undefined) {
            fileChange.language = language;
        }
        return [fileChange];
    }
    parseStat(value) {
        if (!value || value === "-") {
            return 0;
        }
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
}
//# sourceMappingURL=git-analyzer.js.map