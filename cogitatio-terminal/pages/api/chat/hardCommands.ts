// cogitatio-virtualis/cogitatio-terminal/pages/api/chat/hardCommands.ts

/**
 *
 * This module handles slash commands like `/docs`, `/project`, `/exp`, `/search`, etc.
 * It calls VectorAPI methods directly rather than any Next.js API routes.
 *
 * Note: we do NOT transform, summarize, or parse the data in any special way.
 * We simply return it in the `data` property of our response object.
 * Note: The above is no longer true, we are starting to summarize the data in particular ways
 */

import { vectorApi } from '@/lib/api/vector';
import { docUtils } from '@/pages/utils/docUtils';
import {
  ExperienceDocument,
  ProjectDocument,
  DeploymentStatus,
  DocumentType,
  ProjectSubType,
  OtherSubType,
  DocumentResponse,
} from '@/types/documents';
import { error } from 'console';

/**
 * Basic response shape for slash commands.
 * We keep "data" as an optional field that can store
 * raw results from VectorAPI.
 */
export interface HardCommandResponse {
  success: boolean;
  message: string;
  data?: any; // We keep it broad, as different commands can return different shapes
}

/**
 * Main entry point for slash commands. The `command` param should be
 * something like "/docs experience" or "/search 'some query' query".
 */
export async function handleHardCommand(
  command: string,
  secret?: boolean,
): Promise<HardCommandResponse> {
  // Remove leading slash (if present) and split
  const [cmd, ...args] = command.replace(/^\/+/, '').split(' ');

  try {
    switch (cmd.toLowerCase()) {
      case 'resume':
        return {
          success: true,
          message:
            'Loading resume generation subroutine... Please provide a natural language job description as your next input:',
        };
      case 'doc_id':
        return await handleDocIdCommand(args, secret);
      case 'docs':
        return await handleDocsCommand(args, secret);

      case 'project':
        return await handleProjectCommand(args);

      case 'exp':
        return await handleExperienceCommand(args);

      case 'search':
        return await handleSearchCommand(args);

      case 'other':
        return await handleOtherCommand(args);

      case 'help':
        return handleHelpCommand();

      case 'status':
        return await handleStatusCommand(); // Updated to call the new handler

      default:
        return { success: false, message: `Unknown command: ${cmd}` };
    }
  } catch (error: any) {
    console.error(`[hardCommands] Error handling command "${command}":`, error);
    return {
      success: false,
      message: `Command execution failed: ${error.message || error}`,
      data: { recoverable_failure: true },
    };
  }
}

/**
 * `/status`
 * Example usage: /status
 *
 * Fetches the actual system status from vectorAPI.healthCheck.
 */
async function handleStatusCommand(): Promise<HardCommandResponse> {
  try {
    const rawData = await vectorApi.healthCheck();
    if (rawData.status && rawData.status === 'healthy') {
      return {
        success: true,
        message:
          'Cogitatio Terminal is connected to Cogitatio Server - Systems Nominal.',
        data: rawData, // Contains whatever the backend sent
      };
    } else {
      throw error('Unexpected API Response');
    }
  } catch (error: any) {
    console.error(`[handleStatusCommand] Error fetching health status:`, error);
    return {
      success: false,
      message: `Cogitatio Virtualis Health Check Failed - ${error.message || error}`,
    };
  }
}

/**
 * `/doc_id <doc_id>`
 * Example usage: /doc_id 85dac321-eeda-4bc7-ae0a-a4cd6f5074db
 *
 * Fetches a full document from vectorAPI.getDocument with the docID string.
 */
async function handleDocIdCommand(
  args: string[],
  secret?: boolean,
): Promise<HardCommandResponse> {
  const docId = args[0] as string;

  if (!secret) {
    return {
      success: false,
      message: `$ guest_user access_denied -- FORBIDDEN. Inquire via natural language.`,
    };
  }

  if (!docId) {
    return {
      success: false,
      message: 'Usage: /doc_id <doc_id>',
    };
  }

  try {
    const rawData = await vectorApi.getDocument(docId);
    const transformedData = docUtils.combineDocumentResponses(rawData);
    return {
      success: true,
      message: `Document ${docId} loaded; added to context.`,
      data: transformedData[0],
    };
  } catch (error: any) {
    console.error(
      `[handleDocIdCommand] Error fetching document with doc_id "${docId}":`,
      error,
    );
    return {
      success: false,
      message: `Docs Command Failure - ${error.message || error}`,
    };
  }
}

/**
 * `/docs <type>`
 * Example usage: /docs experience
 *
 * We call VectorAPI.getDocumentsByType() with the specified type.
 * We do not do any summarizing or transformation. We just return raw results in `data`.
 */
async function handleDocsCommand(args: string[], secret?: boolean): Promise<HardCommandResponse> {
  const docTypeArg = args[0] as DocumentType;

  if (!secret) {
    return {
      success: false,
      message: `$ guest_user access_denied -- FORBIDDEN. Inquire via natural language.`,
    };
  }

  // Validate docTypeArg
  if (!docTypeArg || !Object.values(DocumentType).includes(docTypeArg)) {
    return {
      success: false,
      message: 'Usage: /docs <experience|education|project|other>',
    };
  }

  try {
    // Retrieve documents from VectorAPI
    const data = await vectorApi.getDocumentsByType(docTypeArg);
    return {
      success: true,
      message: `Fetched documents of type "${docTypeArg}"`,
      data, // raw data from VectorAPI
    };
  } catch (error: any) {
    console.error(
      `[handleDocsCommand] Error fetching documents of type "${docTypeArg}":`,
      error,
    );
    return {
      success: false,
      message: `Docs Command Failure - ${error.message || error}`,
    };
  }
}

/**
 * `/project <list|type|active>`
 *
 * Example Usage: /project list
 *
 * - `list` lists all known projects
 * - `type` lists a subset of projects, by project type <product|process|infrastructure|self_referential>
 * - `active` lists all currently active projects by end_date
 */

async function handleProjectCommand(
  args: string[],
): Promise<HardCommandResponse> {
  if (!args[0] || args[0] === 'list') {
    // Just get all project docs
    try {
      const rawData = await vectorApi.getDocumentsByType(DocumentType.PROJECT);
      const transformedData = docUtils.transformProjectResults(rawData);
      const message = docUtils.createProjectListMessage(
        transformedData,
        rawData,
        transformedData.length > 0
          ? `${transformedData.length} Projects Loaded To Context:\n(Select by number or use natural language to proceed)`
          : `${transformedData.length} Projects Found`,
      );
      return {
        success: true,
        message,
        data: transformedData,
      };
    } catch (error: any) {
      console.error(
        `[handleProjectCommand] Error fetching all projects:`,
        error,
      );
      return {
        success: false,
        message: `Project Command Failure - ${error.message || error}`,
      };
    }
  }

  if (args[0] === 'type') {
    const subtypeArg = args[1] as ProjectSubType;
    // Validate
    if (!subtypeArg || !Object.values(ProjectSubType).includes(subtypeArg)) {
      return {
        success: false,
        message:
          'Usage: /project type <product|process|infrastructure|self_referential>',
      };
    }
    // Retrieve typed projects
    try {
      const rawData = await vectorApi.getDocumentsByType(DocumentType.PROJECT, {
        project_subtype: subtypeArg,
      });
      const transformedData = docUtils.transformProjectResults(rawData);
      const message = docUtils.createProjectListMessage(
        transformedData,
        rawData,
        transformedData.length > 0
          ? `${transformedData.length} Projects (Sub-Type: "${subtypeArg}") Loaded To Context:\n(Select by number or use natural language to proceed)`
          : `${transformedData.length} Projects (Sub-Type "${subtypeArg}") Found`,
      );
      return {
        success: true,
        message,
        data: transformedData,
      };
    } catch (error: any) {
      console.error(
        `[handleProjectCommand] Error fetching projects with subtype "${subtypeArg}":`,
        error,
      );
      return {
        success: false,
        message: `Project Subtype Command Failure - ${error.message || error}`,
      };
    }
  }

  if (args[0] === 'active') {
    try {
      const rawData = await vectorApi.getDocumentsByType(DocumentType.PROJECT);

      // Filter out chunks with deployment as 'Archived' for PROJECT documents
      const activeData = rawData.filter((chunk) => {
        // Check if the document type is PROJECT
        if (chunk.metadata.type === DocumentType.PROJECT) {
          const document = chunk.metadata as ProjectDocument;

          // Ensure that 'deployment' exists and is not 'Archived'
          return document.deployment !== DeploymentStatus.ARCHIVED;
        }

        // Exclude anything that isn't a PROJECT for some reason
        return false;
      });

      const transformedData = docUtils.transformProjectResults(activeData);
      const message = docUtils.createProjectListMessage(
        transformedData,
        activeData,
        transformedData.length > 0
          ? `${transformedData.length} Active Projects Loaded To Context:\n(Select by number or use natural language to proceed)`
          : `${transformedData.length} Active Projects Found`,
      );

      return {
        success: true,
        message,
        data: transformedData,
      };
    } catch (error: any) {
      console.error(
        `[handleProjectCommand] Error fetching active projects:`,
        error,
      );
      return {
        success: false,
        message: `Project Active Command Failure - ${error.message || error}`,
      };
    }
  }

  // If none of the above:
  return {
    success: false,
    message: 'Usage: /project <list|type|active>',
  };
}

/**
 * `/exp <list|years|skills>`
 *
 * - `/exp list`   => Return a summarized list of all experience documents
 * - `/exp years`  => Return the rough total years of experience
 * - `/exp skills` => Return a deduplicated list of all skills
 */
async function handleExperienceCommand(
  args: string[],
): Promise<HardCommandResponse> {
  const subCmd = (args[0] || 'list').toLowerCase();

  try {
    const rawData = await vectorApi.getDocumentsByType(DocumentType.EXPERIENCE);
    if (!rawData || rawData.length === 0) {
      return {
        success: true,
        message: `${rawData.length} Experience Documents Found`,
        data: [],
      };
    }

    // Transform the data once (for "list" and for potential subcommands)
    const transformedData = docUtils.transformExperienceResults(rawData);

    switch (subCmd) {
      case 'list': {
        const message = docUtils.createExperienceListMessage(
          transformedData,
          rawData,
          `${transformedData.length} Experience Documents Loaded To Context:\n(Select by number or use natural language to proceed)`,
        );
        return {
          success: true,
          message,
          data: transformedData,
        };
      }

      case 'years': {
        // 1) Collect each unique ExperienceDocument by doc_id.
        const docMap = new Map<string, ExperienceDocument>();
        for (const item of rawData) {
          const meta = item.metadata;
          if (docUtils.isExperienceDocument(meta) && !docMap.has(item.doc_id)) {
            docMap.set(item.doc_id, meta);
          }
        }
        // 2) Convert the Map to an array and pass to calculateExperienceYears
        const expDocs = Array.from(docMap.values());
        const totalYears =
          docUtils.documentAnalysis.calculateExperienceYears(expDocs);

        return {
          success: true,
          message: `Known years of experience: Roughly ${totalYears}`,
          data: { totalYears },
        };
      }

      case 'skills': {
        // Use docUtils.documentAnalysis.extractSkills on the raw doc array
        const expDocs = rawData
          .map((item) => item.metadata)
          .filter(docUtils.isExperienceDocument);

        const uniqueSkillsSet =
          docUtils.documentAnalysis.extractSkills(expDocs);
        // Convert to array and sort alphabetically
        const uniqueSkills = Array.from(uniqueSkillsSet).sort((a, b) =>
          a.localeCompare(b),
        );

        // Format as a numbered list
        if (uniqueSkills.length === 0) {
          return {
            success: true,
            message: `${uniqueSkills.length} Skills Found`,
            data: [],
          };
        }

        const listItems = uniqueSkills.map(
          (skill, idx) => `${idx + 1}. ${skill}`,
        );
        const message = `Skills Extracted (${uniqueSkills.length} total):\n${listItems.join(
          '\n',
        )}`;

        return {
          success: true,
          message,
          data: uniqueSkills,
        };
      }

      default:
        return {
          success: false,
          message: `Usage: /exp <list|years|skills>`,
        };
    }
  } catch (error: any) {
    console.error(`[handleExperienceCommand] Error:`, error);
    return {
      success: false,
      message: `Experience Command Failure - ${error.message || error}`,
    };
  }
}

/**
 * Handles the `/search [none|query|document] <query>` command.
 *
 * @param args - Array where the first element can be embedding_type and the rest form the query.
 * @returns A `HardCommandResponse` with the search results.
 */
async function handleSearchCommand(
  args: string[],
): Promise<HardCommandResponse> {
  // 1) Parse arguments
  let embedding_type: 'none' | 'query' | 'document' = 'none';
  let query = '';

  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /search [none|query|document] <query>',
    };
  }

  if (['none', 'query', 'document'].includes(args[0].toLowerCase())) {
    embedding_type = args[0].toLowerCase() as 'none' | 'query' | 'document';
    query = args.slice(1).join(' ').trim();
  } else {
    query = args.join(' ').trim();
  }

  if (!query) {
    return {
      success: false,
      message: 'Usage: /search [none|query|document] <query>',
    };
  }

  try {
    // 2) Perform the vector search
    const searchResults = await vectorApi.search({
      query,
      embedding_type,
      k: 5, // or however many results you want
    });

    // 3) Build a user-friendly message showing doc name, type, # chunks, and short chunk excerpts
    const message = docUtils.createSearchResultsMessage(searchResults);

    // 4) Return HardCommandResponse with your formatted message plus raw data if you like
    return {
      success: true,
      message,
      data: searchResults,
      // or you could store something more structured, e.g. group the results:
      // data: searchUtils.groupByDocument(searchResults),
    };
  } catch (error: any) {
    console.error(`[handleSearchCommand] Error performing search:`, error);
    return {
      success: false,
      message: `Search Command Failure - ${error.message || error}`,
    };
  }
}

/**
 * `/other <subtype>`
 * Example: /other cover-letter
 *
 * We pass the "other_subtype" param to VectorAPI.getDocumentsByType.
 * We do not do any special filtering or transformations.
 */
async function handleOtherCommand(
  args: string[],
): Promise<HardCommandResponse> {
  const subtypeArg = args[0] as OtherSubType;

  if (
    !subtypeArg ||
    !Object.values(OtherSubType).includes(subtypeArg)
  ) {
    return {
      success: false,
      message:
        'usage: /other <cover-letter|publication-speaking|recommendation|thought-leadership>',
    };
  }

  try {
    const rawData = await vectorApi.getDocumentsByType(DocumentType.OTHER, {
      other_subtype: subtypeArg,
    });

    const transformedData = docUtils.transformOtherResults(rawData);
    // special-case cover letters
    if (subtypeArg === OtherSubType.COVER_LETTER) {
      return {
        success: true,
        message: `Loading ${rawData.length} Cover Letter(s) to context... Please provide a natural language job description as your next input:`,
        data: transformedData, // or omit if you prefer
      };
    }

    // for the other subtypes, produce a summarized list & load them into context
    const message = docUtils.createOtherListMessage(
      transformedData,
      rawData,
      transformedData.length > 0
        ? `${transformedData.length} '${subtypeArg}' documents loaded to context:\n(select by number or proceed via natural language)`
        : `${transformedData.length} documents (subtype='${subtypeArg}') found`,
    );

    return {
      success: true,
      message,
      data: transformedData,
    };
  } catch (error: any) {
    console.error(
      `[handleOtherCommand] error fetching docs subtype "${subtypeArg}":`,
      error,
    );
    return {
      success: false,
      message: `other docs command failure - ${error.message || error}`,
    };
  }
}

/**
 * `/help`
 * Shows available commands
 */
function handleHelpCommand(): HardCommandResponse {
  // Provide usage instructions
  console.log("calling handleHelpCommand")
  const helpMessage = `Power User Commands:
  /search <type> <text>  - Vector search
    ↳ <type>: none, query, document
       • none: Direct vector encoding, no special instructions
       • query: <text> is treated as a question, vectors in DB answer it
       • document: Uses HyDE (Hypothetical Document Embedding)
  /exp <type>  - Experience documents
    ↳ <type>: list, years, skills
       • list: List all experience docs
       • years: Filter by years of experience
       • skills: Filter by specific skills
  /other <subtype>  - Retrieve other document types
    ↳ <subtype>: cover-letter, publication-speaking, recommendation, thought-leadership
       • cover-letter: Generate or retrieve cover letters
       • publication-speaking: Documents related to publications or speaking engagements
       • recommendation: Generate or retrieve recommendation documents
       • thought-leadership: Thought leadership-related documents
  /project <command>  - Project operations
    ↳ <command>: list, type <subtype>, active
       • list: List all projects
       • type <subtype>: Filter projects by subtype
         ↳ <subtype>: product, process, infrastructure, self_referential
            • product: Projects related to product development
            • process: Process improvement projects
            • infrastructure: Infrastructure-related projects
            • self_referential: Projects about improving the system itself
       • active: Show active projects
  /resume  - Start resume generator
  
  System Commands:
  /clear  - Clear terminal
  /status  - Show system status
  /history [count]  - Display command history
  /help  - Display this help message
  `;

  return {
    success: true,
    message: helpMessage,
  };
}
