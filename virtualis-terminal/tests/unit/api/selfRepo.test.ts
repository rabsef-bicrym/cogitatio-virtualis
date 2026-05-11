import { describe, expect, it } from "vitest";
import { SelfRepoReader } from "@/lib/api/selfRepo";

describe("SelfRepoReader", () => {
  it("reads bounded snippets from tracked repository files", async () => {
    const reader = new SelfRepoReader();

    const result = await reader.readFile({
      path: "virtualis-terminal/pages/index.tsx",
      startLine: 1,
      endLine: 8,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      path: "virtualis-terminal/pages/index.tsx",
      startLine: 1,
      endLine: 8,
      truncated: true,
    });
    expect(result.message).toContain("virtualis-terminal/pages/index.tsx:1-8");
    expect(result.message).toContain("import");
  });

  it("searches readable tracked files with literal queries", async () => {
    const reader = new SelfRepoReader();

    const result = await reader.search({
      query: "MobileDenial",
      pathPrefix: "virtualis-terminal/components",
      limit: 5,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      truncated: expect.any(Boolean),
    });
    expect(result.message).toContain("MobileDenial");
    expect(result.message).toContain("virtualis-terminal/components");
  });

  it("rejects traversal and denied runtime files", async () => {
    const reader = new SelfRepoReader();

    await expect(
      reader.readFile({ path: "../virtualis-terminal/package.json" }),
    ).rejects.toThrow("Repository path must be relative");

    await expect(
      reader.readFile({ path: "virtualis-terminal/.env.example" }),
    ).rejects.toThrow("Path is not a readable tracked file");
  });
});
