const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { uploadValidation } = require('../middleware/validation');
const { processPDF } = require('../services/pdfService');
const { vectorizeDocument } = require('../../services/vectorServiceSelector');
const jobQueue = require('../services/jobQueue');

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

    // For large documents (20+ pages), use background processing
    if (isLargeDocument) {
      console.log(`📋 Large document detected (${pageCount} pages), using background processing`);

      const jobId = jobQueue.addJob({
        type: 'pdf_processing',
        documentId,
        filePath,
        filename: originalname,
        fileSize: size,
        pageCount,
        uploadedAt: new Date().toISOString()
      });

      return res.json({
        success: true,
        message: 'Large PDF queued for background processing',
        data: {
          documentId,
          jobId,
          filename: originalname,
          fileSize: size,
          numPages: pageCount,
          isBackgroundProcessing: true,
          estimatedProcessingTime: Math.ceil(pageCount * 2) + ' seconds'
        }
      });
    }

    // For smaller documents, process immediately
    console.log(`⚡ Small document (${pageCount} pages), processing immediately`);

    // Process PDF and extract text with page information
    const pdfResult = await processPDF(filePath);

    // Vectorize and store in Chroma
    const vectorResult = await vectorizeDocument(documentId, pdfResult.text, {
      filename: originalname,
      uploadedAt: new Date().toISOString(),
      fileSize: size,
      numPages: pdfResult.numPages,
      pdfMetadata: pdfResult.metadata
    });

    res.json({
      success: true,
      message: 'PDF uploaded and processed successfully',
      data: {
        documentId,
        filename: originalname,
        fileSize: size,
        numPages: pdfResult.numPages,
        chunksCreated: vectorResult.chunksCreated,
        processingTime: vectorResult.processingTime,
        isBackgroundProcessing: false
      }
    });

  } catch (error) {
    console.error('PDF upload error:', error);
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

module.exports = router;
