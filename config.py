import os
import socket
from pathlib import Path
from dotenv import load_dotenv

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent

# Load environment variables from .env file if it exists
load_dotenv(BASE_DIR / ".env")

def resolve_database_uri():
    """
    Intelligently resolves the database URI.
    Checks for configured DATABASE_URL, tests MySQL availability on host/port,
    and seamlessly provides an absolute SQLite URI fallback.
    """
    env_db_url = os.environ.get("DATABASE_URL")
    sqlite_abs_path = (BASE_DIR / "instance" / "documind.db").as_posix()
    
    # If explicitly set to SQLite or relative path, ensure absolute path
    if env_db_url and "sqlite:" in env_db_url:
        return f"sqlite:///{sqlite_abs_path}"
        
    mysql_user = os.environ.get("MYSQL_USER", "root")
    mysql_password = os.environ.get("MYSQL_PASSWORD", "")
    mysql_host = os.environ.get("MYSQL_HOST", "localhost")
    mysql_port = int(os.environ.get("MYSQL_PORT", 3306))
    mysql_db = os.environ.get("MYSQL_DB", "documind")
    
    mysql_uri = env_db_url or f"mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_db}"
    
    # Test if MySQL port is responding
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.5)
    try:
        sock.connect((mysql_host, mysql_port))
        sock.close()
        return mysql_uri
    except Exception:
        # Fallback to local SQLite database
        return f"sqlite:///{sqlite_abs_path}"

class Config:
    """Base application configuration."""
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "documind-dev-secret-key-3914a8b72e50")
    
    # Database configuration: MySQL supported, with SQLite development fallback
    SQLALCHEMY_DATABASE_URI = resolve_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Upload configuration
    UPLOAD_FOLDER = BASE_DIR / "uploads"
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", 32 * 1024 * 1024))  # 32 MB
    ALLOWED_EXTENSIONS = {"pdf"}
    
    # AI Engine configuration
    AI_PROVIDER = os.environ.get("AI_PROVIDER", "gemini").lower()
    AI_API_KEY = os.environ.get("AI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
    AI_MODEL = os.environ.get("AI_MODEL", "gemini-2.5-flash" if os.environ.get("AI_PROVIDER", "gemini").lower() == "gemini" else "gpt-4o-mini")
    
    # Session security
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    PERMANENT_SESSION_LIFETIME = 86400 * 7  # 7 days

class TestingConfig(Config):
    """Configuration for automated test suite."""
    TESTING = True
    WTF_CSRF_ENABLED = False
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{(BASE_DIR / 'instance' / 'test_documind.db').as_posix()}"
    UPLOAD_FOLDER = BASE_DIR / "uploads" / "test_uploads"
