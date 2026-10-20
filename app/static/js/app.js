/**
 * DocExpo — Global Client Infrastructure (Apple Liquid Glass Edition)
 */

// Toast Notifications System (Liquid Glass)
window.showToast = function(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '✦';
  toast.innerHTML = `<span style="font-weight:700; color:var(--accent-lavender);">${icon}</span><span>${message}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
};

// Modal System (Frosted Glass)
window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
};

// Safe Markdown Formatter for Chat & Summaries
window.formatMarkdown = function(text) {
  if (!text) return '';
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#FFFFFF;">$1</strong>');
  // Italic
  escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline Code
  escaped = escaped.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:0.88em;color:var(--accent-lavender);">$1</code>');
  // Headers
  escaped = escaped.replace(/^### (.*$)/gim, '<h4 style="margin:14px 0 6px 0;font-weight:600;color:#FFFFFF;">$1</h4>');
  escaped = escaped.replace(/^## (.*$)/gim, '<h3 style="margin:16px 0 8px 0;font-weight:600;color:#FFFFFF;">$1</h3>');
  escaped = escaped.replace(/^# (.*$)/gim, '<h2 style="margin:18px 0 10px 0;font-weight:700;color:#FFFFFF;">$1</h2>');
  // Blockquotes
  escaped = escaped.replace(/^> (.*$)/gim, '<blockquote style="border-left:3px solid var(--accent-lavender);padding-left:12px;margin:10px 0;color:var(--text-secondary);">$1</blockquote>');
  // Lists
  escaped = escaped.replace(/^\s*•\s+(.*$)/gim, '<li style="margin-left:20px;margin-bottom:4px;">$1</li>');
  escaped = escaped.replace(/^\s*\*\s+(.*$)/gim, '<li style="margin-left:20px;margin-bottom:4px;">$1</li>');
  escaped = escaped.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-left:20px;margin-bottom:4px;">$1</li>');
  
  // Paragraph line breaks
  escaped = escaped.replace(/\n\n/g, '<p style="margin-bottom:10px;"></p>');
  escaped = escaped.replace(/\n/g, '<br>');
  
  return escaped;
};

document.addEventListener('DOMContentLoaded', () => {
  // Close modals on clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        window.closeModal(modal.id);
      }
    });
  });

  // Mobile menu toggle
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.querySelector('.app-sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Logout handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (err) {}
      window.location.href = '/';
    });
  }
});
