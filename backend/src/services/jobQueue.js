const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { documentStatusService, STATUS } = require('../services/documentStatusService');

class JobQueue extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map();
    this.processing = new Set();
    this.maxConcurrent = 2; // Process max 2 large documents simultaneously
  }

  /**
   * Add a job to the queue
   */
  addJob(jobData) {
    const jobId = uuidv4();
    const job = {
      id: jobId,
      ...jobData,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      error: null,
      result: null
    };

    this.jobs.set(jobId, job);
    console.log(`📋 Job ${jobId} added to queue: ${job.type}`);
    
    // Try to process immediately if capacity available
    this.processNext();
    
    return jobId;
  }

  /**
   * Get job status
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Update job progress
   */
  updateProgress(jobId, progress, message = null) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = Math.min(100, Math.max(0, progress));
      if (message) job.statusMessage = message;

      console.log(`📊 Job ${jobId} progress: ${job.progress}%${message ? ` - ${message}` : ''}`);
      this.emit('progress', { jobId, progress: job.progress, message });

      // Update document status if this is a PDF processing job
      if (job.type === 'pdf_processing' && job.documentId) {
        documentStatusService.updateProgress(job.documentId, job.progress, message);
      }
    }
  }

  /**
   * Mark job as completed
   */
  completeJob(jobId, result) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();
      job.result = result;

      this.processing.delete(jobId);
      console.log(`✅ Job ${jobId} completed`);
      this.emit('completed', { jobId, result });

      // Mark document as completed if this is a PDF processing job
      if (job.type === 'pdf_processing' && job.documentId) {
        documentStatusService.markCompleted(job.documentId, {
          filename: job.filename,
          fileSize: job.fileSize,
          numPages: result.numPages,
          chunksCreated: result.chunksCreated,
          processingTime: result.processingTime,
          jobId: jobId
        });
      }

      // Process next job in queue
      this.processNext();
    }
  }

  /**
   * Mark job as failed
   */
  failJob(jobId, error) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = error.message || error;

      this.processing.delete(jobId);
      console.error(`❌ Job ${jobId} failed:`, error);
      this.emit('failed', { jobId, error: job.error });

      // Mark document as error if this is a PDF processing job
      if (job.type === 'pdf_processing' && job.documentId) {
        documentStatusService.markError(job.documentId, job.error);
      }

      // Process next job in queue
      this.processNext();
    }
  }

  /**
   * Process next job in queue
   */
  processNext() {
    if (this.processing.size >= this.maxConcurrent) {
      return; // At capacity
    }

    // Find next queued job
    const queuedJob = Array.from(this.jobs.values())
      .find(job => job.status === 'queued');

    if (queuedJob) {
      this.startJob(queuedJob.id);
    }
  }

  /**
   * Start processing a job
   */
  async startJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'queued') return;

    job.status = 'processing';
    job.startedAt = new Date();
    this.processing.add(jobId);

    console.log(`🚀 Starting job ${jobId}: ${job.type}`);
    this.emit('started', { jobId });

    try {
      // Process the job based on type
      if (job.type === 'pdf_processing') {
        await this.processPdfJob(job);
      }
    } catch (error) {
      this.failJob(jobId, error);
    }
  }

  /**
   * Process PDF job with progress tracking
   */
  async processPdfJob(job) {
    const { processPDF } = require('./pdfService');
    const { vectorizeDocument } = require('../../services/vectorServiceSelector');
    
    try {
      this.updateProgress(job.id, 10, 'Starting PDF processing...');
      
      // Process PDF with progress callbacks
      const pdfResult = await processPDF(job.filePath, {
        onProgress: (progress, message) => {
          // PDF processing takes 60% of total progress
          this.updateProgress(job.id, 10 + (progress * 0.6), message);
        }
      });

      this.updateProgress(job.id, 70, 'PDF processed, creating embeddings...');

      // Update document status to vectorizing
      if (job.documentId) {
        documentStatusService.setStatus(job.documentId, STATUS.VECTORIZING, {
          filename: job.filename,
          fileSize: job.fileSize,
          numPages: pdfResult.numPages,
          textLength: pdfResult.text.length
        });
      }

      // Vectorize document
      const vectorResult = await vectorizeDocument(
        job.documentId,
        pdfResult.text,
        {
          filename: job.filename,
          uploadedAt: job.uploadedAt,
          fileSize: job.fileSize,
          numPages: pdfResult.numPages,
          pdfMetadata: pdfResult.metadata
        },
        {
          onProgress: (progress, message) => {
            // Vectorization takes remaining 30% of progress
            this.updateProgress(job.id, 70 + (progress * 0.3), message);
          }
        }
      );

      // Complete the job
      this.completeJob(job.id, {
        documentId: job.documentId,
        filename: job.filename,
        fileSize: job.fileSize,
        numPages: pdfResult.numPages,
        chunksCreated: vectorResult.chunksCreated,
        processingTime: vectorResult.processingTime,
        metadata: pdfResult.metadata
      });

    } catch (error) {
      this.failJob(job.id, error);
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      queued: jobs.filter(j => j.status === 'queued').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      processingCapacity: this.maxConcurrent,
      currentlyProcessing: this.processing.size
    };
  }

  /**
   * Clean up old completed jobs (older than 1 hour)
   */
  cleanup() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') && 
          job.completedAt && job.completedAt < oneHourAgo) {
        this.jobs.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old jobs`);
    }
  }
}

// Create singleton instance
const jobQueue = new JobQueue();

// Clean up old jobs every 30 minutes
setInterval(() => {
  jobQueue.cleanup();
}, 30 * 60 * 1000);

module.exports = jobQueue;
