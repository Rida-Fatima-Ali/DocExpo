# DocExpo — AI Document Intelligence Platform

> **Your documents. Finally understood.**

DocExpo is an AI-powered document intelligence and PDF question-answering web platform built for college students, researchers, academics, and professionals who work with lengthy, complex documents.

It enables users to upload PDF documents, extract contents with genuine page-by-page precision using PyMuPDF, generate grounded AI summaries across multiple academic formats, and chat with documents with real citations and excerpt tracking.

---

## Key Features

1. **Grounded Document Question-Answering (RAG)**
   - Ask complex questions about any uploaded PDF.
   - Powered by a BM25 / TF-IDF hybrid retrieval engine that indexes structured chunks.
   - Answers are strictly grounded in retrieved passages; if the evidence cannot be found, the system clearly states it cannot locate the answer.
   - Treats document content as untrusted data to guard against prompt injection attacks.

2. **Genuine Source Transparency & Citations**
   - Clickable source pills displaying exact page references (e.g. `Page 4`).
   - Dedicated side-drawer displaying citation previews with verbatim matching excerpts.

3. **Multi-Format AI Summarization**
   - **Quick Summary**: Concise 1–2 paragraph executive overview.
   - **Detailed Summary**: Section-by-section breakdown of arguments.
   - **Key Points**: High-signal bulleted takeaways and definitions.
   - **Study Notes**: Student-friendly notes with headings, core definitions, and memory aids.
   - **Questions for Revision**: Exam-preparation questions with answers.
   - **Hierarchical Summarization**: Automatically sections large documents to summarize without silent truncation.

4. **High-Precision PDF Processing & Validation**
   - Direct extraction via PyMuPDF (`pymupdf`).
   - Cryptographically unique UUID4 storage in protected, non-static directories.
   - Magic byte header (`%PDF-`) and extension validation.
   - Scanned PDF detection: Identifies image-only / raster PDFs and flags them as `ocr_required` with clear user feedback rather than pretending text was extracted.

5. **Personal Library & Workspace**
   - Full document management: instant search, status filtering (Ready, Scanned/OCR, Error), and sorting (Newest, Oldest, A-Z, Size).
   - Conversation history persistence and multi-thread support.
   - Complete document deletion cascade (cleans up physical files, chunks, conversations, messages, sources, and summaries).

6. **Enterprise-Grade Architecture & Design System**
   - Editorial, warm minimalist aesthetic (`#F7F7F5` foundation, `#6758E8` brand accent).
   - Responsive multi-panel workspace (document metadata, central chat, and source drawer).
   - Multi-theme support: Warm Neutral (default), Crisp Light, and Midnight Dark.
   - Zero generic AI dashboard clutter; uses SVG icons, real database statistics, and smooth transitions.

---

## Technology Stack

- **Frontend**: HTML5, Modern CSS3 (CSS Custom Properties, Flexbox, CSS Grid), Vanilla JavaScript, SVG icon system.
- **Backend**: Python 3.10+, Flask 3+, SQLAlchemy ORM.
- **Database**:
  - **MySQL**: Supported via PyMySQL / MySQL Connector.
  - **SQLite**: Built-in zero-configuration development fallback if MySQL is offline.
- **PDF Extraction**: PyMuPDF (`pymupdf`).
- **AI Engine**: Provider-independent architecture supporting:
  - Google Gemini API (`gemini-2.5-flash`, etc.)
  - OpenAI API (`gpt-4o-mini`, etc.)
  - Built-in Local Extractive Fallback (delivers grounded answers and citations even without an external API key).

---

## Project Structure

```
documind/
├── run.py                     # Primary entry point
├── app.py                     # WSGI / development alias
├── config.py                  # Multi-environment configuration
├── requirements.txt           # Python dependencies
├── .env.example               # Environment variables template
├── .gitignore                 # Version control exclusions
├── README.md                  # System documentation
│
├── app/
│   ├── __init__.py            # Application factory with SQLite fallback resilience
│   ├── extensions.py          # SQLAlchemy instance
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py          # User, Document, DocumentChunk, Conversation, Message, MessageSource, Summary
│   │
│   ├── auth/
│   │   ├── __init__.py
│   │   └── routes.py          # Session authentication, login, register, password change
│   │
│   ├── dashboard/
│   │   ├── __init__.py
│   │   └── routes.py          # Dashboard view, landing page, real DB statistics
│   │
│   ├── documents/
│   │   ├── __init__.py
│   │   ├── routes.py          # Uploads, library, secure PDF download
│   │   └── services.py        # PyMuPDF extraction, validation, chunking, file cleanup
│   │
│   ├── chat/
│   │   ├── __init__.py
│   │   ├── routes.py          # Conversational endpoints and history
│   │   └── services.py        # RAG pipeline orchestration & citation linking
│   │
│   ├── ai/
│   │   ├── __init__.py
│   │   ├── provider.py        # Gemini, OpenAI, and local extractive fallback providers
│   │   ├── summarizer.py      # 5 summary modes + hierarchical chunking
│   │   └── retrieval.py       # BM25 / TF-IDF scoring and excerpt extractor
│   │
│   ├── templates/
│   │   ├── base.html          # Semantic HTML5 base layout, nav, theme selector
│   │   ├── landing.html       # Public landing page with interface preview
│   │   ├── login.html         # User sign-in
│   │   ├── register.html      # User sign-up
│   │   ├── dashboard.html     # User dashboard with drag-and-drop uploader
│   │   ├── documents.html     # Document library, search, filters, delete modal
│   │   ├── document_workspace.html # 3-panel chat, summary modal, citations drawer
│   │   └── settings.html      # Account profile, password change, appearance, storage
│   │
│   └── static/
│       ├── css/
│       │   └── style.css      # Warm minimalist design system
│       └── js/
│           ├── app.js         # Toasts, modals, markdown parser, theme toggle
│           ├── upload.js      # Drag-and-drop upload with live progress bar
│           ├── workspace.js   # Chat interface, citations highlighter, summary modal
│           └── documents.js   # Live search, sort, and deletion handling
│
├── uploads/                   # Protected PDF file storage (owner-only access)
├── instance/                  # Local fallback database directory
└── tests/
    ├── test_auth.py           # Authentication, session, validation tests
    ├── test_pdf_processing.py # PDF extraction, chunking, scanned file tests
    ├── test_rag_and_summary.py# RAG retrieval, citations, and summary tests
    └── test_routes.py         # Route access control, stats, and isolation tests
```

---

## Installation & Setup

### 1. Prerequisites
- Python 3.10 or higher
- Git
- MySQL (Optional: DocuMind defaults to automatic SQLite fallback if MySQL is not running)

### 2. Clone and Setup Environment

```bash
# Navigate to the project directory
cd C:\Users\Dell\.gemini\antigravity\scratch\documind

# Create a virtual environment (optional but recommended)
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

# Install required dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your desired configuration:

```ini
FLASK_SECRET_KEY=generate-a-secure-random-key
FLASK_APP=run.py
FLASK_ENV=development

# MySQL Database Setup (default)
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=documind

# Database URI (MySQL or SQLite fallback)
DATABASE_URL=mysql+pymysql://root:@localhost:3306/documind

# AI Provider Configuration (Optional)
# Supports 'gemini' or 'openai'
AI_PROVIDER=gemini
AI_API_KEY=your_gemini_api_key_here
AI_MODEL=gemini-2.5-flash
```

> **Note**: If `AI_API_KEY` is omitted, DocuMind operates using its built-in local extractive RAG engine. It retrieves matching passages from the document with verified page citations without crashing or inventing hallucinations.

### 4. Database Setup (MySQL)

If using MySQL:
1. Start your MySQL service.
2. Create the database:
   ```sql
   CREATE DATABASE IF NOT EXISTS documind CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. When DocuMind launches, SQLAlchemy automatically initializes all required tables (`users`, `documents`, `document_chunks`, `conversations`, `messages`, `message_sources`, `summaries`).

If MySQL is unavailable, DocuMind smoothly falls back to SQLite (`instance/documind.db`) without crashing.

---

## Running the Application

Start the development server:

```bash
python run.py
```

Open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## Running Automated Tests

DocuMind includes a comprehensive test suite covering authentication, PyMuPDF extraction, scanned PDF detection, RAG retrieval scoring, multi-format summaries, and cross-user isolation:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

All 19 tests will execute and verify the application end-to-end.

---

## Known Limitations & Future Enhancements

- **Scanned PDF OCR**: Scanned PDFs are accurately detected and marked as `ocr_required` with clear feedback. Future releases can integrate Tesseract OCR or PaddleOCR for full image-to-text recognition.
- **Multi-Document Cross-Chat**: Current conversational workspace is dedicated to single-document deep exploration. Future iterations can allow grouping documents into research projects for cross-document synthesis.
