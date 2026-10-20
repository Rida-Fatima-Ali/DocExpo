import os
import re
import uuid
from pathlib import Path
import pymupdf as fitz
from app.extensions import db
from app.models.models import Document, DocumentChunk

def validate_pdf_file(file_stream, filename: str) -> tuple[bool, str]:
    """
    Validate that an uploaded file is a genuine PDF file.
    Checks file extension and magic byte signature (%PDF-).
    """
    if not filename.lower().endswith(".pdf"):
        return False, "File must have a .pdf extension."
    
    header = file_stream.read(5)
    file_stream.seek(0)
    
    if header != b"%PDF-":
        return False, "Invalid file format. The file does not have a valid PDF signature."
    
    return True, ""

def save_uploaded_pdf(file_storage, upload_folder: Path) -> tuple[str, str, int]:
    """
    Save uploaded PDF file with a cryptographically unique server-side filename.
    Returns (stored_filename, secure_path, file_size).
    """
    upload_folder.mkdir(parents=True, exist_ok=True)
    
    unique_id = uuid.uuid4().hex
    stored_filename = f"doc_{unique_id}.pdf"
    target_path = upload_folder / stored_filename
    
    file_storage.save(str(target_path))
    file_size = target_path.stat().st_size
    
    return stored_filename, str(target_path), file_size

def chunk_text(text: str, target_chunk_size: int = 700, overlap: int = 100) -> list[str]:
    """
    Split text into overlapping chunks, attempting to break on paragraph or sentence boundaries.
    """
    clean_text = re.sub(r'\r\n|\r', '\n', text)
    clean_text = re.sub(r'[ \t]+', ' ', clean_text).strip()
    
    if not clean_text:
        return []
    
    if len(clean_text) <= target_chunk_size:
        return [clean_text]
        
    chunks = []
    # Split by double newline or sentences
    paragraphs = clean_text.split('\n\n')
    current_chunk = ""
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
            
        if len(current_chunk) + len(para) + 2 <= target_chunk_size:
            current_chunk = f"{current_chunk}\n\n{para}".strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)
                # Overlap tail of previous chunk
                tail = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_chunk = f"{tail}\n{para}".strip()
            else:
                # Paragraph itself is longer than target size; split by sentences
                sentences = re.split(r'(?<=[.!?])\s+', para)
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) + 1 <= target_chunk_size:
                        current_chunk = f"{current_chunk} {sentence}".strip()
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                            tail = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                            current_chunk = f"{tail} {sentence}".strip()
                        else:
                            # Single giant sentence; hard-split
                            for i in range(0, len(sentence), target_chunk_size - overlap):
                                sub = sentence[i:i + target_chunk_size].strip()
                                if sub:
                                    chunks.append(sub)
                                    
    if current_chunk and (not chunks or current_chunk != chunks[-1]):
        chunks.append(current_chunk)
        
    return chunks

def process_pdf_document(document: Document, file_path: str) -> tuple[bool, str]:
    """
    Extracts text from the PDF page by page using PyMuPDF.
    Detects scanned/image-only PDFs and chunks readable text with page metadata.
    """
    document.processing_status = 'processing'
    db.session.commit()
    
    try:
        doc = fitz.open(file_path)
    except Exception as e:
        document.processing_status = 'error'
        document.error_message = f"Failed to open PDF document: {str(e)}"
        db.session.commit()
        return False, document.error_message
        
    try:
        if doc.is_encrypted:
            # Check if password protected without an empty password
            if not doc.authenticate(""):
                document.processing_status = 'error'
                document.error_message = "The PDF is password protected or encrypted and cannot be read."
                db.session.commit()
                doc.close()
                return False, document.error_message
                
        total_pages = doc.page_count
        document.page_count = total_pages
        
        total_extracted_text = ""
        page_texts = []
        
        for page_idx in range(total_pages):
            page = doc.load_page(page_idx)
            text = page.get_text("text").strip()
            page_texts.append((page_idx + 1, text))
            total_extracted_text += text
            
        doc.close()
        
        # Check if the document has extractable text or is a scanned image
        usable_chars = len(re.sub(r'\s+', '', total_extracted_text))
        if usable_chars < 30:
            document.processing_status = 'ocr_required'
            document.error_message = (
                "No extractable text found in this PDF. It appears to consist of scanned images "
                "or non-searchable raster pages. OCR is required to extract text from this document."
            )
            db.session.commit()
            return True, document.error_message
            
        # Create chunks
        chunk_index = 0
        for page_num, text in page_texts:
            if not text.strip():
                continue
            page_chunks = chunk_text(text, target_chunk_size=750, overlap=100)
            for ch in page_chunks:
                chunk_record = DocumentChunk(
                    document_id=document.id,
                    chunk_index=chunk_index,
                    page_number=page_num,
                    extracted_text=ch,
                    char_count=len(ch)
                )
                db.session.add(chunk_record)
                chunk_index += 1
                
        document.processing_status = 'processed'
        document.error_message = None
        db.session.commit()
        return True, "Document processed successfully."
        
    except Exception as e:
        db.session.rollback()
        document.processing_status = 'error'
        document.error_message = f"An error occurred during extraction: {str(e)}"
        db.session.commit()
        return False, document.error_message

def delete_document_files(document: Document, upload_folder: Path):
    """
    Remove the physical file from the storage directory.
    """
    try:
        target_path = upload_folder / document.stored_filename
        if target_path.exists():
            target_path.unlink()
    except Exception:
        pass
