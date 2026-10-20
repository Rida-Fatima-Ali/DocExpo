from pathlib import Path
from flask import Blueprint, request, jsonify, render_template, current_app, g, send_file, abort
from app.extensions import db
from app.auth.routes import login_required
from app.models.models import Document, Summary, Conversation
from app.documents.services import (
    validate_pdf_file,
    save_uploaded_pdf,
    process_pdf_document,
    delete_document_files
)
from app.ai.summarizer import DocumentSummarizer

documents_bp = Blueprint('documents', __name__)

@documents_bp.route('/documents', methods=['GET'])
@login_required
def documents_page():
    return render_template('documents.html', user=g.user)

@documents_bp.route('/documents/<int:document_id>', methods=['GET'])
@login_required
def workspace_page(document_id):
    doc = Document.query.filter_by(id=document_id, user_id=g.user.id).first_or_404()
    return render_template('document_workspace.html', user=g.user, document=doc)

@documents_bp.route('/documents/<int:document_id>/file', methods=['GET'])
@login_required
def download_pdf_file(document_id):
    doc = Document.query.filter_by(id=document_id, user_id=g.user.id).first_or_404()
    upload_folder = Path(current_app.config['UPLOAD_FOLDER'])
    file_path = upload_folder / doc.stored_filename
    
    if not file_path.exists():
        abort(404, description="PDF file not found on disk.")
        
    return send_file(
        str(file_path),
        mimetype='application/pdf',
        as_attachment=request.args.get('download') == 'true',
        download_name=doc.original_filename
    )

@documents_bp.route('/api/documents/upload', methods=['POST'])
@login_required
def api_upload_document():
    if 'file' not in request.files:
        return jsonify({'error': 'No file was provided in the upload request.'}), 400
        
    file_storage = request.files['file']
    if not file_storage or not file_storage.filename:
        return jsonify({'error': 'Please select a valid PDF file to upload.'}), 400
        
    original_filename = file_storage.filename
    
    # PDF signature & extension validation
    is_valid, error_msg = validate_pdf_file(file_storage.stream, original_filename)
    if not is_valid:
        return jsonify({'error': error_msg}), 400
        
    upload_folder = Path(current_app.config['UPLOAD_FOLDER'])
    
    try:
        stored_filename, secure_path, file_size = save_uploaded_pdf(file_storage, upload_folder)
    except Exception as e:
        return jsonify({'error': f"Failed to save file: {str(e)}"}), 500
        
    # Check max file size
    max_size = current_app.config.get('MAX_CONTENT_LENGTH', 32 * 1024 * 1024)
    if file_size > max_size:
        # Clean up oversized file
        Path(secure_path).unlink(missing_ok=True)
        return jsonify({'error': f"File exceeds maximum allowed size ({max_size // (1024*1024)} MB)."}), 400
        
    # Create DB entry
    doc = Document(
        user_id=g.user.id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_size=file_size,
        processing_status='pending'
    )
    db.session.add(doc)
    db.session.commit()
    
    # Genuine PyMuPDF text extraction & chunking
    success, msg = process_pdf_document(doc, secure_path)
    
    return jsonify({
        'message': msg,
        'document': doc.to_dict()
    }), 201

@documents_bp.route('/api/documents', methods=['GET'])
@login_required
def api_get_documents():
    query = Document.query.filter_by(user_id=g.user.id)
    
    search = request.args.get('search', '').strip()
    if search:
        query = query.filter(Document.original_filename.ilike(f"%{search}%"))
        
    status = request.args.get('status', '').strip()
    if status:
        query = query.filter_by(processing_status=status)
        
    sort_by = request.args.get('sort', 'date_desc')
    if sort_by == 'date_asc':
        query = query.order_by(Document.uploaded_at.asc())
    elif sort_by == 'name_asc':
        query = query.order_by(Document.original_filename.asc())
    elif sort_by == 'name_desc':
        query = query.order_by(Document.original_filename.desc())
    elif sort_by == 'size_desc':
        query = query.order_by(Document.file_size.desc())
    else:
        query = query.order_by(Document.uploaded_at.desc())
        
    docs = query.all()
    return jsonify({
        'documents': [d.to_dict() for d in docs]
    }), 200

@documents_bp.route('/api/documents/<int:document_id>', methods=['GET'])
@login_required
def api_get_document(document_id):
    doc = Document.query.filter_by(id=document_id, user_id=g.user.id).first_or_404()
    conversations = Conversation.query.filter_by(document_id=doc.id, user_id=g.user.id).order_by(Conversation.updated_at.desc()).all()
    summaries = Summary.query.filter_by(document_id=doc.id, user_id=g.user.id).order_by(Summary.created_at.desc()).all()
    
    data = doc.to_dict()
    data['conversations'] = [c.to_dict() for c in conversations]
    data['summaries'] = [s.to_dict() for s in summaries]
    return jsonify({'document': data}), 200

@documents_bp.route('/api/documents/<int:document_id>', methods=['DELETE'])
@login_required
def api_delete_document(document_id):
    doc = Document.query.filter_by(id=document_id, user_id=g.user.id).first_or_404()
    upload_folder = Path(current_app.config['UPLOAD_FOLDER'])
    
    delete_document_files(doc, upload_folder)
    
    db.session.delete(doc)
    db.session.commit()
    
    return jsonify({'message': 'Document and all associated data deleted successfully.'}), 200

@documents_bp.route('/api/documents/<int:document_id>/summarize', methods=['POST'])
@login_required
def api_summarize_document(document_id):
    data = request.get_json() or {}
    summary_type = data.get('summary_type', 'quick')
    
    try:
        summary = DocumentSummarizer.generate_document_summary(
            document_id=document_id,
            user_id=g.user.id,
            summary_type=summary_type
        )
        return jsonify({
            'message': 'Summary generated successfully.',
            'summary': summary.to_dict()
        }), 201
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'error': f"Failed to generate summary: {str(e)}"}), 500

@documents_bp.route('/api/documents/<int:document_id>/summaries', methods=['GET'])
@login_required
def api_get_document_summaries(document_id):
    doc = Document.query.filter_by(id=document_id, user_id=g.user.id).first_or_404()
    summaries = Summary.query.filter_by(document_id=doc.id, user_id=g.user.id).order_by(Summary.created_at.desc()).all()
    return jsonify({'summaries': [s.to_dict() for s in summaries]}), 200

@documents_bp.route('/api/summaries/<int:summary_id>', methods=['GET'])
@login_required
def api_get_summary(summary_id):
    summary = Summary.query.filter_by(id=summary_id, user_id=g.user.id).first_or_404()
    return jsonify({'summary': summary.to_dict()}), 200
