// cogitatio-virtualis/cogitatio-terminal/types/document.ts

/**
 * Core document type classifications
 */
export enum DocumentType {
  EXPERIENCE = 'experience',
  EDUCATION = 'education',
  PROJECT = 'project',
  OTHER = 'other',
}

export enum OtherSubType {
  COVER_LETTER = 'cover-letter',
  PUBLICATION_SPEAKING = 'publication-speaking',
  RECOMMENDATION = 'recommendation',
  THOUGHT_LEADERSHIP = 'thought-leadership',
}

export enum ProjectSubType {
  PRODUCT = 'product',
  PROCESS = 'process',
  INFRASTRUCTURE = 'infrastructure',
  SELF_REFERENTIAL = 'self_referential',
}

export enum DeploymentStatus {
  PRODUCTION = 'Production',
  INTERNAL = 'Internal',
  ARCHIVED = 'Archived',
}

export enum ImpactScope {
  TEAM = 'Team',
  DEPARTMENT = 'Department',
  COMPANY = 'Company',
  INDUSTRY = 'Industry',
}

export enum EvolutionStage {
  ACTIVE = 'Active',
  STABLE = 'Stable',
  ARCHIVE = 'Archive',
}

export enum SpeakingFormat {
  PANEL = 'Panel',
  PRESENTATION = 'Presentation',
  ARTICLE = 'Article',
  WORKSHOP = 'Workshop',
}

/**
 * Base document interface
 */
export interface BaseDocument {
  type: DocumentType;
  title: string;
}

/**
 * Experience document
 */
export interface ExperienceDocument extends BaseDocument {
  type: DocumentType.EXPERIENCE;
  company: string;
  date_start: string;
  date_end: string;
  skills: string[];
  industry: string;
  location: string;
}

/**
 * Education document
 */
export interface EducationDocument extends BaseDocument {
  type: DocumentType.EDUCATION;
  institution: string;
  degree: string;
  field: string;
  graduation_date: string;
  honors?: string[];
  key_courses?: string[];
}

/**
 * Project document with conditional fields based on sub_type
 */
export interface ProjectDocument extends BaseDocument {
  type: DocumentType.PROJECT;
  date_start: string;
  date_end: string;
  sub_type: ProjectSubType;
  organization: string;
  team_size?: number;
  impact_scope: ImpactScope;

  // Product fields
  tech_stack?: string[];
  github?: string;
  deployment?: DeploymentStatus;

  // Process fields
  stakeholders?: string[];
  process_type?: string[];
  metrics?: string[];

  // Infrastructure fields
  supports?: string[];
  usage_metrics?: string[];

  // Self-referential fields
  demonstrates?: string[];
  evolution_stage?: EvolutionStage;
  exemplifies?: string[];
}

/**
 * Other document subtypes
 */
export interface Author {
  name: string;
  title: string;
  company: string;
  relationship: string;
}

export interface Period {
  start: string;
  end: string;
}

export interface Verification {
  contact?: string;
  linkedin?: string;
}

export interface CoverLetterDocument extends BaseDocument {
  type: DocumentType.OTHER;
  subtype: OtherSubType.COVER_LETTER;
  target: string;
  role: string;
  desired_characteristics: string[];
  highlights: string[];
  key_projects?: string[];
}

export interface PublicationSpeakingDocument extends BaseDocument {
  type: DocumentType.OTHER;
  subtype: OtherSubType.PUBLICATION_SPEAKING;
  date: string;
  venue: string;
  format: SpeakingFormat;
  audience: string;
  materials_link?: string;
  topics: string[];
  impact?: string[];
}

export interface RecommendationDocument extends BaseDocument {
  type: DocumentType.OTHER;
  subtype: OtherSubType.RECOMMENDATION;
  author: Author;
  period: Period;
  context: Array<string | { [key: string]: string | string[] }>;
  strengths_highlighted: string[];
  impact_areas: string[];
  verification?: Verification;
}

export interface ThoughtLeadershipDocument extends BaseDocument {
  type: DocumentType.OTHER;
  subtype: OtherSubType.THOUGHT_LEADERSHIP;
  domain: string;
  key_principles: string[];
  applications: string[];
  supported_by: string[];
  impact_areas: string[];
}

/**
 * Union type for all other documents
 */
export type OtherDocument =
  | CoverLetterDocument
  | PublicationSpeakingDocument
  | RecommendationDocument
  | ThoughtLeadershipDocument;

/**
 * Union type for all documents
 */
export type Document =
  | ExperienceDocument
  | EducationDocument
  | ProjectDocument
  | OtherDocument;

/**
 * Vector database specific types
 */

/**
 * Represents a single chunk of a document.
 */
export interface DocumentChunk {
  doc_id: string;
  chunk_id: string;
  content: string;
  metadata: {
    chunk_index: number;
    total_chunks: number;
    document: Document;
  };
}

/**
 * Represents a search result returned from the VectorAPI.
 */
export interface SearchResult {
  doc_id: string;
  chunk_id: string;
  score: number;
  content: string;
  metadata: Document;
}

/**
 * Represents a search request to the VectorAPI.
 */
export interface SearchRequest {
  query: string;
  embedding_type: 'none' | 'query' | 'document';
  k?: number; // Number of results to return (optional, defaults handled by backend)
  filter_types?: DocumentType[]; // Optional document type filters
}

/**
 * Represents the response structure for a document fetched by ID.
 */
export interface DocumentResponse {
  doc_id: string;
  chunk_id: string;
  total_chunks: number;
  content: string;
  metadata: Document;
}
