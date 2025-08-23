const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { uploadValidation } = require('../middleware/validation');
const jobQueue = require('../services/jobQueue');
const { documentStatusService, STATUS } = require('../services/documentStatusService');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Upload and process PDF with background processing for large documents
router.post('/upload', upload.single('pdf'), uploadValidation, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file uploaded'
      });
    }

    const { filename, originalname, path: filePath, size } = req.file;
    const documentId = uuidv4();
    const pageCount = req.pdfPageCount; // Added by validation middleware
    const isLargeDocument = req.isLargeDocument; // Added by validation middleware

    console.log(`📄 Processing PDF: ${originalname} (${(size / 1024 / 1024).toFixed(2)}MB, ${pageCount} pages)`);

    // Initialize document status tracking
    documentStatusService.setStatus(documentId, STATUS.UPLOADED, {
      filename: originalname,
      fileSize: size,
      numPages: pageCount,
      isLargeDocument,
      uploadedAt: new Date().toISOString()
    });

    // For large documents (20+ pages), use background processing
    if (isLargeDocument) {
      console.log(`📋 Large document detected (${pageCount} pages), using background processing`);

      // Update status to processing
      documentStatusService.setStatus(documentId, STATUS.PROCESSING, {
        filename: originalname,
        fileSize: size,
        numPages: pageCount,
        isLargeDocument: true,
        processingStartedAt: new Date().toISOString()
      });

      const jobId = jobQueue.addJob({
        type: 'pdf_processing',
        documentId,
        filePath,
        filename: originalname,
        fileSize: size,
        pageCount,
        uploadedAt: new Date().toISOString()
      });

      // Return immediately with processing status - frontend should poll for completion
      return res.json({
        success: true,
        message: 'PDF upload successful. Processing in background...',
        data: {
          documentId,
          jobId,
          filename: originalname,
          fileSize: size,
          numPages: pageCount,
          isBackgroundProcessing: true,
          processingStatus: 'processing',
          isProcessing: true,
          estimatedProcessingTime: Math.ceil(pageCount * 2) + ' seconds',
          statusCheckUrl: `/api/pdf/status/${documentId}`
        }
      });
    }

    // For smaller documents, process in background as well to avoid blocking the upload response
    console.log(`⚡ Small document (${pageCount} pages), processing in background`);

    // Update status to processing
    documentStatusService.setStatus(documentId, STATUS.PROCESSING, {
      filename: originalname,
      fileSize: size,
      numPages: pageCount,
      isLargeDocument: false,
      processingStartedAt: new Date().toISOString()
    });

    // Process in background even for small documents to avoid blocking upload response
    const jobId = jobQueue.addJob({
      type: 'pdf_processing',
      documentId,
      filePath,
      filename: originalname,
      fileSize: size,
      pageCount,
      uploadedAt: new Date().toISOString()
    });

    // Return immediately with processing status - frontend should poll for completion
    res.json({
      success: true,
      message: 'PDF upload successful. Processing...',
      data: {
        documentId,
        jobId,
        filename: originalname,
        fileSize: size,
        numPages: pageCount,
        isBackgroundProcessing: true,
        processingStatus: 'processing',
        isProcessing: true,
        estimatedProcessingTime: Math.ceil(pageCount * 1) + ' seconds',
        statusCheckUrl: `/api/pdf/status/${documentId}`
      }
    });

  } catch (error) {
    console.error('PDF upload error:', error);

    // Mark document as error if we have a documentId
    if (typeof documentId !== 'undefined') {
      documentStatusService.markError(documentId, error.message);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to process PDF',
      error: error.message
    });
  }
});

// Get document info
router.get('/document/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // TODO: Implement document retrieval from Chroma
    // This would get document metadata and stats
    
    res.json({
      success: true,
      message: 'Document info retrieved',
      data: {
        documentId,
        // Add document metadata here
      }
    });
  } catch (error) {
    console.error('Document retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document info',
      error: error.message
    });
  }
});

// List all documents
router.get('/documents', async (req, res) => {
  try {
    // TODO: Implement document listing from Chroma
    // This would list all uploaded documents
    
    res.json({
      success: true,
      message: 'Documents retrieved',
      data: {
        documents: []
        // Add documents list here
      }
    });
  } catch (error) {
    console.error('Documents listing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve documents',
      error: error.message
    });
  }
});

// Get job status for background processing
router.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        statusMessage: job.statusMessage,
        documentId: job.documentId,
        filename: job.filename,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
        result: job.result
      }
    });

  } catch (error) {
    console.error('Job status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job status',
      error: error.message
    });
  }
});

// Get queue statistics
router.get('/queue/stats', async (req, res) => {
  try {
    const stats = jobQueue.getStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Queue stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue statistics',
      error: error.message
    });
  }
});

// Get document processing status
router.get('/status/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    const documentStatus = documentStatusService.getStatus(documentId);

    if (!documentStatus) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
        error: 'DOCUMENT_NOT_FOUND'
      });
    }

    const isReady = documentStatusService.isReadyForChat(documentId);
    const isProcessing = documentStatusService.isProcessing(documentId);

    res.json({
      success: true,
      data: {
        documentId,
        status: documentStatus.status,
        progress: documentStatus.progress || 0,
        progressMessage: documentStatus.progressMessage || '',
        isReady,
        isProcessing,
        timestamp: documentStatus.timestamp,
        lastUpdated: documentStatus.lastUpdated,
        metadata: {
          filename: documentStatus.filename,
          fileSize: documentStatus.fileSize,
          numPages: documentStatus.numPages,
          isLargeDocument: documentStatus.isLargeDocument
        }
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check document status',
      error: error.message
    });
  }
});

// Get job status (for background processing)
router.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = jobQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
        error: 'JOB_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        jobId,
        status: job.status,
        progress: job.progress || 0,
        statusMessage: job.statusMessage || '',
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
        result: job.result,
        documentId: job.documentId
      }
    });

  } catch (error) {
    console.error('Job status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check job status',
      error: error.message
    });
  }
});

module.exports = router;
