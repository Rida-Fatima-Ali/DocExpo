import logging
from flask import current_app
from app.extensions import db
from app.models.models import Document, Conversation, Message, MessageSource
from app.ai.retrieval import DocumentRetriever
from app.ai.provider import get_ai_provider

logger = logging.getLogger(__name__)

class ChatService:
    """Orchestrates document RAG chat, source citations, and conversation history."""
    
    @classmethod
    def process_chat_message(cls, document_id: int, user_id: int, question: str, conversation_id: int = None) -> dict:
        question = question.strip()
        if not question:
            raise ValueError("Question cannot be empty.")
            
        # Verify document exists and belongs to user
        doc = Document.query.filter_by(id=document_id, user_id=user_id).first()
        if not doc:
            raise ValueError("Document not found or access denied.")
            
        if doc.processing_status != 'processed':
            raise ValueError(f"Document is not ready for querying (status: {doc.processing_status}).")
            
        # Get or create conversation
        if conversation_id:
            conv = Conversation.query.filter_by(id=conversation_id, user_id=user_id, document_id=doc.id).first()
            if not conv:
                raise ValueError("Conversation not found.")
        else:
            title = question[:50] + ("..." if len(question) > 50 else "")
            conv = Conversation(
                user_id=user_id,
                document_id=doc.id,
                title=title
            )
            db.session.add(conv)
            db.session.flush()
            
        # Fetch recent conversation history
        recent_messages = Message.query.filter_by(conversation_id=conv.id).order_by(Message.created_at.desc()).limit(6).all()
        history = [
            {"role": m.role, "content": m.content}
            for m in reversed(recent_messages)
        ]
        
        # Save user message
        user_msg = Message(
            conversation_id=conv.id,
            role='user',
            content=question
        )
        db.session.add(user_msg)
        db.session.flush()
        
        # 1. Retrieve relevant chunks
        retrieved_chunks = DocumentRetriever.retrieve(document_id=doc.id, query=question, top_k=4)
        
        # 2. Query AI Provider
        ai_provider = get_ai_provider(current_app.config)
        try:
            answer_text, sources_used = ai_provider.generate_chat_answer(
                question=question,
                context_chunks=retrieved_chunks,
                conversation_history=history
            )
        except Exception as e:
            logger.error(f"AI response generation failed: {e}")
            answer_text = (
                "An error occurred while generating an answer with the AI provider. "
                "However, you can still view the retrieved document passages below."
            )
            sources_used = retrieved_chunks
            
        # 3. Save assistant message
        assistant_msg = Message(
            conversation_id=conv.id,
            role='assistant',
            content=answer_text
        )
        db.session.add(assistant_msg)
        db.session.flush()
        
        # 4. Attach MessageSources with exact page numbers and excerpts
        saved_sources = []
        for chunk_data in sources_used:
            source_rec = MessageSource(
                message_id=assistant_msg.id,
                document_chunk_id=chunk_data.get('chunk_id'),
                source_page=chunk_data.get('page_number', 1),
                relevant_excerpt=chunk_data.get('excerpt', chunk_data.get('text', '')[:200])
            )
            db.session.add(source_rec)
            saved_sources.append({
                'source_page': source_rec.source_page,
                'relevant_excerpt': source_rec.relevant_excerpt,
                'chunk_id': source_rec.document_chunk_id
            })
            
        db.session.commit()
        
        return {
            'conversation_id': conv.id,
            'user_message': user_msg.to_dict(),
            'assistant_message': {
                'id': assistant_msg.id,
                'role': 'assistant',
                'content': assistant_msg.content,
                'created_at': assistant_msg.created_at.isoformat(),
                'sources': saved_sources
            }
        }
