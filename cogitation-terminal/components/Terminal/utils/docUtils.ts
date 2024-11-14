// lib/utils/documents.ts

import {
  Document,
  DocumentType,
  OtherDocumentType,
  ProjectSubType,
  ExperienceDocument,
  EducationDocument,
  ProjectDocument,
  OtherDocument,
  SearchResult
} from '@/types/documents';


/**
 * Type guards for document types
 */
export const isExperienceDocument = (doc: Document): doc is ExperienceDocument => {
  return doc.type === DocumentType.EXPERIENCE;
};

export const isEducationDocument = (doc: Document): doc is EducationDocument => {
  return doc.type === DocumentType.EDUCATION;
};

export const isProjectDocument = (doc: Document): doc is ProjectDocument => {
  return doc.type === DocumentType.PROJECT;
};

export const isOtherDocument = (doc: Document): doc is OtherDocument => {
  return doc.type === DocumentType.OTHER;
};

/**
 * Document sorting utilities
 */
export const documentSorters = {
  /**
   * Sort by date, most recent first
   */
  byDate: (a: Document, b: Document): number => {
    const getDate = (doc: Document): string => {
      if (isExperienceDocument(doc)) return doc.date_end || 'Present';
      if (isEducationDocument(doc)) return doc.graduation_date;
      if (isProjectDocument(doc)) return doc.date_end;
      return '0'; // Other documents without dates sort to end
    };
    return getDate(b).localeCompare(getDate(a));
  },

  /**
   * Sort projects by impact scope, highest impact first
   */
  byImpactScope: (a: ProjectDocument, b: ProjectDocument): number => {
    const scopeWeight = {
      'Industry': 4,
      'Company': 3,
      'Department': 2,
      'Team': 1
    };
    return scopeWeight[b.impact_scope] - scopeWeight[a.impact_scope];
  }
};

/**
 * Document filtering utilities
 */
export const documentFilters = {
  /**
   * Get active/current items (where end date is 'Present')
   */
  active: (docs: Document[]): Document[] => {
    return docs.filter(doc => {
      if (isExperienceDocument(doc)) return doc.date_end === 'Present';
      if (isProjectDocument(doc)) return doc.date_end === 'Present';
      return false;
    });
  },

  /**
   * Filter projects by subtype
   */
  byProjectSubType: (docs: ProjectDocument[], subType: ProjectSubType): ProjectDocument[] => {
    return docs.filter(doc => doc.sub_type === subType);
  },

  /**
   * Filter other documents by subtype
   */
  byOtherSubType: (docs: OtherDocument[], subType: OtherDocumentType): OtherDocument[] => {
    return docs.filter(doc => doc.subtype === subType);
  }
};

/**
 * Document formatting utilities
 */
export const documentFormatters = {
  /**
   * Format date ranges consistently
   */
  dateRange: (start: string, end: string): string => {
    return `${start} - ${end === 'Present' ? 'Present' : end}`;
  },

  /**
   * Format lists with proper punctuation
   */
  list: (items: string[]): string => {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(', ')} and ${items.slice(-1)}`;
  },

  /**
   * Create a brief summary of a document
   */
  summary: (doc: Document): string => {
    if (isExperienceDocument(doc)) {
      return `${doc.title} at ${doc.company} (${documentFormatters.dateRange(doc.date_start, doc.date_end)})`;
    }
    if (isEducationDocument(doc)) {
      return `${doc.degree} in ${doc.field} from ${doc.institution}`;
    }
    if (isProjectDocument(doc)) {
      return `${doc.title} - ${doc.organization} (${doc.sub_type})`;
    }
    return doc.title;
  }
};

/**
 * Search result processing utilities
 */
export const searchUtils = {
  /**
   * Group search results by document
   */
  groupByDocument: (results: SearchResult[]): Map<string, SearchResult[]> => {
    const grouped = new Map<string, SearchResult[]>();
    results.forEach(result => {
      const docId = result.metadata.doc_id;
      if (!grouped.has(docId)) {
        grouped.set(docId, []);
      }
      grouped.get(docId)?.push(result);
    });
    return grouped;
  },

  /**
   * Order chunks within a document
   */
  orderChunks: (chunks: SearchResult[]): SearchResult[] => {
    return [...chunks].sort((a, b) => 
      a.metadata.chunk_index - b.metadata.chunk_index
    );
  },

  /**
   * Reconstruct full document content from chunks
   */
  reconstructContent: (chunks: SearchResult[]): string => {
    return searchUtils
      .orderChunks(chunks)
      .map(chunk => chunk.content)
      .join('\n');
  }
};

/**
 * Document analysis utilities
 */
export const documentAnalysis = {
  /**
   * Extract all unique skills from experience documents
   */
  extractSkills: (docs: ExperienceDocument[]): Set<string> => {
    const skills = new Set<string>();
    docs.forEach(doc => {
      doc.skills.forEach(skill => skills.add(skill));
    });
    return skills;
  },

  /**
   * Extract all technologies from project documents
   */
  extractTechnologies: (docs: ProjectDocument[]): Set<string> => {
    const techs = new Set<string>();
    docs.forEach(doc => {
      doc.tech_stack?.forEach(tech => techs.add(tech));
    });
    return techs;
  },

  /**
   * Calculate total years of experience
   */
  calculateExperienceYears: (docs: ExperienceDocument[]): number => {
    let totalMonths = 0;
    docs.forEach(doc => {
      const start = new Date(doc.date_start);
      const end = doc.date_end === 'Present' ? new Date() : new Date(doc.date_end);
      totalMonths += (end.getFullYear() - start.getFullYear()) * 12 +
                    (end.getMonth() - start.getMonth());
    });
    return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal
  },

  /**
   * Find related documents based on shared attributes
   */
  findRelated: (doc: Document, allDocs: Document[]): Document[] => {
    if (isProjectDocument(doc)) {
      return allDocs.filter(other => 
        other !== doc && 
        isProjectDocument(other) &&
        (
          other.organization === doc.organization ||
          other.sub_type === doc.sub_type ||
          other.tech_stack?.some(tech => doc.tech_stack?.includes(tech))
        )
      );
    }
    if (isExperienceDocument(doc)) {
      return allDocs.filter(other =>
        other !== doc &&
        (isExperienceDocument(other) && other.company === doc.company ||
         isProjectDocument(other) && other.organization === doc.company)
      );
    }
    return [];
  }
};

/**
 * Resume generation utilities
 */
export const resumeUtils = {
  /**
   * Sort documents by relevance to given keywords
   */
  sortByRelevance: (docs: Document[], keywords: string[]): Document[] => {
    return [...docs].sort((a, b) => {
      const scoreA = resumeUtils.calculateRelevance(a, keywords);
      const scoreB = resumeUtils.calculateRelevance(b, keywords);
      return scoreB - scoreA;
    });
  },

  /**
   * Calculate document relevance score for keywords
   */
  calculateRelevance: (doc: Document, keywords: string[]): number => {
    let score = 0;
    const text = JSON.stringify(doc).toLowerCase();
    keywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) score++;
    });
    if (isProjectDocument(doc)) {
      score *= doc.impact_scope === 'Industry' ? 1.5 :
               doc.impact_scope === 'Company' ? 1.3 :
               doc.impact_scope === 'Department' ? 1.2 : 1;
    }
    return score;
  }
};