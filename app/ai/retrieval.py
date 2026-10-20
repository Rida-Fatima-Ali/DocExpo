import re
import math
from collections import Counter
from app.models.models import DocumentChunk

# Common English stopwords
STOPWORDS = {
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
    'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
    'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
    'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn', 'it', 'its', 'itself', 'just',
    'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once',
    'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should',
    'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then',
    'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very',
    'was', 'wasn', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why',
    'will', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
}

OVERVIEW_PATTERNS = [
    r'what (is|was|it is|it\'s|is it) (this|it|the document) about',
    r'explain (me|to me|this|what|about)',
    r'tell (me|us) about (this|the|it)',
    r'what does this (document|pdf|file) (say|do|mean|contain)',
    r'(gimme|give me|make|provide) (a )?summary',
    r'summarize (this|the document|it)?',
    r'what(\'s| is) the (purpose|need|point|goal|topic)',
    r'why (is this|do we need|what\'s the need|what is the need)',
    r'overview',
    r'main (points|findings|ideas|topic|subject)',
    r'who is (this|it) for',
    r'what is this'
]

def is_overview_or_intent_query(query: str) -> bool:
    """Check if the user is asking an overview, purpose, or summary question."""
    q_lower = query.lower().strip()
    if len(q_lower) < 4:
        return True
    for pattern in OVERVIEW_PATTERNS:
        if re.search(pattern, q_lower):
            return True
    return False

def tokenize(text: str) -> list[str]:
    """Tokenize and normalize text into alphanumeric words."""
    words = re.findall(r'\b[a-zA-Z0-9_\-\']+\b', text.lower())
    return [w for w in words if len(w) > 1 and w not in STOPWORDS]

def extract_best_excerpt(chunk_text: str, query_tokens: list[str], max_len: int = 240) -> str:
    """Finds the most informative sentence or excerpt in the chunk."""
    clean = re.sub(r'\s+', ' ', chunk_text).strip()
    sentences = re.split(r'(?<=[.!?])\s+', clean)
    if not sentences or len(sentences) == 1:
        return clean[:max_len] + ('...' if len(clean) > max_len else '')
        
    best_sentence = sentences[0]
    best_score = -1
    
    for sentence in sentences:
        s_tokens = set(tokenize(sentence))
        match_count = sum(1 for t in query_tokens if t in s_tokens)
        if match_count > best_score:
            best_score = match_count
            best_sentence = sentence
            
    excerpt = best_sentence.strip()
    if len(excerpt) > max_len:
        excerpt = excerpt[:max_len] + '...'
    return excerpt

class DocumentRetriever:
    """
    Intelligent Grounded Document Retriever.
    Handles semantic overview intent, BM25 keyword matching,
    and guaranteed context fallback so overview questions never fail.
    """
    
    @staticmethod
    def retrieve(document_id: int, query: str, top_k: int = 4) -> list[dict]:
        chunks = DocumentChunk.query.filter_by(document_id=document_id).order_by(DocumentChunk.chunk_index.asc()).all()
        if not chunks:
            return []
            
        query_clean = query.strip()
        query_tokens = tokenize(query_clean)
        is_overview = is_overview_or_intent_query(query_clean)
        
        # If it's an overview/summary query, prioritize the introductory and key data chunks
        if is_overview or not query_tokens:
            intro_chunks = chunks[:min(top_k, len(chunks))]
            return [
                {
                    'chunk_id': ch.id,
                    'page_number': ch.page_number,
                    'chunk_index': ch.chunk_index,
                    'text': ch.extracted_text,
                    'excerpt': extract_best_excerpt(ch.extracted_text, query_tokens),
                    'score': 2.0 - (0.1 * idx)
                }
                for idx, ch in enumerate(intro_chunks)
            ]
            
        # BM25 / TF-IDF scoring for specific queries
        total_docs = len(chunks)
        k1 = 1.5
        b = 0.75
        
        doc_tokens_list = []
        doc_freq = Counter()
        total_len = 0
        
        for ch in chunks:
            tokens = tokenize(ch.extracted_text)
            doc_tokens_list.append(tokens)
            total_len += len(tokens)
            unique_terms = set(tokens)
            for t in unique_terms:
                doc_freq[t] += 1
                
        avgdl = total_len / total_docs if total_docs > 0 else 1.0
        
        scored_results = []
        query_phrase = query_clean.lower()
        
        for idx, ch in enumerate(chunks):
            tokens = doc_tokens_list[idx]
            doc_len = len(tokens)
            term_counts = Counter(tokens)
            score = 0.0
            
            for t in query_tokens:
                if t in term_counts:
                    tf = term_counts[t]
                    df = doc_freq.get(t, 0)
                    idf = math.log(1.0 + (total_docs - df + 0.5) / (df + 0.5))
                    idf = max(idf, 0.1)
                    
                    term_score = idf * (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * (doc_len / avgdl)))
                    score += term_score
                    
            # Boost for phrase match
            if query_phrase in ch.extracted_text.lower():
                score += 5.0
                
            if score > 0:
                excerpt = extract_best_excerpt(ch.extracted_text, query_tokens)
                scored_results.append({
                    'chunk_id': ch.id,
                    'page_number': ch.page_number,
                    'chunk_index': ch.chunk_index,
                    'text': ch.extracted_text,
                    'excerpt': excerpt,
                    'score': score
                })
                
        # Sort descending by score
        scored_results.sort(key=lambda x: x['score'], reverse=True)
        
        # GUARANTEED FALLBACK: If no keyword matched, never return []! Return top chunks with page 1!
        if not scored_results:
            fallback_chunks = chunks[:min(top_k, len(chunks))]
            return [
                {
                    'chunk_id': ch.id,
                    'page_number': ch.page_number,
                    'chunk_index': ch.chunk_index,
                    'text': ch.extracted_text,
                    'excerpt': extract_best_excerpt(ch.extracted_text, query_tokens),
                    'score': 1.0 - (0.1 * idx)
                }
                for idx, ch in enumerate(fallback_chunks)
            ]
            
        # Ensure Page 1 (identity/header) is included in top_k if not already present
        has_page1 = any(r['page_number'] == 1 for r in scored_results[:top_k])
        if not has_page1 and len(chunks) > 0 and len(scored_results) < top_k:
            ch0 = chunks[0]
            scored_results.append({
                'chunk_id': ch0.id,
                'page_number': ch0.page_number,
                'chunk_index': ch0.chunk_index,
                'text': ch0.extracted_text,
                'excerpt': extract_best_excerpt(ch0.extracted_text, query_tokens),
                'score': 0.5
            })
            
        return scored_results[:top_k]
