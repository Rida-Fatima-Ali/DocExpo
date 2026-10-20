import logging
from flask import current_app
from app.extensions import db
from app.models.models import Document, DocumentChunk, Summary
from app.ai.provider import get_ai_provider

logger = logging.getLogger(__name__)

class DocumentSummarizer:
    """
    Summarization service handling full documents, section-based chunking,
    and hierarchical synthesis for long documents.
    """
    
    VALID_SUMMARY_TYPES = {
        'quick': 'Quick Summary',
        'detailed': 'Detailed Summary',
        'key_points': 'Key Points',
        'study_notes': 'Study Notes',
        'revision_questions': 'Questions for Revision'
    }
    
    @classmethod
    def generate_document_summary(cls, document_id: int, user_id: int, summary_type: str = 'quick') -> Summary:
        if summary_type not in cls.VALID_SUMMARY_TYPES:
            summary_type = 'quick'
            
        doc = Document.query.filter_by(id=document_id, user_id=user_id).first()
        if not doc:
            raise ValueError("Document not found or access denied.")
            
        if doc.processing_status != 'processed':
            raise ValueError(f"Document is not ready for summarization (status: {doc.processing_status}).")
            
        chunks = DocumentChunk.query.filter_by(document_id=doc.id).order_by(DocumentChunk.chunk_index.asc()).all()
        if not chunks:
            raise ValueError("No extracted text found in document.")
            
        ai_provider = get_ai_provider(current_app.config)
        
        # Combine chunks
        full_text = "\n\n".join([c.extracted_text for c in chunks])
        
        # Context window handling: if text > 20,000 chars, perform hierarchical summarization
        MAX_DIRECT_CHARS = 20000
        if len(full_text) > MAX_DIRECT_CHARS:
            # Split into 3-4 sections, summarize each, then synthesize
            section_size = 15000
            sections = [full_text[i:i + section_size] for i in range(0, len(full_text), section_size)]
            section_summaries = []
            
            for idx, sec in enumerate(sections):
                part_summary = ai_provider.generate_summary(
                    text_content=sec,
                    summary_type="key_points",
                    title=f"{doc.original_filename} (Section {idx + 1})"
                )
                section_summaries.append(part_summary)
                
            combined_section_text = "\n\n".join(section_summaries)
            final_content = ai_provider.generate_summary(
                text_content=combined_section_text,
                summary_type=summary_type,
                title=doc.original_filename
            )
        else:
            final_content = ai_provider.generate_summary(
                text_content=full_text,
                summary_type=summary_type,
                title=doc.original_filename
            )
            
        # Save summary to DB
        summary = Summary(
            user_id=user_id,
            document_id=doc.id,
            summary_type=summary_type,
            summary_content=final_content
        )
        db.session.add(summary)
        db.session.commit()
        
        return summary
