import re
from functools import wraps
from flask import Blueprint, request, jsonify, session, render_template, redirect, url_for, g
from app.extensions import db
from app.models.models import User

auth_bp = Blueprint('auth', __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized. Please sign in to continue.'}), 401
            return redirect(url_for('auth.login_page', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

@auth_bp.before_app_request
def load_logged_in_user():
    user_id = session.get('user_id')
    if user_id is None:
        g.user = None
    else:
        g.user = db.session.get(User, user_id)

@auth_bp.route('/login', methods=['GET'])
def login_page():
    if g.user:
        return redirect(url_for('dashboard.dashboard_page'))
    return render_template('login.html')

@auth_bp.route('/register', methods=['GET'])
def register_page():
    if g.user:
        return redirect(url_for('dashboard.dashboard_page'))
    return render_template('register.html')

@auth_bp.route('/logout', methods=['GET', 'POST'])
@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    g.user = None
    if request.is_json or (request.path.startswith('/api/') and request.method == 'POST'):
        return jsonify({'message': 'Logged out successfully.'}), 200
    return redirect(url_for('dashboard.index'))

@auth_bp.route('/api/auth/register', methods=['POST'])
def api_register():
    data = request.get_json() or {}
    full_name = (data.get('full_name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    confirm_password = data.get('confirm_password')
    if confirm_password is None:
        confirm_password = data.get('confirmPassword')
    if confirm_password is None:
        confirm_password = password
        
    # Server-side validation
    if not full_name:
        return jsonify({'error': 'Full name is required.'}), 400
    if len(full_name) < 2 or len(full_name) > 100:
        return jsonify({'error': 'Full name must be between 2 and 100 characters.'}), 400
        
    email_regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    if not email or not re.match(email_regex, email):
        return jsonify({'error': 'Please provide a valid email address.'}), 400
        
    if not password or len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long.'}), 400
        
    if password != confirm_password:
        return jsonify({'error': 'Passwords do not match.'}), 400
        
    # Check duplicate email
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'An account with this email address already exists.'}), 409
        
    new_user = User(full_name=full_name, email=email)
    new_user.set_password(password)
    
    db.session.add(new_user)
    db.session.commit()
    
    # Set session
    session['user_id'] = new_user.id
    session.permanent = True
    
    return jsonify({
        'message': 'Registration successful.',
        'user': new_user.to_dict()
    }), 201

@auth_bp.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400
        
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password.'}), 401
        
    session['user_id'] = user.id
    session.permanent = True
    
    return jsonify({
        'message': 'Login successful.',
        'user': user.to_dict()
    }), 200

@auth_bp.route('/api/auth/me', methods=['GET'])
@login_required
def api_me():
    return jsonify({'user': g.user.to_dict()}), 200

@auth_bp.route('/api/auth/change-password', methods=['POST'])
@login_required
def api_change_password():
    data = request.get_json() or {}
    current_password = data.get('current_password') or ''
    new_password = data.get('new_password') or ''
    confirm_new_password = data.get('confirm_new_password') or ''
    
    if not g.user.check_password(current_password):
        return jsonify({'error': 'Current password is incorrect.'}), 400
        
    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters long.'}), 400
        
    if new_password != confirm_new_password:
        return jsonify({'error': 'New passwords do not match.'}), 400
        
    g.user.set_password(new_password)
    db.session.commit()
    
    return jsonify({'message': 'Password updated successfully.'}), 200

@auth_bp.route('/api/auth/theme', methods=['POST'])
@login_required
def api_theme():
    data = request.get_json() or {}
    theme = data.get('theme', 'warm')
    if theme in ['warm', 'light', 'dark']:
        g.user.theme_preference = theme
        db.session.commit()
        return jsonify({'message': 'Theme updated.', 'theme': theme}), 200
    return jsonify({'error': 'Invalid theme option.'}), 400
