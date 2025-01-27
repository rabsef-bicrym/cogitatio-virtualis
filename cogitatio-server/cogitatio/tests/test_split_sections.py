# cogitatio/tests/test_split_sections.py

from cogitatio.document_processor.processor import DocumentProcessor
from cogitatio.document_processor.vector_manager import VectorManager
from cogitatio.utils.logging import ComponentLogger

def test_split_sections():
    # Setup logger
    logger = ComponentLogger("test_logger")
    
    # Mock VectorManager (adjust according to your initialization requirements)
    vector_manager = VectorManager()

    # Initialize DocumentProcessor
    doc_processor = DocumentProcessor(vector_manager=vector_manager)

    # Markdown content to test
    markdown_body = """
---
type: project
title: "Businessify"
date_start: "2023-03"
date_end: "2023-12"
sub_type: "product"

tech_stack:
  - "Visual Basic for Applications"
  - "Microsoft Outlook Object Model"
  - "OpenAI GPT-4 API"
  - "MSXML2 HTTP"
  - "MSForms"
  - "Microsoft Word Object Model"
github: null
deployment: "Archived"
organization: "Dykema Gossett PLLC"
team_size: 1
impact_scope: "Team"
---

# Businessify Email Assistant

## Overview
Law firms are workspaces of tight proximity between high skill, high education, high communication ability employees (attorneys), and varied skill, education, and communication ability employees (administrative and support staff). Support staff and administrative professionals can sometimes struggle with composing emails that mirro the formal tone and professional communication standards expected by attorneys. However, solutions like templates or lengthy style guides fail to provide the dynamic, immediate, educational feedback needed to help these employees develop their communication skills.

Businessify represented early attempts to bridge this communication gap effectively while also providing the requisite training to improve the user's natural communication patterns over time. It included two primary functions: RSVPify and Clarify.
  - RSVPify allowed users to take a threaded email with significant back-content, write a draft in a bulleted list, and send it off to an LLM to be redrafted into a full-prose email with proper professionalism, tone, word choice, etc. In addition, it sought to address any gaps between the threads _asks_ of the user and the drafted response, alerting the user if any strands have been left unanswered.
  - Clarify allowed users to write a full prose response and receive back from the LLM:
    * A list of responsiveness errors (failures to completely respond to the strands of the thread)
    * A list of word choice and grammatical errors
    * A list of tonality suggestions
    * A list of framing changes (framing defined for the LLM as a catch-all for any other feedback it may have relating to the nature of the drafted email)
    * A re-draft of the email, after incorporating the suggested changes

These features are intended to level the playing field of internal communications at law firms, allowing employees with valid ideas that are otherwise trapped behind communication barriers to bring their ideas to the table, professionally packaged. The return on investment here is improved relations between high skill and low skill workers, which is critical for the smooth and cost effective operation of the law firm.

The project introduced several technical innovations in the VBA space while focusing on accessibility: structured prompt engineering that separated writing feedback from draft generation, robust handling of multiple email formats (Plain Text, HTML, RTF) through Word Object Model integration, and a custom UserForm interface that displayed both improvement suggestions and a ready-to-use professional draft. Most importantly, it provided constructive writing feedback in clear, accessible language, helping employees understand not just what to change, but why those changes matter in a professional context.

## Key Achievements
- Achieved bidirectional integration between Outlook and OpenAI's GPT-4 API through MSXML2 HTTP
- Created structured prompt system separating email components while maintaining threading context
- Implemented JSON response parsing and token tracking in VBA, using an available JSON parsing library and some custom routines on top of it
- Built custom UserForm interface displaying suggestions with usage metrics

## Technical Implementation
The system architecture centered on a multi-stage processing pipeline handling email format conversion, content normalization, API interaction, and response display. Format-specific handlers used the Word Object Model to reliably extract content from Plain Text, HTML, and RTF formats while preserving structure. A custom normalization layer prepared content for API transmission while maintaining readability.

The implementation leveraged three distinct system prompts targeting different use cases: clarification for improving existing drafts, RSVP mode for converting bullet points to prose, and test mode for validating system understanding. Each prompt carefully structured the input to maintain separation between new content and thread context. The system used MSXML2.ServerXMLHTTP60 for API communication and implemented custom JSON parsing to handle OpenAI's response format.

## Challenges & Solutions
- Format Handling Complexity:
  - Email formats required different extraction methods
  - Implemented Word Object Model integration
  - Achieved consistent text handling across formats

- VBA HTTP Limitations:
  - Modern HTTP libraries unavailable
  - Built custom request handling
  - Managed API rate limiting and errors

- Interface Constraints:
  - Limited to MSForms capabilities
  - Attempted to provide reasonable UI/UX accommodations despite these limitations
  - Eventually experienced limited user adoption, ended by shutting down the project.

## Impact & Results
- Technical Success:
  - Functional integration with GPT-4
  - Reliable format handling
  - Educational feedback system
  - Basic usage analytics

- Adoption Results:
  - Deployment limitations prevented wider rollout
  - Interface constraints led to discontinuation

## Key Learnings
The project demonstrated both the potential and limitations of integrating AI capabilities into existing enterprise software through VBA. While technically successful in achieving core functionality, the limitations of VBA as a modern application platform - particularly in user interface design and deployment - ultimately restricted broader adoption.

This early experiment significantly influenced later projects, particularly in understanding the importance of modern development frameworks and deployment strategies. The project's prompt engineering approach, especially the structured handling of context and professional tone maintenance, proved valuable: while the tool itself was archived, it served as a crucial learning experience in enterprise AI integration and informed more successful approaches to legal workflow automation.

While adoption lagged, Businessify still stands as a positive experiment in responsible, safe, productive AI use for our organization.
    """

    # Call _split_sections and print the result
    sections = doc_processor._split_sections(markdown_body)
    print("Split sections:", sections)

# Run the test
if __name__ == "__main__":
    test_split_sections()
