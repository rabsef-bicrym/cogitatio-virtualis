// cogitatio-virtualis/cogitation-terminal/types/document.ts

/**
 * Core document type classifications
 */
export enum DocumentType {
  EXPERIENCE = "experience",
  EDUCATION = "education",
  PROJECT = "project",
  OTHER = "other"
}

export enum OtherDocumentType {
  COVER_LETTER = "cover-letter",
  PUBLICATION_SPEAKING = "publication-speaking",
  RECOMMENDATION = "recommendation",
  THOUGHT_LEADERSHIP = "thought-leadership"
}

export enum ProjectSubType {
  PRODUCT = "product",
  PROCESS = "process",
  INFRASTRUCTURE = "infrastructure",
  SELF_REFERENTIAL = "self_referential"
}

export enum DeploymentStatus {
  PRODUCTION = "Production",
  INTERNAL = "Internal",
  ARCHIVED = "Archived"
}

export enum ImpactScope {
  TEAM = "Team",
  DEPARTMENT = "Department",
  COMPANY = "Company",
  INDUSTRY = "Industry"
}

export enum EvolutionStage {
  ACTIVE = "Active",
  STABLE = "Stable",
  ARCHIVE = "Archive"
}

export enum SpeakingFormat {
  PANEL = "Panel",
  PRESENTATION = "Presentation",
  ARTICLE = "Article",
  WORKSHOP = "Workshop"
}

// Base document interface
export interface BaseDocument {
  type: DocumentType;
  title: string;
}

// Experience document
export interface ExperienceDocument extends BaseDocument {
  type: DocumentType.EXPERIENCE;
  company: string;
  date_start: string;
  date_end: string;
  skills: string[];
  industry: string;
  location: string;
}

// Education document
export interface EducationDocument extends BaseDocument {
  type: DocumentType.EDUCATION;
  institution: string;
  degree: string;
  field: string;
  graduation_date: string;
  honors?: string[];
  key_courses?: string[];
}

// Project document with conditional fields based on sub_type
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

// Other document subtypes
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
  subtype: OtherDocumentType.COVER_LETTER;
  target: string;
  role: string;
  desired_characteristics: string[];
  highlights: string[];
  key_projects?: string[];
}

export interface PublicationSpeakingDocument extends BaseDocument {
  type: DocumentType.OTHER;
  subtype: OtherDocumentType.PUBLICATION_SPEAKING;
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
  subtype: OtherDocumentType.RECOMMENDATION;
  author: Author;
  period: Period;
  context: Array<string | { [key: string]: string | string[] }>;
  strengths_highlighted: string[];
  impact_areas: string[];
  verification?: Verification;
}

export interface ThoughtLeadershipDocument extends BaseDocument {
  type: DocumentType.OTHER;
  subtype: OtherDocumentType.THOUGHT_LEADERSHIP;
  domain: string;
  key_principles: string[];
  applications: string[];
  supported_by: string[];
  impact_areas: string[];
}

// Union type for all other documents
export type OtherDocument = 
  | CoverLetterDocument 
  | PublicationSpeakingDocument 
  | RecommendationDocument 
  | ThoughtLeadershipDocument;

// Union type for all documents
export type Document = 
  | ExperienceDocument 
  | EducationDocument 
  | ProjectDocument 
  | OtherDocument;

// Vector database specific types
export interface DocumentChunk {
  id: string;
  doc_id: string;
  content: string;
  metadata: {
    chunk_index: number;
    total_chunks: number;
    document: Document;
  };
}

export interface SearchResult {
  chunk_id: string;
  score: number;
  content: string;
  metadata: {
    doc_id: string;
    chunk_index: number;
    total_chunks: number;
    type: DocumentType;
    source_file: string;
  };
}

export interface SearchRequest {
  query: string;
  mode: "similarity" | "semantic" | "hyde";
  k?: number;
  filter_types?: DocumentType[];
  use_hyde?: boolean;
}