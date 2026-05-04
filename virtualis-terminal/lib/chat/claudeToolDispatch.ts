import { z } from "zod";
import {
  hardCommandOperations,
  type HardCommandOperations,
  type HardCommandResponse,
} from "@/lib/chat/hardCommands";
import type { ToolUseBlock } from "@/lib/chat/messageCodec";
import { DocumentType, OtherSubType, ProjectSubType } from "@/types/documents";

const docIdInput = z.object({
  doc_id: z.string().min(1),
});

const docsInput = z.object({
  doc_type: z.enum([
    DocumentType.EXPERIENCE,
    DocumentType.EDUCATION,
    DocumentType.PROJECT,
    DocumentType.OTHER,
  ]),
});

const projectInput = z.discriminatedUnion("subcommand", [
  z.object({
    subcommand: z.literal("list"),
  }),
  z.object({
    subcommand: z.literal("active"),
  }),
  z.object({
    subcommand: z.literal("type"),
    subtype: z.enum([
      ProjectSubType.PRODUCT,
      ProjectSubType.PROCESS,
      ProjectSubType.INFRASTRUCTURE,
      ProjectSubType.SELF_REFERENTIAL,
    ]),
  }),
]);

const experienceInput = z.object({
  subcommand: z.enum(["list", "years", "skills"]).optional(),
});

const otherInput = z.object({
  subtype: z.enum([
    OtherSubType.COVER_LETTER,
    OtherSubType.PUBLICATION_SPEAKING,
    OtherSubType.RECOMMENDATION,
    OtherSubType.THOUGHT_LEADERSHIP,
  ]),
});

const searchInput = z.object({
  embedding_type: z.enum(["none", "query", "document"]),
  query: z.string().min(1),
});

function invalidToolInput(toolUse: ToolUseBlock, error: unknown): never {
  if (error instanceof z.ZodError) {
    const issueSummary = error.issues
      .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid input for ${toolUse.name}: ${issueSummary}`);
  }

  throw error;
}

/**
 * Dispatches Claude tool inputs directly to typed command handlers.
 */
export async function dispatchClaudeToolUse(
  toolUse: ToolUseBlock,
  operations: HardCommandOperations = hardCommandOperations,
): Promise<HardCommandResponse | null> {
  try {
    switch (toolUse.name) {
      case "doc_id_command": {
        const input = docIdInput.parse(toolUse.input);
        return await operations.runDocIdCommand({
          docId: input.doc_id,
          secret: true,
        });
      }

      case "docs_command": {
        const input = docsInput.parse(toolUse.input);
        return await operations.runDocsCommand({
          docType: input.doc_type,
          secret: true,
        });
      }

      case "project_command": {
        const input = projectInput.parse(toolUse.input);
        return await operations.runProjectCommand(input);
      }

      case "experience_command": {
        const input = experienceInput.parse(toolUse.input);
        return await operations.runExperienceCommand(input);
      }

      case "other_command": {
        const input = otherInput.parse(toolUse.input);
        return await operations.runOtherCommand({
          subtype: input.subtype,
        });
      }

      case "search_vector_database": {
        const input = searchInput.parse(toolUse.input);
        return await operations.runSearchCommand({
          embeddingType: input.embedding_type,
          query: input.query,
        });
      }

      case "status_command":
        return await operations.runStatusCommand();

      default:
        return null;
    }
  } catch (error: unknown) {
    invalidToolInput(toolUse, error);
  }
}
