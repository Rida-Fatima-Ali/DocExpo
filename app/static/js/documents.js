/**
 * DocExpo — Document Library Management (Liquid Glass Edition)
 */

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('doc-search-input');
  const statusFilter = document.getElementById('doc-status-filter');
  const sortSelect = document.getElementById('doc-sort-select');
  const docsList = document.getElementById('documents-grid');
  const deleteModal = document.getElementById('delete-doc-modal');
  const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
  const cancelDeleteBtn = document.getElementById('btn-cancel-delete');
  const deleteDocNameSpan = document.getElementById('delete-doc-name');

  let docToDeleteId = null;

  function fetchDocuments() {
    const params = new URLSearchParams();
    if (searchInput && searchInput.value.trim()) params.append('search', searchInput.value.trim());
    if (statusFilter && statusFilter.value) params.append('status', statusFilter.value);
    if (sortSelect && sortSelect.value) params.append('sort', sortSelect.value);

    fetch(`/api/documents?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        renderDocuments(data.documents || []);
      })
      .catch(err => {
        window.showToast('Failed to load documents.', 'error');
      });
  }

  function renderDocuments(docs) {
    if (!docsList) return;

    if (docs.length === 0) {
      docsList.innerHTML = `
        <div class="liquid-glass" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; border: 1.5px dashed var(--glass-border-strong); border-radius: var(--radius-lg);">
          <div style="font-size: 32px; margin-bottom: 12px; color: var(--accent-lavender);">📂</div>
          <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 6px; color: #FFFFFF;">No documents found</h3>
          <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 20px;">Upload a PDF to start extracting intelligence and asking questions.</p>
          <a href="/dashboard" class="btn btn-primary btn-sm">Upload PDF</a>
        </div>
      `;
      return;
    }

    let html = '';
    docs.forEach(doc => {
      const date = new Date(doc.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      
      let statusBadge = '';
      if (doc.processing_status === 'processed') {
        statusBadge = `<span class="badge badge-success">Ready (${doc.page_count} pages)</span>`;
      } else if (doc.processing_status === 'ocr_required') {
        statusBadge = `<span class="badge badge-warning">Scanned / OCR</span>`;
      } else if (doc.processing_status === 'error') {
        statusBadge = `<span class="badge badge-error">Failed</span>`;
      } else {
        statusBadge = `<span class="badge badge-neutral">Processing</span>`;
      }

      html += `
        <div class="card doc-card" style="display:flex;flex-direction:column;justify-content:space-between;gap:16px;">
          <div>
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
              <h4 style="font-size:15px;font-weight:600;word-break:break-word;line-height:1.4;color:#FFFFFF;">${escapeHtml(doc.original_filename)}</h4>
              <button class="btn btn-ghost btn-sm" style="color:var(--error);padding:4px 6px;border-radius:var(--radius-sm);" onclick="triggerDeleteDoc(${doc.id}, '${escapeHtml(doc.original_filename).replace(/'/g, "\\'")}')" title="Delete Document">
                ✕
              </button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
              ${statusBadge}
              <span style="font-size:12px;color:var(--text-tertiary);">${doc.formatted_size}</span>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);">
              Uploaded ${date}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;border-top:1px solid var(--glass-border-subtle);padding-top:14px;">
            <a href="/documents/${doc.id}" class="btn btn-primary btn-sm" style="flex:1;">
              Open Workspace
            </a>
            <a href="/documents/${doc.id}/file?download=true" class="btn btn-secondary btn-sm" title="Download PDF">
              ↓
            </a>
          </div>
        </div>
      `;
    });

    docsList.innerHTML = html;
  }

  window.triggerDeleteDoc = function(id, name) {
    docToDeleteId = id;
    if (deleteDocNameSpan) deleteDocNameSpan.textContent = name;
    window.openModal('delete-doc-modal');
  };

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', () => {
      if (!docToDeleteId) return;
      confirmDeleteBtn.disabled = true;

      fetch(`/api/documents/${docToDeleteId}`, {
        method: 'DELETE'
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          window.showToast(data.error, 'error');
        } else {
          window.showToast('Document deleted.', 'success');
          window.closeModal('delete-doc-modal');
          fetchDocuments();
        }
      })
      .catch(() => {
        window.showToast('Server error during deletion.', 'error');
      })
      .finally(() => {
        confirmDeleteBtn.disabled = false;
        docToDeleteId = null;
      });
    });
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
      window.closeModal('delete-doc-modal');
      docToDeleteId = null;
    });
  }

  if (searchInput) searchInput.addEventListener('input', debounce(fetchDocuments, 300));
  if (statusFilter) statusFilter.addEventListener('change', fetchDocuments);
  if (sortSelect) sortSelect.addEventListener('change', fetchDocuments);

  function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Initial load if grid exists
  if (docsList) {
    fetchDocuments();
  }
});
