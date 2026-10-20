import io
import unittest
from pathlib import Path
import pymupdf as fitz
from config import TestingConfig
from app import create_app
from app.extensions import db
from app.models.models import User, Document, DocumentChunk
from app.documents.services import (
    validate_pdf_file,
    save_uploaded_pdf,
    process_pdf_document,
    chunk_text,
    delete_document_files
)

def create_sample_pdf(text: str = "This is a sample document for testing PyMuPDF text extraction.") -> io.BytesIO:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), text)
    pdf_bytes = doc.tobytes()
    doc.close()
    return io.BytesIO(pdf_bytes)

def create_scanned_mock_pdf() -> io.BytesIO:
    # A PDF with an empty page (or pure drawing/raster without extractable text)
    doc = fitz.open()
    page = doc.new_page()
    # Draw a rectangle without text to simulate pure graphical / scanned content
    page.draw_rect(fitz.Rect(50, 50, 200, 200), color=(0, 0, 1), fill=(1, 0, 0))
    pdf_bytes = doc.tobytes()
    doc.close()
    return io.BytesIO(pdf_bytes)

class PDFProcessingTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestingConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Create user
        self.user = User(full_name="PDF Tester", email="pdf@documind.io")
        self.user.set_password("password123")
        db.session.add(self.user)
        db.session.commit()

        self.upload_folder = Path(self.app.config['UPLOAD_FOLDER'])
        self.upload_folder.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        # Clean test uploads
        if self.upload_folder.exists():
            for f in self.upload_folder.glob("*"):
                if f.is_file():
                    try:
                        f.unlink()
                    except Exception:
                        pass
        self.app_context.pop()

    def test_validate_pdf_file(self):
        # Valid PDF
        pdf_stream = create_sample_pdf("Testing PDF validation")
        is_valid, msg = validate_pdf_file(pdf_stream, "sample.pdf")
        self.assertTrue(is_valid)

        # Invalid extension
        is_valid, msg = validate_pdf_file(pdf_stream, "sample.exe")
        self.assertFalse(is_valid)
        self.assertIn("must have a .pdf extension", msg)

        # Fake PDF content
        fake_stream = io.BytesIO(b"NOT_A_PDF_FILE_HEADER")
        is_valid, msg = validate_pdf_file(fake_stream, "fake.pdf")
        self.assertFalse(is_valid)
        self.assertIn("valid PDF signature", msg)

    def test_chunk_text(self):
        text = "Paragraph one with some interesting facts.\n\nParagraph two with key findings and data.\n\nParagraph three concluding the paper."
        chunks = chunk_text(text, target_chunk_size=60, overlap=10)
        self.assertTrue(len(chunks) >= 2)
        for ch in chunks:
            self.assertTrue(len(ch) > 0)

    def test_process_text_pdf(self):
        pdf_stream = create_sample_pdf("Artificial Intelligence has transformed academic research and automated document analysis.")
        
        # Save file to disk
        stored_filename = "test_text_doc.pdf"
        file_path = self.upload_folder / stored_filename
        with open(file_path, "wb") as f:
            f.write(pdf_stream.getvalue())

        doc = Document(
            user_id=self.user.id,
            original_filename="AI_Research.pdf",
            stored_filename=stored_filename,
            file_size=file_path.stat().st_size
        )
        db.session.add(doc)
        db.session.commit()

        success, msg = process_pdf_document(doc, str(file_path))
        self.assertTrue(success)
        self.assertEqual(doc.processing_status, 'processed')
        self.assertEqual(doc.page_count, 1)

        # Chunks should be saved
        chunks = DocumentChunk.query.filter_by(document_id=doc.id).all()
        self.assertTrue(len(chunks) > 0)
        self.assertIn("Artificial Intelligence", chunks[0].extracted_text)

    def test_process_scanned_pdf_detects_ocr_required(self):
        # PDF with no text layer
        pdf_stream = create_scanned_mock_pdf()
        stored_filename = "test_scanned_doc.pdf"
        file_path = self.upload_folder / stored_filename
        with open(file_path, "wb") as f:
            f.write(pdf_stream.getvalue())

        doc = Document(
            user_id=self.user.id,
            original_filename="Scanned_Invoice.pdf",
            stored_filename=stored_filename,
            file_size=file_path.stat().st_size
        )
        db.session.add(doc)
        db.session.commit()

        success, msg = process_pdf_document(doc, str(file_path))
        self.assertTrue(success)
        self.assertEqual(doc.processing_status, 'ocr_required')
        self.assertIn("OCR", doc.error_message)

    def test_delete_document_cleans_up(self):
        pdf_stream = create_sample_pdf("Document to be deleted.")
        stored_filename = "doc_to_delete.pdf"
        file_path = self.upload_folder / stored_filename
        with open(file_path, "wb") as f:
            f.write(pdf_stream.getvalue())

        doc = Document(
            user_id=self.user.id,
            original_filename="to_delete.pdf",
            stored_filename=stored_filename,
            file_size=file_path.stat().st_size
        )
        db.session.add(doc)
        db.session.commit()

        process_pdf_document(doc, str(file_path))
        self.assertTrue(file_path.exists())

        # Delete
        delete_document_files(doc, self.upload_folder)
        db.session.delete(doc)
        db.session.commit()

        self.assertFalse(file_path.exists())
        self.assertEqual(DocumentChunk.query.filter_by(document_id=doc.id).count(), 0)

if __name__ == '__main__':
    unittest.main()
