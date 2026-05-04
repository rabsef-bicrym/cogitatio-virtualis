import { describe, expect, it, vi } from "vitest";
import { dispatchClaudeToolUse } from "@/lib/chat/claudeToolDispatch";
import type {
  HardCommandOperations,
  HardCommandResponse,
} from "@/lib/chat/hardCommands";
import type { ToolUseBlock } from "@/lib/chat/messageCodec";
import { DocumentType, ProjectSubType, OtherSubType } from "@/types/documents";

function toolUse(
  name: string,
  input: Record<string, unknown> = {},
): ToolUseBlock {
  return {
    type: "tool_use",
    id: `toolu_${name}`,
    name,
    input,
  };
}

function ok(message = "ok"): Promise<HardCommandResponse> {
  return Promise.resolve({ success: true, message });
}

function operations(): HardCommandOperations {
  return {
    runDocIdCommand: vi.fn(() => ok()),
    runDocsCommand: vi.fn(() => ok()),
    runProjectCommand: vi.fn(() => ok()),
    runExperienceCommand: vi.fn(() => ok()),
    runSearchCommand: vi.fn(() => ok()),
    runOtherCommand: vi.fn(() => ok()),
    runStatusCommand: vi.fn(() => ok()),
  };
}

describe("dispatchClaudeToolUse", () => {
  it("dispatches docs tool input directly to the typed docs handler", async () => {
    const commandOperations = operations();

    await dispatchClaudeToolUse(
      toolUse("docs_command", { doc_type: DocumentType.EXPERIENCE }),
      commandOperations,
    );

    expect(commandOperations.runDocsCommand).toHaveBeenCalledWith({
      docType: DocumentType.EXPERIENCE,
      secret: true,
    });
  });

  it("dispatches project type input without building slash command text", async () => {
    const commandOperations = operations();

    await dispatchClaudeToolUse(
      toolUse("project_command", {
        subcommand: "type",
        subtype: ProjectSubType.PRODUCT,
      }),
      commandOperations,
    );

    expect(commandOperations.runProjectCommand).toHaveBeenCalledWith({
      subcommand: "type",
      subtype: ProjectSubType.PRODUCT,
    });
  });

  it("preserves search query text as typed handler input", async () => {
    const commandOperations = operations();

    await dispatchClaudeToolUse(
      toolUse("search_vector_database", {
        embedding_type: "query",
        query: "terminal status",
      }),
      commandOperations,
    );

    expect(commandOperations.runSearchCommand).toHaveBeenCalledWith({
      embeddingType: "query",
      query: "terminal status",
    });
  });

  it("dispatches other document subtype input", async () => {
    const commandOperations = operations();

    await dispatchClaudeToolUse(
      toolUse("other_command", {
        subtype: OtherSubType.RECOMMENDATION,
      }),
      commandOperations,
    );

    expect(commandOperations.runOtherCommand).toHaveBeenCalledWith({
      subtype: OtherSubType.RECOMMENDATION,
    });
  });

  it("returns null for unknown tools", async () => {
    await expect(
      dispatchClaudeToolUse(toolUse("unknown_tool"), operations()),
    ).resolves.toBeNull();
  });

  it("rejects invalid Claude tool input before command execution", async () => {
    await expect(
      dispatchClaudeToolUse(toolUse("docs_command"), operations()),
    ).rejects.toThrow("Invalid input for docs_command");
  });
});
