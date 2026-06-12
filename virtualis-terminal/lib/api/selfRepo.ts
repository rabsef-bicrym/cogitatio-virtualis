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
const MAX_LOG_LIMIT = 30;
const DEFAULT_LOG_LIMIT = 10;

const GITHUB_REPO =
  process.env.SELF_REPO_GITHUB ?? "rabsef-bicrym/cogitatio-virtualis";
const GITHUB_API = "https://api.github.com";
const GITHUB_RAW = "https://raw.githubusercontent.com";

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

export interface SelfRepoLogInput {
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

export interface SelfRepoCommit {
  sha: string;
  date: string;
  subject: string;
}

export interface SelfRepoResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/** Read-only view of the deployed repository, however it is sourced. */
export interface SelfRepoSource {
  currentCommit(): Promise<string>;
  listFiles(input?: SelfRepoListInput): Promise<SelfRepoResult>;
  readFile(input: SelfRepoReadInput): Promise<SelfRepoResult>;
  search(input: SelfRepoSearchInput): Promise<SelfRepoResult>;
  recentCommits(input?: SelfRepoLogInput): Promise<SelfRepoResult>;
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

function formatLogMessage(commits: SelfRepoCommit[]) {
  const rendered = commits
    .map((c) => `${c.sha.slice(0, 8)}  ${c.date.slice(0, 10)}  ${c.subject}`)
    .join("\n");
  return `Recent commits to the self repository:\n${rendered}`;
}

function snippetFromContent(
  repoPath: string,
  raw: string,
  commit: string,
  input: SelfRepoReadInput,
): SelfRepoFileSnippet {
  const lines = raw.split(/\r?\n/);
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

  return {
    path: repoPath,
    startLine,
    endLine,
    content: content.slice(0, MAX_READ_CHARS),
    truncated,
    commit,
  };
}

/**
 * Reads the repository through a local git checkout. Used in development,
 * where the working tree and .git directory exist.
 */
export class GitSelfRepoReader implements SelfRepoSource {
  private repoRoot: string | null = null;

  async currentCommit(): Promise<string> {
    const { stdout } = await this.gitText(["rev-parse", "HEAD"]);
    return stdout.trim();
  }

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

  async readFile(input: SelfRepoReadInput) {
    const repoPath = normalizeRepoPath(input.path);
    await this.assertReadableTrackedFile(repoPath);

    const commit = await this.currentCommit();
    const { stdout } = await this.gitText(["show", `HEAD:${repoPath}`], {
      maxBuffer: 2 * 1024 * 1024,
    });
    const snippet = snippetFromContent(repoPath, stdout, commit, input);

    return {
      success: true,
      message: formatReadMessage(snippet),
      data: snippet,
    };
  }

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

  async recentCommits(input: SelfRepoLogInput = {}) {
    const limit = clampLimit(input.limit, DEFAULT_LOG_LIMIT, MAX_LOG_LIMIT);
    const { stdout } = await this.gitText([
      "log",
      `-n${limit}`,
      "--pretty=format:%H%x00%cI%x00%s",
    ]);
    const commits: SelfRepoCommit[] = stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [sha, date, subject] = line.split("\0");
        return { sha, date, subject };
      });

    return {
      success: true,
      message: formatLogMessage(commits),
      data: { commits },
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

/**
 * Reads the repository through the public GitHub API. Used on Vercel, where
 * the serverless bundle has no .git directory or working tree. The deployed
 * commit comes from VERCEL_GIT_COMMIT_SHA so answers match the running code.
 */
export class GitHubSelfRepoReader implements SelfRepoSource {
  private commitSha: string | null = null;
  private treeCache: { sha: string; files: string[] } | null = null;

  async currentCommit(): Promise<string> {
    if (this.commitSha) return this.commitSha;

    const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA;
    if (fromEnv) {
      this.commitSha = fromEnv;
      return fromEnv;
    }

    const data = await this.githubJson<{ sha: string }>(
      `/repos/${GITHUB_REPO}/commits/HEAD`,
    );
    this.commitSha = data.sha;
    return data.sha;
  }

  async listFiles(input: SelfRepoListInput = {}) {
    const prefix = input.prefix ? normalizeRepoPath(input.prefix) : "";
    const limit = clampLimit(input.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const commit = await this.currentCommit();
    const files = await this.trackedFiles(commit);
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

  async readFile(input: SelfRepoReadInput) {
    const repoPath = normalizeRepoPath(input.path);
    const commit = await this.currentCommit();
    const files = await this.trackedFiles(commit);
    if (!files.includes(repoPath)) {
      throw new Error(`Path is not a readable tracked file: ${repoPath}`);
    }

    const response = await fetch(
      `${GITHUB_RAW}/${GITHUB_REPO}/${commit}/${repoPath}`,
    );
    if (!response.ok) {
      throw new Error(`Failed to read ${repoPath} (${response.status})`);
    }
    const raw = await response.text();
    const snippet = snippetFromContent(repoPath, raw, commit, input);

    return {
      success: true,
      message: formatReadMessage(snippet),
      data: snippet,
    };
  }

  /**
   * Searches by fetching candidate files and grepping locally. Bounded to a
   * small candidate set so a single tool call cannot fan out across the repo.
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
    const commit = await this.currentCommit();
    const files = await this.trackedFiles(commit);
    const candidates = files.filter(
      (file) => !pathPrefix || file.startsWith(pathPrefix),
    );

    const MAX_FETCHED_FILES = 40;
    if (candidates.length > MAX_FETCHED_FILES) {
      return {
        success: true,
        message:
          `Search scope is too broad (${candidates.length} files). ` +
          `Provide a path_prefix that narrows to at most ${MAX_FETCHED_FILES} files; ` +
          `use self_repo_list_files to explore the tree first.`,
        data: { commit, matches: [], truncated: true },
      };
    }

    const allMatches: SelfRepoSearchMatch[] = [];
    for (const file of candidates) {
      const response = await fetch(
        `${GITHUB_RAW}/${GITHUB_REPO}/${commit}/${file}`,
      );
      if (!response.ok) continue;
      const text = await response.text();
      if (text.includes("\0")) continue; // skip binary-ish content
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(query)) {
          allMatches.push({ path: file, line: i + 1, text: lines[i] });
        }
      }
      if (allMatches.length >= limit * 3) break;
    }
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

  async recentCommits(input: SelfRepoLogInput = {}) {
    const limit = clampLimit(input.limit, DEFAULT_LOG_LIMIT, MAX_LOG_LIMIT);
    const data = await this.githubJson<
      {
        sha: string;
        commit: { committer: { date: string }; message: string };
      }[]
    >(`/repos/${GITHUB_REPO}/commits?per_page=${limit}`);
    const commits: SelfRepoCommit[] = data.map((entry) => ({
      sha: entry.sha,
      date: entry.commit.committer.date,
      subject: entry.commit.message.split("\n")[0],
    }));

    return {
      success: true,
      message: formatLogMessage(commits),
      data: { commits },
    };
  }

  private async trackedFiles(commit: string): Promise<string[]> {
    if (this.treeCache?.sha === commit) return this.treeCache.files;

    const data = await this.githubJson<{
      tree: { path: string; type: string }[];
      truncated: boolean;
    }>(`/repos/${GITHUB_REPO}/git/trees/${commit}?recursive=1`);
    const files = data.tree
      .filter((entry) => entry.type === "blob")
      .map((entry) => entry.path)
      .filter((file) => !isDeniedPath(file));
    this.treeCache = { sha: commit, files };
    return files;
  }

  private async githubJson<T>(apiPath: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "cogitatio-virtualis",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(`${GITHUB_API}${apiPath}`, { headers });
    if (!response.ok) {
      const hint =
        response.status === 403 && !process.env.GITHUB_TOKEN
          ? " (unauthenticated GitHub rate limit; set GITHUB_TOKEN)"
          : "";
      throw new Error(
        `GitHub API request failed (${response.status}) for ${apiPath}${hint}`,
      );
    }
    return (await response.json()) as T;
  }
}

function createSelfRepoReader(): SelfRepoSource {
  const mode = process.env.SELF_REPO_SOURCE;
  if (mode === "github") return new GitHubSelfRepoReader();
  if (mode === "git") return new GitSelfRepoReader();
  // Vercel bundles carry no .git directory; default by environment.
  return process.env.VERCEL
    ? new GitHubSelfRepoReader()
    : new GitSelfRepoReader();
}

export const selfRepoReader: SelfRepoSource = createSelfRepoReader();
