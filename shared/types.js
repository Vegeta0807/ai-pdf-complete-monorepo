/**
 * Shared types and interfaces for the AI PDF Chat application
 * These can be used by both frontend and backend for consistency
 */

// API Response Types
const ApiResponse = {
  SUCCESS: 'success',
  ERROR: 'error'
};

// Document Status Types
const DocumentStatus = {
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error'
};

// Chat Message Types
const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
};

// File Types
const AllowedFileTypes = {
  PDF: 'application/pdf'
};

// API Endpoints
const ApiEndpoints = {
  HEALTH: '/api/health',
  PDF_UPLOAD: '/api/pdf/upload',
  PDF_DOCUMENTS: '/api/pdf/documents',
  PDF_DOCUMENT: '/api/pdf/document',
  CHAT_MESSAGE: '/api/chat/message',
  CHAT_CONVERSATION: '/api/chat/conversation'
};

// Error Codes
const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  AI_API_ERROR: 'AI_API_ERROR',
  VECTOR_DB_ERROR: 'VECTOR_DB_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR'
};

// Configuration Constants
const Config = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_MESSAGE_LENGTH: 1000,
  MAX_CONVERSATION_HISTORY: 20,
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 200,
  DEFAULT_SEARCH_RESULTS: 5
};

// Export for Node.js (backend)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ApiResponse,
    DocumentStatus,
    MessageRole,
    AllowedFileTypes,
    ApiEndpoints,
    ErrorCodes,
    Config
  };
}

// Export for browser (frontend)
if (typeof window !== 'undefined') {
  window.SharedTypes = {
    ApiResponse,
    DocumentStatus,
    MessageRole,
    AllowedFileTypes,
    ApiEndpoints,
    ErrorCodes,
    Config
  };
}
