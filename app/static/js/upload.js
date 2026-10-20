/**
 * DocExpo — Drag-and-Drop PDF Uploader
 */

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('pdf-file-input');
  const progressContainer = document.getElementById('upload-progress-container');
  const progressBar = document.getElementById('upload-progress-bar');
  const statusText = document.getElementById('upload-status-text');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileUpload(fileInput.files[0]);
    }
  });

  function handleFileUpload(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      window.showToast('Please upload a genuine PDF file (.pdf)', 'error');
      return;
    }

    if (file.size > 32 * 1024 * 1024) {
      window.showToast('File exceeds the 32 MB upload limit.', 'error');
      return;
    }

    // Prepare upload UI
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    statusText.textContent = `Uploading ${file.name}...`;

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/documents/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 90);
        progressBar.style.width = `${percent}%`;
        if (percent >= 90) {
          statusText.textContent = 'Extracting pages & generating chunks with PyMuPDF...';
        }
      }
    };

    xhr.onload = () => {
      progressBar.style.width = '100%';
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status === 201) {
          const doc = response.document;
          if (doc.processing_status === 'ocr_required') {
            window.showToast('Notice: Scanned PDF detected. Text extraction requires OCR.', 'warning', 6000);
          } else {
            window.showToast('Document uploaded and processed successfully!', 'success');
          }

          setTimeout(() => {
            // Redirect to workspace or reload list
            window.location.href = `/documents/${doc.id}`;
          }, 800);
        } else {
          window.showToast(response.error || 'Upload failed.', 'error');
          progressContainer.style.display = 'none';
        }
      } catch (err) {
        window.showToast('An unexpected server error occurred during upload.', 'error');
        progressContainer.style.display = 'none';
      }
    };

    xhr.onerror = () => {
      window.showToast('Network error during upload.', 'error');
      progressContainer.style.display = 'none';
    };

    xhr.send(formData);
  }
});
