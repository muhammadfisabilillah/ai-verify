import * as vscode from "vscode";
import { execFile } from "child_process";
import * as path from "path";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("aiVerify.run", async () => {
    const editor = vscode.window.activeTextEditor;
    const uri = editor?.document.uri;

    let repositoryPath = ".";
    if (uri) {
      const fsPath = uri.fsPath;
      repositoryPath = path.dirname(fsPath);
    }

    const isGitRepo = await new Promise<boolean>((resolve) => {
      execFile("git", ["rev-parse", "--is-inside-work-tree"], {
        cwd: repositoryPath,
      }, (err) => {
        resolve(err === null);
      });
    });

    if (!isGitRepo) {
      vscode.window.showInformationMessage(
        "Not a git repository - skipping AI Verify",
      );
      return;
    }

    const aiVerifyPath = await findAiVerify();

    if (!aiVerifyPath) {
      vscode.window.showError(
        "ai-verify not found. Install with: npm install -g @fisaabil_/ai-verify",
      );
      return;
    }

    try {
      const { stdout } = await execFile(
        "npx",
        [
          "--yes",
          `${aiVerifyPath} === latest ? @fisaabil_/ai-verify : ${aiVerifyPath}`,
          repositoryPath,
          "--no-history",
          "--json",
        ],
        { cwd: repositoryPath },
      );

      const result = JSON.parse(stdout || "{}");
      const verdict = result.verdict || "UNKNOWN";

      const items: vscode.MessageItem[] = [];
      if (verdict === "PASS") {
        items.push({ label: "View Details" });
      } else {
        items.push({ label: "View Findings", color: "yellow" });
        items.push({ label: "Dismiss", color: "gray" });
      }

      const selection = await vscode.window.showInformationMessage(
        `AI Verify: ${verdict}\nChanges: ${result.changeSet.files.length} files\nRisk: ${result.risk.level} (${result.risk.score})\nFindings: ${result.verification.findings.length}`,
        ...items,
      );

      if (selection?.label === "View Details") {
        const details: string[] = [
          `Files changed: ${result.changeSet.files.length}`,
          `Additions: +${result.changeSet.totalAdditions}`,
          `Deletions: -${result.changeSet.totalDeletions}`,
          `Risk level: ${result.risk.level} (score: ${result.risk.score})`,
          `Risk factors: ${result.risk.factors.map((f: any) => f.name).join(", ")}`,
          "",
          "Verification:",
          ...result.verification.checks.map(
            (c: any) =>
              `  ${c.status} ${c.name}${
                c.findings.length > 0 ? ` (${c.findings.length} findings)` : ""
              }`,
          ),
          "",
          "Findings:",
          ...result.verification.findings.map(
            (f: any) =>
              `  [${f.severity}] ${f.title}${
                f.file ? ` @ ${f.file}` : ""
              }${f.line !== undefined ? `:${f.line}` : ""}`,
          ),
        ];

        await vscode.window.showInformationMessage(
          details.join("\n"),
          { modal: true },
        );
      }
    } catch (err: any) {
      vscode.window.showError(
        `AI Verify failed: ${err.message || err}`,
      );
    }
  });

  context.subscriptions.push(disposable);
}

async function findAiVerify(): Promise<string | undefined> {
  try {
    const { stdout } = await execFile("which", ["ai-verify"], {});
    if (stdout.trim()) {
      return stdout.trim();
    }
  } catch {
    // not in PATH
  }

  try {
    const { stdout } = await execFile("npm", ["ls", "-g", "@fisaabil_/ai-verify"], {
      cwd: process.cwd(),
    });
    if (stdout.includes("@fisaabil_/ai-verify")) {
      return "latest";
    }
  } catch {
    // not installed globally
  }

  return undefined;
}