from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.auth.routes import login_required
from app.models.models import Conversation, Message, Document
from app.chat.services import ChatService

chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/api/documents/<int:document_id>/chat', methods=['POST'])
@login_required
def api_document_chat(document_id):
    data = request.get_json() or {}
    question = (data.get('question') or '').strip()
    conversation_id = data.get('conversation_id')
    
    if not question:
        return jsonify({'error': 'Question cannot be empty.'}), 400
        
    try:
        result = ChatService.process_chat_message(
            document_id=document_id,
            user_id=g.user.id,
            question=question,
            conversation_id=conversation_id
        )
        return jsonify(result), 200
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'error': f"Failed to process chat request: {str(e)}"}), 500

@chat_bp.route('/api/conversations', methods=['GET'])
@login_required
def api_get_conversations():
    document_id = request.args.get('document_id')
    query = Conversation.query.filter_by(user_id=g.user.id)
    if document_id:
        query = query.filter_by(document_id=document_id)
        
    conversations = query.order_by(Conversation.updated_at.desc()).all()
    return jsonify({'conversations': [c.to_dict() for c in conversations]}), 200

@chat_bp.route('/api/conversations/<int:conversation_id>', methods=['GET'])
@login_required
def api_get_conversation(conversation_id):
    conv = Conversation.query.filter_by(id=conversation_id, user_id=g.user.id).first_or_404()
    messages = Message.query.filter_by(conversation_id=conv.id).order_by(Message.created_at.asc()).all()
    
    data = conv.to_dict()
    data['messages'] = [m.to_dict() for m in messages]
    return jsonify({'conversation': data}), 200

@chat_bp.route('/api/conversations', methods=['POST'])
@login_required
def api_create_conversation():
    data = request.get_json() or {}
    document_id = data.get('document_id')
    title = (data.get('title') or 'New Discussion').strip()
    
    if not document_id:
        return jsonify({'error': 'document_id is required.'}), 400
        
    doc = Document.query.filter_by(id=document_id, user_id=g.user.id).first_or_404()
    
    conv = Conversation(
        user_id=g.user.id,
        document_id=doc.id,
        title=title
    )
    db.session.add(conv)
    db.session.commit()
    
    return jsonify({'conversation': conv.to_dict()}), 201

@chat_bp.route('/api/conversations/<int:conversation_id>', methods=['DELETE'])
@login_required
def api_delete_conversation(conversation_id):
    conv = Conversation.query.filter_by(id=conversation_id, user_id=g.user.id).first_or_404()
    db.session.delete(conv)
    db.session.commit()
    return jsonify({'message': 'Conversation deleted successfully.'}), 200
