from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db

def utc_now():
    return datetime.now(timezone.utc)

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    theme_preference = db.Column(db.String(20), default='warm') # 'warm', 'light', 'dark'
    created_at = db.Column(db.DateTime, default=utc_now)
    
    # Relationships
    documents = db.relationship('Document', backref='owner', lazy='dynamic', cascade='all, delete-orphan')
    conversations = db.relationship('Conversation', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    summaries = db.relationship('Summary', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    
    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)
        
    def to_dict(self):
        return {
            'id': self.id,
            'full_name': self.full_name,
            'email': self.email,
            'theme_preference': self.theme_preference,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Document(db.Model):
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    original_filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), unique=True, nullable=False)
    file_size = db.Column(db.Integer, nullable=False) # In bytes
    page_count = db.Column(db.Integer, default=0)
    processing_status = db.Column(db.String(30), default='pending') # pending, processing, processed, ocr_required, error
    error_message = db.Column(db.Text, nullable=True)
    uploaded_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)
    
    # Relationships
    chunks = db.relationship('DocumentChunk', backref='document', lazy='dynamic', cascade='all, delete-orphan')
    conversations = db.relationship('Conversation', backref='document', lazy='dynamic', cascade='all, delete-orphan')
    summaries = db.relationship('Summary', backref='document', lazy='dynamic', cascade='all, delete-orphan')
    
    @property
    def formatted_size(self):
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}" if unit != 'B' else f"{size} B"
            size /= 1024.0
        return f"{size:.1f} TB"

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'original_filename': self.original_filename,
            'stored_filename': self.stored_filename,
            'file_size': self.file_size,
            'formatted_size': self.formatted_size,
            'page_count': self.page_count,
            'processing_status': self.processing_status,
            'error_message': self.error_message,
            'chunk_count': self.chunks.count() if hasattr(self, 'chunks') else 0,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class DocumentChunk(db.Model):
    __tablename__ = 'document_chunks'
    
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True)
    chunk_index = db.Column(db.Integer, nullable=False)
    page_number = db.Column(db.Integer, nullable=False) # 1-indexed page
    extracted_text = db.Column(db.Text, nullable=False)
    char_count = db.Column(db.Integer, default=0)
    
    sources = db.relationship('MessageSource', backref='chunk', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'chunk_index': self.chunk_index,
            'page_number': self.page_number,
            'extracted_text': self.extracted_text,
            'char_count': self.char_count
        }

class Conversation(db.Model):
    __tablename__ = 'conversations'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True)
    title = db.Column(db.String(255), default='Document Discussion')
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)
    
    messages = db.relationship('Message', backref='conversation', lazy='dynamic', cascade='all, delete-orphan', order_by='Message.created_at.asc()')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'document_id': self.document_id,
            'title': self.title,
            'message_count': self.messages.count(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Message(db.Model):
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False) # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now)
    
    sources = db.relationship('MessageSource', backref='message', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'role': self.role,
            'content': self.content,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'sources': [s.to_dict() for s in self.sources]
        }

class MessageSource(db.Model):
    __tablename__ = 'message_sources'
    
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('messages.id', ondelete='CASCADE'), nullable=False, index=True)
    document_chunk_id = db.Column(db.Integer, db.ForeignKey('document_chunks.id', ondelete='SET NULL'), nullable=True)
    source_page = db.Column(db.Integer, nullable=False)
    relevant_excerpt = db.Column(db.Text, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'message_id': self.message_id,
            'document_chunk_id': self.document_chunk_id,
            'source_page': self.source_page,
            'relevant_excerpt': self.relevant_excerpt
        }

class Summary(db.Model):
    __tablename__ = 'summaries'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True)
    summary_type = db.Column(db.String(50), nullable=False) # quick, detailed, key_points, study_notes, revision_questions
    summary_content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'document_id': self.document_id,
            'summary_type': self.summary_type,
            'summary_content': self.summary_content,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
