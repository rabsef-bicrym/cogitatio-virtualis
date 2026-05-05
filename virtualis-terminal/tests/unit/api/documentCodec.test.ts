import { describe, expect, it } from "vitest";
import { parseDocumentResponses } from "@/lib/api/document-codec";
import { DocumentType, OtherSubType } from "@/types/documents";

describe("document-codec", () => {
  it("parses Python document metadata that uses sub_type", () => {
    const [document] = parseDocumentResponses([
      {
        doc_id: "doc-1",
        chunk_id: "doc-1_0",
        total_chunks: 1,
        content: "Recommendation content",
        metadata: {
          type: "other",
          title: "Recommendation",
          sub_type: "recommendation",
          author: {
            name: "A",
            title: "Partner",
            company: "Firm",
            relationship: "Manager",
          },
          period: {
            start: "2020",
            end: "2024",
          },
          context: ["Worked together"],
          strengths_highlighted: ["Judgment"],
          impact_areas: ["Delivery"],
        },
      },
    ]);

    expect(document.metadata.type).toBe(DocumentType.OTHER);
    if (document.metadata.type === DocumentType.OTHER) {
      expect(document.metadata.sub_type).toBe(OtherSubType.RECOMMENDATION);
    }
  });

  it("rejects non-canonical subtype metadata from API responses", () => {
    expect(() =>
      parseDocumentResponses([
        {
          doc_id: "doc-1",
          chunk_id: "doc-1_0",
          total_chunks: 1,
          content: "Recommendation content",
          metadata: {
            type: "other",
            title: "Recommendation",
            subtype: "recommendation",
          },
        },
      ]),
    ).toThrow();
  });
});
