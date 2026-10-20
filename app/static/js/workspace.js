/**
 * DocExpo — Document Workspace Engine (Liquid Glass Edition)
 */

document.addEventListener('DOMContentLoaded', () => {
  const workspaceContainer = document.querySelector('.workspace-layout');
  if (!workspaceContainer) return;

  const docId = workspaceContainer.getAttribute('data-document-id');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const sourcesContainer = document.getElementById('sources-list');
  const newChatBtn = document.getElementById('btn-new-chat');
  const pdfFrame = document.querySelector('.pdf-frame');

  let activeConversationId = null;
  let isSending = false;

  // Auto-resize chat textarea
  if (chatInput) {
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
    });

    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }

  // Quick question suggestion chips
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (chatInput && !isSending) {
        chatInput.value = chip.textContent.trim();
        sendMessage();
      }
    });
  });

  // New Chat Button
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      activeConversationId = null;
      chatMessages.innerHTML = `
        <div class="empty-chat-state" style="text-align:center;padding:40px 16px;color:var(--text-secondary);margin:auto 0;">
          <div style="width:48px;height:48px;border-radius:50%;background:rgba(185,167,255,0.12);border:1px solid rgba(185,167,255,0.28);color:var(--accent-lavender);display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem auto;font-size:20px;">
            ✦
          </div>
          <h3 style="font-size:var(--text-lg);font-weight:600;color:#FFFFFF;margin-bottom:0.5rem;">New Discussion</h3>
          <p style="font-size:var(--text-sm);max-width:360px;margin:0 auto 1.5rem auto;line-height:1.6;">
            Ask questions, clarify sections, or extract key formulas. Answers are grounded in verified document passages.
          </p>
        </div>
      `;
      sourcesContainer.innerHTML = `
        <div style="text-align:center;padding:24px 10px;color:var(--text-tertiary);font-size:12px;">
          Inquire about any topic to inspect matching passages and exact page numbers.
        </div>
      `;
      if (chatInput) chatInput.focus();
    });
  }

  // Send message function
  function sendMessage() {
    const question = chatInput ? chatInput.value.trim() : '';
    if (!question || isSending) return;

    isSending = true;
    if (sendBtn) sendBtn.disabled = true;

    // Remove empty state if present
    const emptyState = chatMessages.querySelector('.empty-chat-state');
    if (emptyState) emptyState.remove();

    // Append User Message to UI
    appendUserMessage(question);
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Append Loading Indicator
    const loadingElem = appendLoadingMessage();
    scrollToBottom();

    // Call API
    fetch(`/api/documents/${docId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question,
        conversation_id: activeConversationId
      })
    })
    .then(res => res.json())
    .then(data => {
      loadingElem.remove();
      if (data.error) {
        window.showToast(data.error, 'error');
        appendAssistantMessage('Sorry, an error occurred while generating a response. ' + data.error, []);
      } else {
        activeConversationId = data.conversation_id;
        appendAssistantMessage(data.assistant_message.content, data.assistant_message.sources || []);
        updateSourcesPanel(data.assistant_message.sources || []);
      }
    })
    .catch(err => {
      loadingElem.remove();
      window.showToast('Network error while sending message.', 'error');
      appendAssistantMessage('Failed to connect to the server. Please check your connection.', []);
    })
    .finally(() => {
      isSending = false;
      if (sendBtn) sendBtn.disabled = false;
      scrollToBottom();
    });
  }

  function appendUserMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message user-message';
    msgDiv.innerHTML = `
      <div class="message-bubble">
        ${escapeHtml(text)}
      </div>
    `;
    chatMessages.appendChild(msgDiv);
  }

  function appendAssistantMessage(text, sources) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message assistant-message';

    let sourcesHtml = '';
    if (sources && sources.length > 0) {
      sourcesHtml = '<div class="message-sources-bar" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">';
      sources.forEach((src) => {
        sourcesHtml += `
          <button class="source-pill" onclick="highlightSource(${src.source_page}, '${escapeHtml(src.relevant_excerpt).replace(/'/g, "\\'")}')">
            <span>✦ Page ${src.source_page}</span>
          </button>
        `;
      });
      sourcesHtml += '</div>';
    }

    msgDiv.innerHTML = `
      <div class="user-avatar" style="background:rgba(185,167,255,0.15);color:var(--accent-lavender);width:28px;height:28px;font-size:11px;font-weight:700;">
        AI
      </div>
      <div class="message-bubble">
        <div class="markdown-body">
          ${window.formatMarkdown(text)}
        </div>
        ${sourcesHtml}
      </div>
    `;
    chatMessages.appendChild(msgDiv);
  }

  function appendLoadingMessage() {
    const loadDiv = document.createElement('div');
    loadDiv.className = 'chat-message assistant-message';
    loadDiv.innerHTML = `
      <div class="user-avatar" style="background:rgba(185,167,255,0.15);color:var(--accent-lavender);width:28px;height:28px;font-size:11px;font-weight:700;">
        AI
      </div>
      <div class="message-bubble" style="color:var(--text-secondary);display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;animation:pulse 1s infinite;color:var(--accent-lavender);">✦</span>
        <span>Searching document chunks & formulating grounded response...</span>
      </div>
    `;
    chatMessages.appendChild(loadDiv);
    return loadDiv;
  }

  function updateSourcesPanel(sources) {
    if (!sourcesContainer) return;
    if (!sources || sources.length === 0) {
      sourcesContainer.innerHTML = `
        <div style="text-align:center;padding:24px 10px;color:var(--text-tertiary);font-size:12px;">
          No direct page citations referenced in this turn.
        </div>
      `;
      return;
    }

    let html = '';
    sources.forEach((src, idx) => {
      html += `
        <div class="source-card liquid-glass-subtle" id="source-card-${src.source_page}" style="padding:12px;margin-bottom:10px;cursor:pointer;transition:all 0.25s ease;" onclick="highlightSource(${src.source_page}, '')">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span class="badge badge-accent">Page ${src.source_page}</span>
            <span style="font-size:11px;color:var(--text-tertiary);">Citation #${idx + 1}</span>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;font-style:italic;">
            "${escapeHtml(src.relevant_excerpt)}"
          </div>
        </div>
      `;
    });
    sourcesContainer.innerHTML = html;
  }

  window.highlightSource = function(page, excerpt) {
    window.showToast(`Navigated to citation on Page ${page}`, 'info');
    if (pdfFrame && page) {
      pdfFrame.src = `/documents/${docId}/file#page=${page}`;
    }
    const targetCard = document.getElementById(`source-card-${page}`);
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetCard.style.borderColor = 'var(--accent-lavender)';
      targetCard.style.boxShadow = '0 0 20px rgba(185, 167, 255, 0.4)';
      setTimeout(() => {
        targetCard.style.borderColor = 'var(--glass-border-subtle)';
        targetCard.style.boxShadow = 'none';
      }, 2500);
    }
  };

  function scrollToBottom() {
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Summary generation modal handler
  const btnSummarize = document.getElementById('btn-open-summary-modal');
  const summaryTypeSelect = document.getElementById('summary-type-select');
  const btnGenerateSummary = document.getElementById('btn-generate-summary');
  const summaryResultContainer = document.getElementById('summary-result-content');
  const summaryLoading = document.getElementById('summary-loading-indicator');
  const btnCopySummary = document.getElementById('btn-copy-summary');
  const btnDownloadSummary = document.getElementById('btn-download-summary');

  if (btnSummarize) {
    btnSummarize.addEventListener('click', () => {
      window.openModal('summary-modal');
    });
  }

  if (btnGenerateSummary) {
    btnGenerateSummary.addEventListener('click', () => {
      const type = summaryTypeSelect ? summaryTypeSelect.value : 'quick';
      btnGenerateSummary.disabled = true;
      if (summaryLoading) summaryLoading.style.display = 'block';
      if (summaryResultContainer) summaryResultContainer.innerHTML = '';

      fetch(`/api/documents/${docId}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary_type: type })
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          window.showToast(data.error, 'error');
          if (summaryResultContainer) {
            summaryResultContainer.innerHTML = `<div style="color:var(--error);">${escapeHtml(data.error)}</div>`;
          }
        } else {
          window.showToast('Summary created successfully!', 'success');
          const content = data.summary.summary_content;
          if (summaryResultContainer) {
            summaryResultContainer.innerHTML = window.formatMarkdown(content);
          }
          if (btnCopySummary) btnCopySummary.style.display = 'inline-flex';
          if (btnDownloadSummary) btnDownloadSummary.style.display = 'inline-flex';
        }
      })
      .catch(err => {
        window.showToast('Failed to generate summary: server error.', 'error');
      })
      .finally(() => {
        btnGenerateSummary.disabled = false;
        if (summaryLoading) summaryLoading.style.display = 'none';
      });
    });
  }

  if (btnCopySummary) {
    btnCopySummary.addEventListener('click', () => {
      if (summaryResultContainer) {
        navigator.clipboard.writeText(summaryResultContainer.innerText)
          .then(() => window.showToast('Summary copied to clipboard!', 'success'))
          .catch(() => window.showToast('Unable to copy text.', 'error'));
      }
    });
  }

  if (btnDownloadSummary) {
    btnDownloadSummary.addEventListener('click', () => {
      if (summaryResultContainer) {
        const text = summaryResultContainer.innerText;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `docexpo-summary-${docId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    });
  }
});
