// Document Status Tracking Service
// Tracks the processing status of uploaded documents

class DocumentStatusService {
  constructor() {
    // In-memory storage for document processing status
    // In production, this could be stored in Redis or a database
    this.documentStatus = new Map();
    
    console.log('📊 DocumentStatusService initialized');
  }

  /**
   * Document processing statuses
   */
  static STATUS = {
    UPLOADING: 'uploading',
    UPLOADED: 'uploaded',
    PROCESSING: 'processing',
    VECTORIZING: 'vectorizing',
    COMPLETED: 'completed',
    ERROR: 'error'
  };

  /**
   * Set document status
   * @param {string} documentId - Document ID
   * @param {string} status - Processing status
   * @param {object} metadata - Additional metadata
   */
  setStatus(documentId, status, metadata = {}) {
    const statusInfo = {
      documentId,
      status,
      timestamp: new Date().toISOString(),
      ...metadata
    };

    this.documentStatus.set(documentId, statusInfo);
    console.log(`📋 Document ${documentId} status: ${status}`);
    
    return statusInfo;
  }

  /**
   * Get document status
   * @param {string} documentId - Document ID
   * @returns {object|null} - Status information or null if not found
   */
  getStatus(documentId) {
    return this.documentStatus.get(documentId) || null;
  }

  /**
   * Check if document is ready for chat
   * @param {string} documentId - Document ID
   * @returns {boolean} - True if document is ready for chat
   */
  isReadyForChat(documentId) {
    const status = this.getStatus(documentId);
    return status && status.status === DocumentStatusService.STATUS.COMPLETED;
  }

  /**
   * Check if document is still processing
   * @param {string} documentId - Document ID
   * @returns {boolean} - True if document is still processing
   */
  isProcessing(documentId) {
    const status = this.getStatus(documentId);
    if (!status) return false;
    
    return [
      DocumentStatusService.STATUS.UPLOADING,
      DocumentStatusService.STATUS.UPLOADED,
      DocumentStatusService.STATUS.PROCESSING,
      DocumentStatusService.STATUS.VECTORIZING
    ].includes(status.status);
  }

  /**
   * Update processing progress
   * @param {string} documentId - Document ID
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} message - Progress message
   */
  updateProgress(documentId, progress, message) {
    const currentStatus = this.getStatus(documentId);
    if (currentStatus) {
      currentStatus.progress = progress;
      currentStatus.progressMessage = message;
      currentStatus.lastUpdated = new Date().toISOString();
      
      this.documentStatus.set(documentId, currentStatus);
      console.log(`📈 Document ${documentId} progress: ${progress}% - ${message}`);
    }
  }

  /**
   * Mark document as completed
   * @param {string} documentId - Document ID
   * @param {object} completionData - Completion metadata
   */
  markCompleted(documentId, completionData = {}) {
    return this.setStatus(documentId, DocumentStatusService.STATUS.COMPLETED, {
      completedAt: new Date().toISOString(),
      progress: 100,
      progressMessage: 'Document ready for chat',
      ...completionData
    });
  }

  /**
   * Mark document as error
   * @param {string} documentId - Document ID
   * @param {string} error - Error message
   */
  markError(documentId, error) {
    return this.setStatus(documentId, DocumentStatusService.STATUS.ERROR, {
      error,
      errorAt: new Date().toISOString()
    });
  }

  /**
   * Remove document status (cleanup)
   * @param {string} documentId - Document ID
   */
  removeStatus(documentId) {
    const removed = this.documentStatus.delete(documentId);
    if (removed) {
      console.log(`🗑️ Removed status for document ${documentId}`);
    }
    return removed;
  }

  /**
   * Get all document statuses (for debugging)
   * @returns {Array} - Array of all document statuses
   */
  getAllStatuses() {
    return Array.from(this.documentStatus.values());
  }

  /**
   * Clean up old statuses (older than specified hours)
   * @param {number} hoursOld - Hours old to consider for cleanup (default: 24)
   */
  cleanupOldStatuses(hoursOld = 24) {
    const cutoffTime = new Date(Date.now() - (hoursOld * 60 * 60 * 1000));
    let cleanedCount = 0;

    for (const [documentId, status] of this.documentStatus.entries()) {
      const statusTime = new Date(status.timestamp);
      if (statusTime < cutoffTime) {
        this.documentStatus.delete(documentId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old document statuses`);
    }

    return cleanedCount;
  }
}

// Create singleton instance
const documentStatusService = new DocumentStatusService();

// Export both the class and instance
module.exports = {
  DocumentStatusService,
  documentStatusService,
  STATUS: DocumentStatusService.STATUS
};
