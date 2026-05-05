import { z } from "zod";
import {
  DeploymentStatus,
  DocumentType,
  EvolutionStage,
  ImpactScope,
  OtherSubType,
  ProjectSubType,
  SpeakingFormat,
  type DocumentResponse,
  type SearchResult,
} from "@/types/documents";

const baseDocumentSchema = z.object({
  type: z.enum([
    DocumentType.EXPERIENCE,
    DocumentType.EDUCATION,
    DocumentType.PROJECT,
    DocumentType.OTHER,
  ]),
  title: z.string(),
});

const experienceDocumentSchema = baseDocumentSchema.extend({
  type: z.literal(DocumentType.EXPERIENCE),
  company: z.string(),
  date_start: z.string(),
  date_end: z.string(),
  skills: z.array(z.string()),
  industry: z.string(),
  location: z.string(),
});

const educationDocumentSchema = baseDocumentSchema.extend({
  type: z.literal(DocumentType.EDUCATION),
  institution: z.string(),
  degree: z.string(),
  field: z.string(),
  graduation_date: z.string(),
  honors: z.array(z.string()).optional(),
  key_courses: z.array(z.string()).optional(),
});

const projectDocumentSchema = baseDocumentSchema.extend({
  type: z.literal(DocumentType.PROJECT),
  date_start: z.string(),
  date_end: z.string(),
  sub_type: z.enum([
    ProjectSubType.PRODUCT,
    ProjectSubType.PROCESS,
    ProjectSubType.INFRASTRUCTURE,
    ProjectSubType.SELF_REFERENTIAL,
  ]),
  organization: z.string(),
  team_size: z.number().optional().nullable(),
  impact_scope: z.enum([
    ImpactScope.TEAM,
    ImpactScope.DEPARTMENT,
    ImpactScope.COMPANY,
    ImpactScope.CLIENT,
    ImpactScope.INDUSTRY,
    ImpactScope.COMMUNITY,
    ImpactScope.TBD,
  ]),
  tech_stack: z.array(z.string()).optional().nullable(),
  github: z.string().optional().nullable(),
  deployment: z
    .enum([
      DeploymentStatus.PRODUCTION,
      DeploymentStatus.INTERNAL,
      DeploymentStatus.OPEN_SOURCE,
      DeploymentStatus.ARCHIVED,
    ])
    .optional()
    .nullable(),
  stakeholders: z.array(z.string()).optional().nullable(),
  process_type: z.array(z.string()).optional().nullable(),
  metrics: z.array(z.string()).optional().nullable(),
  supports: z.array(z.string()).optional().nullable(),
  usage_metrics: z.array(z.string()).optional().nullable(),
  demonstrates: z.array(z.string()).optional().nullable(),
  evolution_stage: z
    .enum([
      EvolutionStage.ACTIVE,
      EvolutionStage.STABLE,
      EvolutionStage.ARCHIVE,
    ])
    .optional()
    .nullable(),
  exemplifies: z.array(z.string()).optional().nullable(),
});

const authorSchema = z.object({
  name: z.string(),
  title: z.string(),
  company: z.string(),
  relationship: z.string(),
});

const periodSchema = z.object({
  start: z.string(),
  end: z.string(),
});

const verificationSchema = z.object({
  contact: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
});

const coverLetterDocumentSchema = baseDocumentSchema.extend({
  type: z.literal(DocumentType.OTHER),
  sub_type: z.literal(OtherSubType.COVER_LETTER),
  target: z.string(),
  role: z.string(),
  desired_characteristics: z.array(z.string()),
  highlights: z.array(z.string()),
  key_projects: z.array(z.string()).optional().nullable(),
});

const publicationSpeakingDocumentSchema = baseDocumentSchema.extend({
  type: z.literal(DocumentType.OTHER),
  sub_type: z.literal(OtherSubType.PUBLICATION_SPEAKING),
  date: z.string(),
  venue: z.string(),
  format: z.enum([
    SpeakingFormat.PANEL,
    SpeakingFormat.PRESENTATION,
    SpeakingFormat.ARTICLE,
    SpeakingFormat.WORKSHOP,
  ]),
  audience: z.string(),
  materials_link: z.string().optional().nullable(),
  topics: z.array(z.string()),
  impact: z.array(z.string()).optional().nullable(),
});

const recommendationDocumentSchema = baseDocumentSchema.extend({
  type: z.literal(DocumentType.OTHER),
  sub_type: z.literal(OtherSubType.RECOMMENDATION),
  author: authorSchema,
  period: periodSchema,
  context: z.array(z.union([z.string(), z.record(z.string(), z.unknown())])),
  strengths_highlighted: z.array(z.string()),
  impact_areas: z.array(z.string()),
  verification: verificationSchema.optional().nullable(),
});

const thoughtLeadershipDocumentSchema = baseDocumentSchema.extend({
  type: z.literal(DocumentType.OTHER),
  sub_type: z.literal(OtherSubType.THOUGHT_LEADERSHIP),
  domain: z.string(),
  key_principles: z.array(z.string()),
  applications: z.array(z.string()),
  supported_by: z.array(z.string()),
  impact_areas: z.array(z.string()),
});

const documentSchema = z.discriminatedUnion("type", [
  experienceDocumentSchema,
  educationDocumentSchema,
  projectDocumentSchema,
  z.discriminatedUnion("sub_type", [
    coverLetterDocumentSchema,
    publicationSpeakingDocumentSchema,
    recommendationDocumentSchema,
    thoughtLeadershipDocumentSchema,
  ]),
]);

const documentResponseSchema = z.object({
  doc_id: z.string(),
  chunk_id: z.string(),
  total_chunks: z.number(),
  content: z.string(),
  metadata: documentSchema,
});

const searchResultSchema = z.object({
  doc_id: z.string(),
  chunk_id: z.string(),
  score: z.number(),
  content: z.string(),
  metadata: documentSchema,
});

/**
 * Parses document responses returned by the Python vector API.
 */
export function parseDocumentResponses(data: unknown): DocumentResponse[] {
  return z.array(documentResponseSchema).parse(data) as DocumentResponse[];
}

/**
 * Parses search results returned by the Python vector API.
 */
export function parseSearchResults(data: unknown): SearchResult[] {
  return z.array(searchResultSchema).parse(data) as SearchResult[];
}
