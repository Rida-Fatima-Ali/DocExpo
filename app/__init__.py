import os
import logging
from pathlib import Path
from flask import Flask, render_template, jsonify, g, request
from app.extensions import db
from config import Config

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
logger = logging.getLogger('documind')

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Ensure uploads and instance directories exist
    upload_folder = Path(app.config['UPLOAD_FOLDER'])
    upload_folder.mkdir(parents=True, exist_ok=True)
    instance_folder = Path(app.root_path).parent / 'instance'
    instance_folder.mkdir(parents=True, exist_ok=True)
    
    # Initialize SQLAlchemy
    db.init_app(app)
    
    # Import models so that db.metadata is populated
    from app.models import User, Document, DocumentChunk, Conversation, Message, MessageSource, Summary
    
    with app.app_context():
        db.create_all()
        logger.info(f"Database initialized with URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
            
    # Register blueprints
    from app.auth.routes import auth_bp
    from app.dashboard.routes import dashboard_bp
    from app.documents.routes import documents_bp
    from app.chat.routes import chat_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(chat_bp)
    
    # Context processor
    @app.context_processor
    def inject_global_data():
        return {
            'current_user': getattr(g, 'user', None),
            'app_name': 'DocExpo',
            'app_tagline': 'Your documents. Understood.'
        }
        
    # Error handlers
    @app.errorhandler(404)
    def not_found_error(error):
        if request.is_json or request.path.startswith('/api/'):
            return jsonify({'error': 'The requested resource was not found.'}), 404
        return render_template('base.html', error_title='404 Not Found', error_message='The page you are looking for does not exist.'), 404

    @app.errorhandler(403)
    def forbidden_error(error):
        if request.is_json or request.path.startswith('/api/'):
            return jsonify({'error': 'You do not have permission to access this resource.'}), 403
        return render_template('base.html', error_title='403 Forbidden', error_message='Access to this resource is denied.'), 403

    @app.errorhandler(413)
    def request_entity_too_large(error):
        return jsonify({'error': 'Uploaded file exceeds the maximum allowed limit (32MB).'}), 413

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        if request.is_json or request.path.startswith('/api/'):
            return jsonify({'error': 'An internal server error occurred.'}), 500
        return render_template('base.html', error_title='500 Server Error', error_message='A server error occurred. Please try again shortly.'), 500

    return app
