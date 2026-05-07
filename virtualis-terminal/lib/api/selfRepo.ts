import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MAX_LIST_LIMIT = 200;
const DEFAULT_LIST_LIMIT = 80;
const MAX_SEARCH_LIMIT = 50;
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_READ_LINES = 300;
const MAX_READ_CHARS = 20_000;

export interface SelfRepoListInput {
  prefix?: string;
  limit?: number;
}

export interface SelfRepoReadInput {
  path: string;
  startLine?: number;
  endLine?: number;
}

export interface SelfRepoSearchInput {
  query: string;
  pathPrefix?: string;
  limit?: number;
}

export interface SelfRepoFileSnippet {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  truncated: boolean;
  commit: string;
}

export interface SelfRepoSearchMatch {
  path: string;
  line: number;
  text: string;
}

function clampLimit(limit: number | undefined, fallback: number, max: number) {
  if (!limit) return fallback;
  return Math.min(Math.max(Math.floor(limit), 1), max);
}

function normalizeRepoPath(inputPath: string): string {
  if (inputPath.includes("\0")) {
    throw new Error("Repository path cannot contain NUL bytes.");
  }

  const normalized = path.posix.normalize(inputPath.replaceAll("\\", "/"));
  if (
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized === ".." ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error("Repository path must be relative to the repo root.");
  }

  return normalized;
}

function isDeniedPath(repoPath: string): boolean {
  const segments = repoPath.split("/");
  const basename = segments.at(-1) ?? "";

  return (
    basename.startsWith(".env") ||
    basename.endsWith(".db") ||
    segments.includes("sessions") ||
    repoPath.startsWith("virtualis-terminal/lib/generated/")
  );
}

function formatListMessage(
  files: string[],
  commit: string,
  truncated: boolean,
) {
  const suffix = truncated
    ? "\n\n[truncated: narrow prefix or increase later]"
    : "";
  return `Self repository at ${commit}:\n${files.join("\n")}${suffix}`;
}

function formatReadMessage(snippet: SelfRepoFileSnippet) {
  const suffix = snippet.truncated ? "\n\n[truncated]" : "";
  return `Read ${snippet.path}:${snippet.startLine}-${snippet.endLine} at ${snippet.commit}\n\n${snippet.content}${suffix}`;
}

function formatSearchMessage(
  matches: SelfRepoSearchMatch[],
  query: string,
  commit: string,
  truncated: boolean,
) {
  if (!matches.length) {
    return `No self-repository matches for "${query}" at ${commit}.`;
  }

  const rendered = matches
    .map((match) => `${match.path}:${match.line}: ${match.text}`)
    .join("\n");
  const suffix = truncated ? "\n\n[truncated: narrow path_prefix]" : "";
  return `Self-repository matches for "${query}" at ${commit}:\n${rendered}${suffix}`;
}

/**
 * Provides read-only access to the current deployed repository checkout.
 */
export class SelfRepoReader {
  private repoRoot: string | null = null;

  async currentCommit(): Promise<string> {
    const { stdout } = await this.gitText(["rev-parse", "HEAD"]);
    return stdout.trim();
  }

  /**
   * Lists readable repository files tracked at HEAD under an optional prefix.
   */
  async listFiles(input: SelfRepoListInput = {}) {
    const prefix = input.prefix ? normalizeRepoPath(input.prefix) : "";
    const limit = clampLimit(input.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const [commit, files] = await Promise.all([
      this.currentCommit(),
      this.trackedFiles(),
    ]);
    const filtered = files.filter((file) => !prefix || file.startsWith(prefix));
    const visible = filtered.slice(0, limit);

    return {
      success: true,
      message: formatListMessage(
        visible,
        commit,
        filtered.length > visible.length,
      ),
      data: {
        commit,
        files: visible,
        truncated: filtered.length > visible.length,
      },
    };
  }

  /**
   * Reads a tracked file through git at HEAD, returning a bounded line range.
   */
  async readFile(input: SelfRepoReadInput) {
    const repoPath = normalizeRepoPath(input.path);
    await this.assertReadableTrackedFile(repoPath);

    const commit = await this.currentCommit();
    const { stdout } = await this.gitText(["show", `HEAD:${repoPath}`], {
      maxBuffer: 2 * 1024 * 1024,
    });
    const lines = stdout.split(/\r?\n/);
    const requestedStart = input.startLine ?? 1;
    const requestedEnd = input.endLine ?? requestedStart + MAX_READ_LINES - 1;
    const startLine = Math.max(1, Math.floor(requestedStart));
    const endLine = Math.min(
      lines.length,
      Math.max(startLine, Math.floor(requestedEnd)),
      startLine + MAX_READ_LINES - 1,
    );
    const content = lines.slice(startLine - 1, endLine).join("\n");
    const truncated = endLine < lines.length || content.length > MAX_READ_CHARS;
    const snippet: SelfRepoFileSnippet = {
      path: repoPath,
      startLine,
      endLine,
      content: content.slice(0, MAX_READ_CHARS),
      truncated,
      commit,
    };

    return {
      success: true,
      message: formatReadMessage(snippet),
      data: snippet,
    };
  }

  /**
   * Searches readable files tracked at HEAD using literal git grep.
   */
  async search(input: SelfRepoSearchInput) {
    const query = input.query.trim();
    if (!query || query.includes("\0") || query.includes("\n")) {
      throw new Error("Search query must be a single non-empty line.");
    }

    const pathPrefix = input.pathPrefix
      ? normalizeRepoPath(input.pathPrefix)
      : "";
    const limit = clampLimit(
      input.limit,
      DEFAULT_SEARCH_LIMIT,
      MAX_SEARCH_LIMIT,
    );
    const [commit, files] = await Promise.all([
      this.currentCommit(),
      this.trackedFiles(),
    ]);
    const searchableFiles = files.filter(
      (file) => !pathPrefix || file.startsWith(pathPrefix),
    );

    if (!searchableFiles.length) {
      return {
        success: true,
        message: `No readable self-repository files under "${pathPrefix}".`,
        data: { commit, matches: [], truncated: false },
      };
    }

    const grepArgs = [
      "grep",
      "-n",
      "-I",
      "-F",
      "--",
      query,
      "HEAD",
      ...searchableFiles,
    ];

    let stdout = "";
    try {
      const result = await this.gitText(grepArgs, {
        maxBuffer: 2 * 1024 * 1024,
      });
      stdout = result.stdout;
    } catch (error) {
      if (this.isGitNoMatch(error)) {
        return {
          success: true,
          message: formatSearchMessage([], query, commit, false),
          data: { commit, matches: [], truncated: false },
        };
      }

      throw error;
    }

    const allMatches = stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const normalizedLine = line.startsWith("HEAD:")
          ? line.slice("HEAD:".length)
          : line;
        const firstColon = normalizedLine.indexOf(":");
        const secondColon = normalizedLine.indexOf(":", firstColon + 1);
        return {
          path: normalizedLine.slice(0, firstColon),
          line: Number(normalizedLine.slice(firstColon + 1, secondColon)),
          text: normalizedLine.slice(secondColon + 1),
        };
      });
    const matches = allMatches.slice(0, limit);

    return {
      success: true,
      message: formatSearchMessage(
        matches,
        query,
        commit,
        allMatches.length > matches.length,
      ),
      data: {
        commit,
        matches,
        truncated: allMatches.length > matches.length,
      },
    };
  }

  private async trackedFiles(): Promise<string[]> {
    const { stdout } = await this.gitBuffer(
      ["ls-tree", "-r", "-z", "--name-only", "HEAD"],
      {
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    return stdout
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .filter((file) => !isDeniedPath(file));
  }

  private async assertReadableTrackedFile(repoPath: string): Promise<void> {
    const files = await this.trackedFiles();
    if (!files.includes(repoPath)) {
      throw new Error(`Path is not a readable tracked file: ${repoPath}`);
    }
  }

  private async gitText(
    args: string[],
    options: { maxBuffer?: number } = {},
  ): Promise<{ stdout: string; stderr: string }> {
    const cwd = await this.getRepoRoot();
    return (await execFileAsync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      maxBuffer: options.maxBuffer ?? 1024 * 1024,
    })) as { stdout: string; stderr: string };
  }

  private async gitBuffer(
    args: string[],
    options: { maxBuffer?: number } = {},
  ): Promise<{ stdout: Buffer; stderr: Buffer }> {
    const cwd = await this.getRepoRoot();
    return (await execFileAsync("git", ["-C", cwd, ...args], {
      encoding: "buffer",
      maxBuffer: options.maxBuffer ?? 1024 * 1024,
    })) as { stdout: Buffer; stderr: Buffer };
  }

  private async getRepoRoot(): Promise<string> {
    if (this.repoRoot) return this.repoRoot;

    const { stdout } = await execFileAsync(
      "git",
      ["-C", process.cwd(), "rev-parse", "--show-toplevel"],
      { encoding: "utf8" },
    );
    this.repoRoot = stdout.trim();
    return this.repoRoot;
  }

  private isGitNoMatch(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 1
    );
  }
}

export const selfRepoReader = new SelfRepoReader();
