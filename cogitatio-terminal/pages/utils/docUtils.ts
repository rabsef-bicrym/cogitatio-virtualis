/**
 * Utility functions and helpers for managing Document-related operations,
 * including type guards, transformations, search result organization,
 * and combined document structures.
 *
 * This file is intended as a drop-in replacement for the existing docUtils.ts.
 * It preserves all existing functionality while improving overall organization
 * and clarity.
 */

import {
  Document,
  DocumentResponse,
  DocumentType,
  OtherDocument,
  OtherSubType,
  ProjectDocument,
  ExperienceDocument,
  EducationDocument,
  SearchResult,
} from '@/types/documents';

/* -------------------------------------------------------------------------
 * SECTION A: TYPE GUARDS
 * -------------------------------------------------------------------------
 * These functions help ensure compile-time correctness by narrowing
 * the Document union type to a specific subtype.
 * -------------------------------------------------------------------------
 */

/**
 * Determines if the given Document is an ExperienceDocument.
 * @param doc - A generic Document.
 * @returns True if the Document is of type EXPERIENCE, else false.
 */
export function isExperienceDocument(doc: Document): doc is ExperienceDocument {
  return doc.type === DocumentType.EXPERIENCE;
}

/**
 * Determines if the given Document is an EducationDocument.
 * @param doc - A generic Document.
 * @returns True if the Document is of type EDUCATION, else false.
 */
export function isEducationDocument(doc: Document): doc is EducationDocument {
  return doc.type === DocumentType.EDUCATION;
}

/**
 * Determines if the given Document is a ProjectDocument.
 * @param doc - A generic Document.
 * @returns True if the Document is of type PROJECT, else false.
 */
export function isProjectDocument(doc: Document): doc is ProjectDocument {
  return doc.type === DocumentType.PROJECT;
}

/**
 * Determines if the given Document is an OtherDocument.
 * @param doc - A generic Document.
 * @returns True if the Document is of type OTHER, else false.
 */
export function isOtherDocument(doc: Document): doc is OtherDocument {
  return doc.type === DocumentType.OTHER;
}

/* -------------------------------------------------------------------------
 * SECTION B: COMBINED DOCUMENT INTERFACE
 * -------------------------------------------------------------------------
 * If needed, you can combine multiple chunks of a single Document into
 * a single data structure. The CombinedDocument interface captures
 * the fully reconstructed Document from multiple chunk responses.
 * -------------------------------------------------------------------------
 */

/**
 * Represents a reconstructed document composed of multiple chunks
 * returned from the vector search or another source.
 */
export interface CombinedDocument {
  doc_id: string;
  type: DocumentType;
  total_chunks: number;
  metadata: Document;
  chunks: {
    chunk_id: string;
    chunk_index: number;
    content: string;
  }[];
}

/* -------------------------------------------------------------------------
 * SECTION C: COMBINE DOCUMENT RESPONSES
 * -------------------------------------------------------------------------
 * This utility merges multiple DocumentResponse objects (representing
 * individual chunks of the same Document) into a single CombinedDocument.
 * -------------------------------------------------------------------------
 */

/**
 * Combines an array of DocumentResponses for the same doc_id into one
 * CombinedDocument per unique doc_id.
 *
 * @param docResponses - An array of DocumentResponse objects.
 * @returns An array of CombinedDocument objects, one per unique doc_id.
 */
export function combineDocumentResponses(
  docResponses: DocumentResponse[],
): CombinedDocument[] {
  const byDoc = new Map<string, DocumentResponse[]>();

  // Group DocumentResponses by doc_id.
  for (const response of docResponses) {
    if (!byDoc.has(response.doc_id)) {
      byDoc.set(response.doc_id, []);
    }
    byDoc.get(response.doc_id)!.push(response);
  }

  const combined: CombinedDocument[] = [];

  // For each unique doc_id group, sort by chunk index and merge.
  for (const [docId, responses] of byDoc) {
    responses.sort((a, b) => Number(a.chunk_id) - Number(b.chunk_id));

    // Assume all responses in this group have the same metadata.
    const docMetadata = responses[0].metadata;
    const totalChunks = responses[0].total_chunks;

    const combinedDoc: CombinedDocument = {
      doc_id: docId,
      type: docMetadata.type,
      total_chunks: totalChunks,
      metadata: docMetadata,
      chunks: responses.map((r) => ({
        chunk_id: r.chunk_id,
        chunk_index: Number(r.chunk_id),
        content: r.content,
      })),
    };

    combined.push(combinedDoc);
  }

  return combined;
}

/* -------------------------------------------------------------------------
 * SECTION D: DOCUMENT FORMATTERS
 * -------------------------------------------------------------------------
 * Helper functions to produce user-facing string representations
 * for various Document fields and structures.
 * -------------------------------------------------------------------------
 */

export const documentFormatters = {
  /**
   * Formats a date range string (e.g., "Jan 2020 - Present").
   * @param start - Start date string.
   * @param end - End date string (could be a date or "Present").
   * @returns A combined date range string.
   */
  dateRange: (start: string, end: string): string => {
    return `${start} - ${end === 'Present' ? 'Present' : end}`;
  },

  /**
   * Joins an array of strings into a human-friendly list.
   * For instance, ["A", "B", "C"] becomes "A, B and C".
   * @param items - An array of strings.
   * @returns A single string listing all items, or empty string if none.
   */
  list: (items: string[]): string => {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(', ')} and ${items.slice(-1)}`;
  },

  /**
   * Generates a brief summary of a Document, differing by subtype.
   * @param doc - A generic Document to summarize.
   * @returns A short string representing the Document's key details.
   */
  summary: (doc: Document): string => {
    if (isExperienceDocument(doc)) {
      return `${doc.title} at ${doc.company} (${documentFormatters.dateRange(
        doc.date_start,
        doc.date_end,
      )})`;
    }
    if (isEducationDocument(doc)) {
      return `${doc.degree} in ${doc.field} from ${doc.institution}`;
    }
    if (isProjectDocument(doc)) {
      return `${doc.title} - ${doc.organization} (${doc.sub_type})`;
    }
    // Fallback for OTHER document types.
    return doc.title;
  },
};

/* -------------------------------------------------------------------------
 * SECTION E: PROJECT RESULTS TRANSFORMATION AND LIST GENERATION
 * -------------------------------------------------------------------------
 * These utilities handle de-duplicating Project-type documents, sorting
 * them by date, and providing user-facing string representations.
 * -------------------------------------------------------------------------
 */

/**
 * Transforms raw DocumentResponse objects (of type PROJECT) into a
 * deduplicated array of project summaries, sorted by start date descending.
 *
 * @param data - An array of DocumentResponse objects.
 * @returns An array of deduplicated and sorted project summary objects.
 */
export function transformProjectResults(
  data: DocumentResponse[],
): Array<{
  doc_id: string;
  total_chunks: number;
  title: string;
  date_start: string;
  date_end: string;
  organization: string;
  impact_scope: string;
  tech_stack: string[];
}> {
  const uniqueProjects = new Map<
    string,
    {
      doc_id: string;
      total_chunks: number;
      title: string;
      date_start: string;
      date_end: string;
      organization: string;
      impact_scope: string;
      tech_stack: string[];
    }
  >();

  // Deduplicate and store project data keyed by doc_id.
  for (const project of data) {
    const { doc_id, total_chunks, metadata } = project;
    if (!isProjectDocument(metadata)) continue;

    if (!uniqueProjects.has(doc_id)) {
      uniqueProjects.set(doc_id, {
        doc_id,
        total_chunks,
        title: metadata.title,
        date_start: metadata.date_start,
        date_end: metadata.date_end,
        organization: metadata.organization,
        impact_scope: metadata.impact_scope,
        tech_stack: metadata.tech_stack || [],
      });
    }
  }

  // Convert Map values to an array for sorting.
  const projectsArray = Array.from(uniqueProjects.values());

  // Sort by start date descending.
  projectsArray.sort((a, b) => {
    const dateA = new Date(a.date_start);
    const dateB = new Date(b.date_start);
    return dateB.getTime() - dateA.getTime();
  });

  return projectsArray;
}

/**
 * Generates a formatted message listing all projects with summarized descriptions.
 *
 * @param transformedData - Array of transformed project summaries.
 * @param rawData - Original array of DocumentResponse objects for metadata reference.
 * @param introMessage - Introductory message relevant to the context.
 * @returns A formatted multi-line string listing all relevant projects.
 */
export function createProjectListMessage(
  transformedData: Array<{
    doc_id: string;
    total_chunks: number;
    title: string;
    date_start: string;
    date_end: string;
    organization: string;
    impact_scope: string;
    tech_stack: string[];
  }>,
  rawData: DocumentResponse[],
  introMessage: string,
): string {
  // Build a map from doc_id to full Document metadata for quick access.
  const docMap = new Map<string, Document>();

  for (const response of rawData) {
    if (isProjectDocument(response.metadata) && !docMap.has(response.doc_id)) {
      docMap.set(response.doc_id, response.metadata);
    }
  }

  // Generate each list item using documentFormatters.summary.
  const listItems = transformedData.map((project, index) => {
    const doc = docMap.get(project.doc_id);
    if (doc) {
      const summary = documentFormatters.summary(doc);
      return `${index + 1}. ${summary}`;
    }
    return `${index + 1}. [Summary not available]`;
  });

  // Combine the intro message with the enumerated list of projects.
  return `${introMessage}\n${listItems.join('\n')}`;
}

/* -------------------------------------------------------------------------
 * SECTION F: EXPERIENCE RESULTS TRANSFORMATION AND LIST GENERATION
 * -------------------------------------------------------------------------
 * Similar to project transformations, these utilities handle de-duplication
 * of Experience documents and provide user-facing messages.
 * -------------------------------------------------------------------------
 */

/**
 * Transforms raw DocumentResponse objects (of type EXPERIENCE) into
 * a deduplicated array of "experience summary" objects, sorted by start date descending.
 *
 * @param data - An array of DocumentResponse objects.
 * @returns An array of deduplicated and sorted experience summaries.
 */
export function transformExperienceResults(
  data: DocumentResponse[],
): Array<{
  doc_id: string;
  total_chunks: number;
  title: string;
  date_start: string;
  date_end: string;
  company: string;
  location: string;
  industry: string;
  skills: string[];
}> {
  const uniqueExperiences = new Map<
    string,
    {
      doc_id: string;
      total_chunks: number;
      title: string;
      date_start: string;
      date_end: string;
      company: string;
      location: string;
      industry: string;
      skills: string[];
    }
  >();

  // Deduplicate and store experience data keyed by doc_id.
  for (const item of data) {
    const { doc_id, total_chunks, metadata } = item;
    if (!isExperienceDocument(metadata)) continue;

    if (!uniqueExperiences.has(doc_id)) {
      uniqueExperiences.set(doc_id, {
        doc_id,
        total_chunks,
        title: metadata.title,
        date_start: metadata.date_start,
        date_end: metadata.date_end,
        company: metadata.company,
        location: metadata.location,
        industry: metadata.industry,
        skills: metadata.skills || [],
      });
    }
  }

  const experiencesArray = Array.from(uniqueExperiences.values());

  // Sort experiences by start date descending.
  experiencesArray.sort((a, b) => {
    const dateA = new Date(a.date_start);
    const dateB = new Date(b.date_start);
    return dateB.getTime() - dateA.getTime();
  });

  return experiencesArray;
}

/**
 * Generates a formatted list of summarized experience entries.
 * If no documents exist, returns a message indicating no results.
 *
 * @param transformedData - Deduplicated array of experience summaries.
 * @param rawData - Original array of DocumentResponse objects.
 * @param introMessage - Introductory message to contextualize the list.
 * @returns A multi-line string enumerating the experience items.
 */
export function createExperienceListMessage(
  transformedData: Array<{
    doc_id: string;
    total_chunks: number;
    title: string;
    date_start: string;
    date_end: string;
    company: string;
    location: string;
    industry: string;
    skills: string[];
  }>,
  rawData: DocumentResponse[],
  introMessage: string,
): string {
  if (transformedData.length === 0) {
    return `No 'Experience' documents found.\n${introMessage}`;
  }

  // Map doc_id -> full Document object for detailed metadata.
  const docMap = new Map<string, Document>();
  for (const response of rawData) {
    if (isExperienceDocument(response.metadata) && !docMap.has(response.doc_id)) {
      docMap.set(response.doc_id, response.metadata);
    }
  }

  // Build the list items using the documentFormatters.summary utility.
  const listItems = transformedData.map((exp, idx) => {
    const doc = docMap.get(exp.doc_id);
    if (!doc) {
      return `${idx + 1}. [No metadata available]`;
    }
    const summary = documentFormatters.summary(doc);
    return `${idx + 1}. ${summary}`;
  });

  return `${introMessage}\n${listItems.join('\n')}`;
}

/* -------------------------------------------------------------------------
 * SECTION G: OTHER DOCUMENT RESULTS TRANSFORMATION AND LIST GENERATION
 * -------------------------------------------------------------------------
 * Utilities for handling the "OTHER" type documents, such as recommendations,
 * cover letters, publications, and thought-leadership pieces.
 * -------------------------------------------------------------------------
 */

/**
 * Transforms raw DocumentResponse objects (of type OTHER) into a deduplicated
 * array of "other" summary objects.
 *
 * @param data - An array of DocumentResponse objects.
 * @returns An array of deduplicated "other document" summaries.
 */
export function transformOtherResults(
  data: DocumentResponse[],
): Array<{
  doc_id: string;
  total_chunks: number;
  subtype: OtherSubType;
  title: string;
}> {
  const uniqueOthers = new Map<
    string,
    {
      doc_id: string;
      total_chunks: number;
      subtype: OtherSubType;
      title: string;
    }
  >();

  for (const item of data) {
    const { doc_id, total_chunks, metadata } = item;
    if (!isOtherDocument(metadata)) continue;

    if (!uniqueOthers.has(doc_id)) {
      uniqueOthers.set(doc_id, {
        doc_id,
        total_chunks,
        subtype: metadata.subtype,
        title: metadata.title,
      });
    }
  }

  return Array.from(uniqueOthers.values());
}

/**
 * Generates a formatted list of summarized "OTHER" type documents.
 * If no documents exist, returns a message indicating no results.
 *
 * @param transformedData - Array of deduplicated "other" document summaries.
 * @param rawData - Original DocumentResponse array for reference.
 * @param introMessage - Introductory message to contextualize the list.
 * @returns A multi-line string enumerating the other document items.
 */
export function createOtherListMessage(
  transformedData: Array<{
    doc_id: string;
    total_chunks: number;
    subtype: OtherSubType;
    title: string;
  }>,
  rawData: DocumentResponse[],
  introMessage: string,
): string {
  if (!transformedData || transformedData.length === 0) {
    return `No 'Other' documents found.\n${introMessage}`;
  }

  // Map doc_id -> full Document object for display.
  const docMap = new Map<string, Document>();
  for (const r of rawData) {
    if (isOtherDocument(r.metadata) && !docMap.has(r.doc_id)) {
      docMap.set(r.doc_id, r.metadata);
    }
  }

  // Build enumerated list using the shared documentFormatters.summary function.
  const listItems = transformedData.map((info, idx) => {
    const doc = docMap.get(info.doc_id);
    if (!doc) {
      return `${idx + 1}. [no metadata available]`;
    }
    const summary = documentFormatters.summary(doc);
    return `${idx + 1}. ${summary} (${info.subtype})`;
  });

  return `${introMessage}\n${listItems.join('\n')}`;
}

/* -------------------------------------------------------------------------
 * SECTION H: SEARCH RESULT UTILITIES
 * -------------------------------------------------------------------------
 * Functions for grouping and ordering search results returned from
 * the vector API, as well as creating a user-facing output message.
 * -------------------------------------------------------------------------
 */

export const searchUtils = {
  /**
   * Groups an array of SearchResult objects by their doc_id, then
   * sorts those groups by their highest score in descending order.
   *
   * @param results - An array of SearchResult objects.
   * @returns An array of grouped results, each containing docId, results, and topScore.
   */
  groupByDocument: (
    results: SearchResult[],
  ): Array<{ docId: string; results: SearchResult[]; topScore: number }> => {
    const groupedMap = new Map<string, SearchResult[]>();

    // Group results by doc_id.
    results.forEach((result) => {
      const docId = result.doc_id;
      if (!groupedMap.has(docId)) {
        groupedMap.set(docId, []);
      }
      groupedMap.get(docId)!.push(result);
    });

    // Transform grouped entries into an array with top score included.
    const groupedArray: Array<{
      docId: string;
      results: SearchResult[];
      topScore: number;
    }> = [];

    groupedMap.forEach((docSearchResults, docId) => {
      const topScore = Math.max(...docSearchResults.map((r) => r.score));
      groupedArray.push({ docId, results: docSearchResults, topScore });
    });

    // Sort by topScore in descending order.
    groupedArray.sort((a, b) => b.topScore - a.topScore);

    return groupedArray;
  },

  /**
   * Orders an array of SearchResult chunks by their chunk index,
   * extracted from the chunk_id (e.g., docId_0, docId_1, etc.).
   *
   * @param chunks - An array of SearchResult objects for the same doc_id.
   * @returns A new sorted array with ascending chunk indexes.
   */
  orderChunks: (chunks: SearchResult[]): SearchResult[] => {
    if (chunks.length === 0) return [];

    // All chunks are assumed to share the same doc_id.
    const docId = chunks[0].doc_id;

    return [...chunks].sort((a, b) => {
      const extractIndex = (chunkId: string): number => {
        const prefix = `${docId}_`;
        if (!chunkId.startsWith(prefix)) {
          console.warn(
            `chunk_id "${chunkId}" does not start with expected prefix "${prefix}".`,
          );
          return 0;
        }
        const indexStr = chunkId.substring(prefix.length);
        const index = parseInt(indexStr, 10);
        if (isNaN(index)) {
          console.warn(`Unable to parse chunk index from "${chunkId}".`);
          return 0;
        }
        return index;
      };

      const indexA = extractIndex(a.chunk_id);
      const indexB = extractIndex(b.chunk_id);
      return indexA - indexB;
    });
  },
};

/**
 * Creates a user-facing message representing the results of a vector search,
 * grouped by doc_id and ordered by highest score. Within each group,
 * chunks are ordered by their chunk index.
 *
 * @param results - An array of SearchResult objects.
 * @returns A formatted string detailing the search results, grouped and sorted.
 */
export function createSearchResultsMessage(results: SearchResult[]): string {
  if (!results || results.length === 0) {
    return 'No search results found.';
  }

  // Group the results by doc_id and sort by top score.
  const groupedResults = searchUtils.groupByDocument(results);

  const lines: string[] = [];
  lines.push('Vector Search Returned:');
  lines.push('(Select by number or use natural language to proceed)');

  let docCounter = 1;

  // For each group, order chunks, then display an excerpt of each chunk.
  groupedResults.forEach(({ docId, results: docSearchResults, topScore }) => {
    const orderedChunks = searchUtils.orderChunks(docSearchResults);

    // We assume all chunks share the same document metadata.
    const document = orderedChunks[0].metadata as Document;
    const docTitle = document.title;
    const docType = document.type;
    const chunkCount = orderedChunks.length;

    // Format the top score for display (percentage-like).
    const formattedScore = (topScore * 100).toFixed(1);

    lines.push(
      `${docCounter}. ${docTitle} - ${docType} - ${formattedScore}% Relevance`,
    );

    orderedChunks.forEach((res) => {
      let excerpt = res.content.replace(/\n/g, ' ');
      if (excerpt.startsWith('## ')) {
        excerpt = excerpt.replace(/^##\s*/, '')
      }

      if (excerpt.length > 75) {
        excerpt = excerpt.slice(0, 75) + '...';
      }
      lines.push(`  - ${excerpt}`);
    });

    docCounter++;
  });

  return lines.join('\n');
}

/* -------------------------------------------------------------------------
 * SECTION I: DOCUMENT SORTING UTILITIES
 * -------------------------------------------------------------------------
 * Functions for sorting various Document types by date or other criteria.
 * -------------------------------------------------------------------------
 */

export const documentSorters = {
  /**
   * Sorts two Documents by date, prioritizing Experience or Education end dates,
   * or Project end dates if relevant. Non-recognized Documents go to the bottom.
   * @param a - First Document.
   * @param b - Second Document.
   * @returns A sort comparator value, suitable for array sorting.
   */
  byDate: (a: Document, b: Document): number => {
    const getDate = (doc: Document): string => {
      if (isExperienceDocument(doc)) return doc.date_end || 'Present';
      if (isEducationDocument(doc)) return doc.graduation_date;
      if (isProjectDocument(doc)) return doc.date_end || 'Present';
      return '0';
    };
    return getDate(b).localeCompare(getDate(a));
  },

  /**
   * Sorts two ProjectDocument objects by their impact_scope, giving
   * Industry > Company > Department > Team priority.
   * @param a - First ProjectDocument.
   * @param b - Second ProjectDocument.
   * @returns A sort comparator value, suitable for array sorting.
   */
  byImpactScope: (a: ProjectDocument, b: ProjectDocument): number => {
    const scopeWeight: Record<string, number> = {
      Industry: 4,
      Company: 3,
      Department: 2,
      Team: 1,
    };
    return scopeWeight[b.impact_scope] - scopeWeight[a.impact_scope];
  },
};

/* -------------------------------------------------------------------------
 * SECTION J: DOCUMENT ANALYSIS UTILITIES
 * -------------------------------------------------------------------------
 * These methods perform more sophisticated extraction or calculations
 * across multiple Documents, such as skill aggregation or total experience.
 * -------------------------------------------------------------------------
 */

export const documentAnalysis = {
  /**
   * Gathers all unique skill strings from an array of ExperienceDocument objects.
   * @param docs - An array of ExperienceDocument objects.
   * @returns A Set containing all unique skill strings found.
   */
  extractSkills: (docs: ExperienceDocument[]): Set<string> => {
    const skills = new Set<string>();
    docs.forEach((doc) => {
      doc.skills.forEach((skill) => skills.add(skill));
    });
    return skills;
  },

  /**
   * Gathers all unique technologies from an array of ProjectDocument objects.
   * @param docs - An array of ProjectDocument objects.
   * @returns A Set containing all unique technology strings found.
   */
  extractTechnologies: (docs: ProjectDocument[]): Set<string> => {
    const techs = new Set<string>();
    docs.forEach((doc) => {
      doc.tech_stack?.forEach((tech) => techs.add(tech));
    });
    return techs;
  },

  /**
   * Calculates the total years of experience by summing month differences
   * between date_start and date_end fields across an array of ExperienceDocument objects.
   * @param docs - An array of ExperienceDocument objects.
   * @returns A numeric value for total years of experience, rounded to one decimal place.
   */
  calculateExperienceYears: (docs: ExperienceDocument[]): number => {
    let totalMonths = 0;
    docs.forEach((doc) => {
      const start = new Date(doc.date_start);
      const end = doc.date_end === 'Present' ? new Date() : new Date(doc.date_end);
      totalMonths +=
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());
    });
    return Math.round((totalMonths / 12) * 10) / 10;
  },
};

/* -------------------------------------------------------------------------
 * SECTION K: BARREL EXPORT
 * -------------------------------------------------------------------------
 * Exports all above utilities under a single namespace, preserving
 * the original pattern for external usage.
 * -------------------------------------------------------------------------
 */

export * as docUtils from './docUtils';
