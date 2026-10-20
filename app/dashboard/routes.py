from flask import Blueprint, render_template, jsonify, g, redirect, url_for
from sqlalchemy import func
from app.extensions import db
from app.auth.routes import login_required
from app.models.models import Document, Conversation, Summary

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/', methods=['GET'])
def index():
    return render_template('landing.html')

@dashboard_bp.route('/dashboard', methods=['GET'])
@login_required
def dashboard_page():
    return render_template('dashboard.html', user=g.user)

@dashboard_bp.route('/settings', methods=['GET'])
@login_required
def settings_page():
    # Calculate storage footprint
    total_bytes = db.session.query(func.coalesce(func.sum(Document.file_size), 0)).filter(Document.user_id == g.user.id).scalar()
    doc_count = Document.query.filter_by(user_id=g.user.id).count()
    
    # Format size
    mb_used = total_bytes / (1024 * 1024)
    storage_str = f"{mb_used:.2f} MB"
    
    return render_template(
        'settings.html',
        user=g.user,
        storage_str=storage_str,
        doc_count=doc_count
    )

@dashboard_bp.route('/api/dashboard/stats', methods=['GET'])
@login_required
def api_dashboard_stats():
    total_docs = Document.query.filter_by(user_id=g.user.id).count()
    total_convs = Conversation.query.filter_by(user_id=g.user.id).count()
    total_summaries = Summary.query.filter_by(user_id=g.user.id).count()
    
    total_pages = db.session.query(func.coalesce(func.sum(Document.page_count), 0)).filter(
        Document.user_id == g.user.id,
        Document.processing_status == 'processed'
    ).scalar()
    
    total_bytes = db.session.query(func.coalesce(func.sum(Document.file_size), 0)).filter(
        Document.user_id == g.user.id
    ).scalar()
    
    return jsonify({
        'stats': {
            'total_documents': total_docs,
            'total_conversations': total_convs,
            'total_summaries': total_summaries,
            'total_pages_processed': int(total_pages),
            'total_storage_bytes': int(total_bytes)
        }
    }), 200

@dashboard_bp.route('/api/dashboard/recent', methods=['GET'])
@login_required
def api_dashboard_recent():
    recent_docs = Document.query.filter_by(user_id=g.user.id).order_by(Document.uploaded_at.desc()).limit(5).all()
    recent_summaries = Summary.query.filter_by(user_id=g.user.id).order_by(Summary.created_at.desc()).limit(5).all()
    recent_convs = Conversation.query.filter_by(user_id=g.user.id).order_by(Conversation.updated_at.desc()).limit(5).all()
    
    summaries_data = []
    for s in recent_summaries:
        doc = db.session.get(Document, s.document_id)
        s_dict = s.to_dict()
        s_dict['document_name'] = doc.original_filename if doc else 'Deleted Document'
        summaries_data.append(s_dict)
        
    convs_data = []
    for c in recent_convs:
        doc = db.session.get(Document, c.document_id)
        c_dict = c.to_dict()
        c_dict['document_name'] = doc.original_filename if doc else 'Deleted Document'
        convs_data.append(c_dict)
        
    return jsonify({
        'recent_documents': [d.to_dict() for d in recent_docs],
        'recent_summaries': summaries_data,
        'recent_conversations': convs_data
    }), 200
