import unittest
from config import TestingConfig
from app import create_app
from app.extensions import db
from app.models.models import User, Document, DocumentChunk, Summary, MessageSource
from app.ai.retrieval import DocumentRetriever
from app.ai.summarizer import DocumentSummarizer
from app.chat.services import ChatService

class RAGAndSummaryTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestingConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Create user
        self.user = User(full_name="RAG Tester", email="rag@documind.io")
        self.user.set_password("password123")
        db.session.add(self.user)
        db.session.commit()

        # Create processed document with distinct chunks
        self.doc = Document(
            user_id=self.user.id,
            original_filename="Quantum_Computing_Overview.pdf",
            stored_filename="qc_doc.pdf",
            file_size=2048,
            page_count=3,
            processing_status='processed'
        )
        db.session.add(self.doc)
        db.session.commit()

        # Add chunks across pages
        c1 = DocumentChunk(
            document_id=self.doc.id,
            chunk_index=0,
            page_number=1,
            extracted_text="Quantum computing leverages qubits which can exist in superposition states of zero and one.",
            char_count=92
        )
        c2 = DocumentChunk(
            document_id=self.doc.id,
            chunk_index=1,
            page_number=2,
            extracted_text="Quantum entanglement enables correlations between qubits across spatial distances, powering quantum teleportation.",
            char_count=115
        )
        c3 = DocumentChunk(
            document_id=self.doc.id,
            chunk_index=2,
            page_number=3,
            extracted_text="Quantum error correction algorithms protect fragile quantum information against environmental decoherence.",
            char_count=107
        )
        db.session.add_all([c1, c2, c3])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_document_retriever_bm25(self):
        # Query for entanglement
        results = DocumentRetriever.retrieve(self.doc.id, "entanglement correlations teleportation", top_k=2)
        self.assertTrue(len(results) > 0)
        top = results[0]
        self.assertEqual(top['page_number'], 2)
        self.assertIn("entanglement", top['text'].lower())
        self.assertTrue(len(top['excerpt']) > 0)

        # Query for error correction
        results2 = DocumentRetriever.retrieve(self.doc.id, "decoherence and error correction", top_k=2)
        self.assertTrue(len(results2) > 0)
        self.assertEqual(results2[0]['page_number'], 3)

    def test_chat_service_and_source_grounding(self):
        res = ChatService.process_chat_message(
            document_id=self.doc.id,
            user_id=self.user.id,
            question="What is superposition in quantum computing?"
        )
        self.assertIn('conversation_id', res)
        self.assertIn('assistant_message', res)
        assistant_msg = res['assistant_message']
        self.assertIsNotNone(assistant_msg['content'])

        # Verify sources
        sources = assistant_msg['sources']
        self.assertTrue(len(sources) > 0)
        self.assertEqual(sources[0]['source_page'], 1)
        self.assertIn("superposition", sources[0]['relevant_excerpt'].lower())

        # Verify in DB
        db_sources = MessageSource.query.filter_by(message_id=assistant_msg['id']).all()
        self.assertTrue(len(db_sources) > 0)

    def test_summary_generation_all_types(self):
        types = ['quick', 'detailed', 'key_points', 'study_notes', 'revision_questions']
        for t in types:
            summary = DocumentSummarizer.generate_document_summary(
                document_id=self.doc.id,
                user_id=self.user.id,
                summary_type=t
            )
            self.assertIsNotNone(summary)
            self.assertEqual(summary.summary_type, t)
            self.assertTrue(len(summary.summary_content) > 30)

            # Saved in DB
            db_s = Summary.query.filter_by(id=summary.id).first()
            self.assertIsNotNone(db_s)
            self.assertEqual(db_s.user_id, self.user.id)

    def test_unauthorized_document_chat(self):
        other_user = User(full_name="Other User", email="other@documind.io")
        other_user.set_password("pass123")
        db.session.add(other_user)
        db.session.commit()

        # Other user tries to chat with user's document
        with self.assertRaises(ValueError):
            ChatService.process_chat_message(
                document_id=self.doc.id,
                user_id=other_user.id,
                question="Tell me about this document"
            )

if __name__ == '__main__':
    unittest.main()
