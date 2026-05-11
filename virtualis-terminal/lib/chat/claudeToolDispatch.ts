import { z } from "zod";
import {
  hardCommandOperations,
  type HardCommandOperations,
  type HardCommandResponse,
} from "@/lib/chat/hardCommands";
import { selfRepoReader } from "@/lib/api/selfRepo";
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

const selfRepoListInput = z.object({
  prefix: z.string().min(1).optional(),
  limit: z.number().int().positive().optional(),
});

const selfRepoReadInput = z.object({
  path: z.string().min(1),
  start_line: z.number().int().positive().optional(),
  end_line: z.number().int().positive().optional(),
});

const selfRepoSearchInput = z.object({
  query: z.string().min(1),
  path_prefix: z.string().min(1).optional(),
  limit: z.number().int().positive().optional(),
});

export interface ClaudeToolOperations extends HardCommandOperations {
  runSelfRepoCurrentCommit(): Promise<HardCommandResponse>;
  runSelfRepoList(input: {
    prefix?: string;
    limit?: number;
  }): Promise<HardCommandResponse>;
  runSelfRepoReadFile(input: {
    path: string;
    startLine?: number;
    endLine?: number;
  }): Promise<HardCommandResponse>;
  runSelfRepoSearch(input: {
    query: string;
    pathPrefix?: string;
    limit?: number;
  }): Promise<HardCommandResponse>;
}

export const claudeToolOperations: ClaudeToolOperations = {
  ...hardCommandOperations,
  async runSelfRepoCurrentCommit() {
    const commit = await selfRepoReader.currentCommit();
    return {
      success: true,
      message: `Self repository HEAD is ${commit}.`,
      data: { commit },
    };
  },
  runSelfRepoList: (input) => selfRepoReader.listFiles(input),
  runSelfRepoReadFile: (input) => selfRepoReader.readFile(input),
  runSelfRepoSearch: (input) => selfRepoReader.search(input),
};

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
  operations: ClaudeToolOperations = claudeToolOperations,
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

      case "self_repo_current_commit":
        return await operations.runSelfRepoCurrentCommit();

      case "self_repo_list_files": {
        const input = selfRepoListInput.parse(toolUse.input);
        return await operations.runSelfRepoList(input);
      }

      case "self_repo_read_file": {
        const input = selfRepoReadInput.parse(toolUse.input);
        return await operations.runSelfRepoReadFile({
          path: input.path,
          startLine: input.start_line,
          endLine: input.end_line,
        });
      }

      case "self_repo_search": {
        const input = selfRepoSearchInput.parse(toolUse.input);
        return await operations.runSelfRepoSearch({
          query: input.query,
          pathPrefix: input.path_prefix,
          limit: input.limit,
        });
      }

      default:
        return null;
    }
  } catch (error: unknown) {
    invalidToolInput(toolUse, error);
  }
}
