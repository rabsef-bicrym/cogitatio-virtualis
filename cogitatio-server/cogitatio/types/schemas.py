# server/types/schemas.py

from enum import Enum
from typing import Optional, List, Union, Dict
from pydantic import BaseModel

class DocumentType(str, Enum):
    EXPERIENCE = "experience"
    EDUCATION = "education"
    PROJECT = "project"
    OTHER = "other"

class OtherSubType(str, Enum):
    COVER_LETTER = "cover-letter"
    PUBLICATION_SPEAKING = "publication-speaking"
    RECOMMENDATION = "recommendation"
    THOUGHT_LEADERSHIP = "thought-leadership"

class ProjectSubType(str, Enum):
    """
    Types of projects that can be documented.
    Note: SELF_REFERENTIAL is reserved for the single project document 
    that describes this system itself.
    """
    PRODUCT = "product"
    PROCESS = "process"
    INFRASTRUCTURE = "infrastructure"
    SELF_REFERENTIAL = "self_referential"

class DeploymentStatus(str, Enum):
    PRODUCTION = "Production"
    INTERNAL = "Internal"
    ARCHIVED = "Archived"

class ImpactScope(str, Enum):
    TEAM = "Team"
    DEPARTMENT = "Department"
    COMPANY = "Company"
    INDUSTRY = "Industry"

class EvolutionStage(str, Enum):
    ACTIVE = "Active"
    STABLE = "Stable"
    ARCHIVE = "Archive"

class SpeakingFormat(str, Enum):
    PANEL = "Panel"
    PRESENTATION = "Presentation"
    ARTICLE = "Article"
    WORKSHOP = "Workshop"

# Base Models
class BaseDocument(BaseModel):
    type: DocumentType
    title: str

# Experience Document
class ExperienceDocument(BaseDocument):
    type: DocumentType = DocumentType.EXPERIENCE
    company: str
    date_start: str
    date_end: str
    skills: List[str]
    industry: str
    location: str

# Education Document
class EducationDocument(BaseDocument):
    type: DocumentType = DocumentType.EDUCATION
    institution: str
    degree: str
    field: str
    graduation_date: str
    honors: Optional[List[str]] = None
    key_courses: Optional[List[str]] = None

# Project Document
class ProjectDocument(BaseDocument):
    type: DocumentType = DocumentType.PROJECT
    date_start: str
    date_end: str
    sub_type: ProjectSubType
    organization: str
    team_size: Optional[int] = None
    impact_scope: ImpactScope
    
    # Product fields
    tech_stack: Optional[List[str]] = None
    github: Optional[str] = None
    deployment: Optional[DeploymentStatus] = None
    
    # Process fields
    stakeholders: Optional[List[str]] = None
    process_type: Optional[List[str]] = None
    metrics: Optional[List[str]] = None
    
    # Infrastructure fields
    supports: Optional[List[str]] = None
    usage_metrics: Optional[List[str]] = None
    
    # Self-referential fields
    demonstrates: Optional[List[str]] = None
    evolution_stage: Optional[EvolutionStage] = None
    exemplifies: Optional[List[str]] = None

    def validate_sub_type_fields(self):
        """Validate required fields based on sub_type"""
        if self.sub_type == ProjectSubType.PRODUCT:
            assert self.tech_stack is not None, "tech_stack required for product"
            assert self.deployment is not None, "deployment required for product"
            
        if self.sub_type == ProjectSubType.PROCESS:
            assert all([self.stakeholders, self.process_type, self.metrics]), \
                "stakeholders, process_type, and metrics required for process"
            
        if self.sub_type == ProjectSubType.INFRASTRUCTURE:
            assert self.tech_stack is not None, "tech_stack required for infrastructure"
            assert self.supports is not None, "supports required for infrastructure"
            
        if self.sub_type == ProjectSubType.SELF_REFERENTIAL:
            assert all([self.demonstrates, self.evolution_stage, self.exemplifies]), \
                "demonstrates, evolution_stage, and exemplifies required for self_referential"

# Other Document Types
class Author(BaseModel):
    name: str
    title: str
    company: str
    relationship: str

class Period(BaseModel):
    start: str
    end: str

class Verification(BaseModel):
    contact: Optional[str] = None
    linkedin: Optional[str] = None

class CoverLetterDocument(BaseDocument):
    type: DocumentType = DocumentType.OTHER
    sub_type: OtherSubType = OtherSubType.COVER_LETTER
    target: str
    role: str
    desired_characteristics: List[str]
    highlights: List[str]
    key_projects: Optional[List[str]] = None

class PublicationSpeakingDocument(BaseDocument):
    type: DocumentType = DocumentType.OTHER
    sub_type: OtherSubType = OtherSubType.PUBLICATION_SPEAKING
    date: str
    venue: str
    format: SpeakingFormat
    audience: str
    materials_link: Optional[str] = None
    topics: List[str]
    impact: Optional[List[str]] = None

class RecommendationDocument(BaseDocument):
    type: DocumentType = DocumentType.OTHER
    sub_type: OtherSubType = OtherSubType.RECOMMENDATION
    author: Author
    period: Period
    context: List[Union[str, Dict[str, Union[str, List[str]]]]]
    strengths_highlighted: List[str]
    impact_areas: List[str]
    verification: Optional[Verification] = None

class ThoughtLeadershipDocument(BaseDocument):
    type: DocumentType = DocumentType.OTHER
    sub_type: OtherSubType = OtherSubType.THOUGHT_LEADERSHIP
    domain: str
    key_principles: List[str]
    applications: List[str]
    supported_by: List[str]
    impact_areas: List[str]

# Document Factory
class DocumentFactory:
    @staticmethod
    def create_document(data: dict) -> BaseDocument:
        """Create appropriate document type based on input data"""
        doc_type = data.get('type')
        if doc_type == DocumentType.EXPERIENCE:
            return ExperienceDocument(**data)
        elif doc_type == DocumentType.EDUCATION:
            return EducationDocument(**data)
        elif doc_type == DocumentType.PROJECT:
            doc = ProjectDocument(**data)
            doc.validate_sub_type_fields()
            return doc
        elif doc_type == DocumentType.OTHER:
            sub_type = data.get('sub_type')
            if sub_type == OtherSubType.COVER_LETTER:
                return CoverLetterDocument(**data)
            elif sub_type == OtherSubType.PUBLICATION_SPEAKING:
                return PublicationSpeakingDocument(**data)
            elif sub_type == OtherSubType.RECOMMENDATION:
                return RecommendationDocument(**data)
            elif sub_type == OtherSubType.THOUGHT_LEADERSHIP:
                return ThoughtLeadershipDocument(**data)
            raise ValueError(f"Unknown other document sub_type: {sub_type}")
        raise ValueError(f"Unknown document type: {doc_type}")