/**
 * Shared API client utilities for frontend-backend communication
 * Can be used by AngularJS frontend or any other frontend framework
 */

class ApiClient {
  constructor(baseUrl = 'http://localhost:3000/api') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Make HTTP request with error handling
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {object} data - Request data
   * @param {object} headers - Additional headers
   * @returns {Promise} - API response
   */
  async request(method, endpoint, data = null, headers = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      method: method.toUpperCase(),
      headers: { ...this.defaultHeaders, ...headers }
    };

    if (data) {
      if (data instanceof FormData) {
        // Remove Content-Type for FormData (browser will set it with boundary)
        delete config.headers['Content-Type'];
        config.body = data;
      } else {
        config.body = JSON.stringify(data);
      }
    }

    try {
      const response = await fetch(url, config);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error(`API Error [${method.toUpperCase()} ${endpoint}]:`, error);
      throw error;
    }
  }

  // Convenience methods
  get(endpoint, headers = {}) {
    return this.request('GET', endpoint, null, headers);
  }

  post(endpoint, data, headers = {}) {
    return this.request('POST', endpoint, data, headers);
  }

  put(endpoint, data, headers = {}) {
    return this.request('PUT', endpoint, data, headers);
  }

  delete(endpoint, headers = {}) {
    return this.request('DELETE', endpoint, null, headers);
  }

  // Specific API methods
  async healthCheck() {
    return this.get('/health');
  }

  async uploadPDF(file, onProgress = null) {
    const formData = new FormData();
    formData.append('pdf', file);

    // For progress tracking, you might need to use XMLHttpRequest instead of fetch
    if (onProgress) {
      return this.uploadWithProgress('/pdf/upload', formData, onProgress);
    }

    return this.post('/pdf/upload', formData);
  }

  async sendChatMessage(message, documentId, conversationHistory = []) {
    return this.post('/chat/message', {
      message,
      documentId,
      conversationHistory
    });
  }

  async getDocuments() {
    return this.get('/pdf/documents');
  }

  async getDocument(documentId) {
    return this.get(`/pdf/document/${documentId}`);
  }

  async getConversation(documentId) {
    return this.get(`/chat/conversation/${documentId}`);
  }

  async clearConversation(documentId) {
    return this.delete(`/chat/conversation/${documentId}`);
  }

  /**
   * Upload with progress tracking using XMLHttpRequest
   * @param {string} endpoint - API endpoint
   * @param {FormData} formData - Form data to upload
   * @param {function} onProgress - Progress callback
   * @returns {Promise} - Upload result
   */
  uploadWithProgress(endpoint, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${this.baseUrl}${endpoint}`;

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        try {
          const result = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(result);
          } else {
            reject(new Error(result.message || `HTTP ${xhr.status}`));
          }
        } catch (error) {
          reject(new Error('Invalid JSON response'));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error'));
      });

      xhr.open('POST', url);
      xhr.send(formData);
    });
  }
}

// Export for Node.js (backend testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiClient;
}

// Export for browser (frontend)
if (typeof window !== 'undefined') {
  window.ApiClient = ApiClient;
}
