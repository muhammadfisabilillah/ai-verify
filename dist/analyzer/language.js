import path from "node:path";
const LANGUAGE_MAP = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".php": "php",
    ".rb": "ruby",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".c": "c",
    ".swift": "swift",
    ".kt": "kotlin",
};
export function detectLanguage(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    return LANGUAGE_MAP[extension];
}
//# sourceMappingURL=language.js.map