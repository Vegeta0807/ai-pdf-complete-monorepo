import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { Subject, takeUntil, interval, switchMap, takeWhile } from 'rxjs';
import { PdfStateService, PdfState } from '../../services/pdf-state.service';
import { ErrorFallbackComponent } from '../error-fallback/error-fallback.component';
import { ErrorState, FallbackConfig } from '../../interfaces/error-state.interface';
import { ApiService, JobStatus } from '../../services/api.service';

@Component({
  selector: 'app-upload-pdf',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatCardModule,
    ErrorFallbackComponent
  ],
  templateUrl: './upload-pdf.component.html',
  styleUrl: './upload-pdf.component.scss'
})
export class UploadPdfComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  pdfState: PdfState = {
    file: null,
    pdfId: null,
    filename: null,
    pages: null,
    isUploading: false,
    isProcessing: false,
    isUploaded: false,
    uploadError: null,
    processingStage: 'idle'
  };

  // Error handling properties
  errorState: ErrorState | null = null;
  fallbackConfig: FallbackConfig = {
    showRetryButton: true,
    showContactSupport: true,
    showOfflineMode: true
  };
  retryCount = 0;
  maxRetries = 3;
  lastSelectedFile: File | null = null;

  // Background processing properties
  isBackgroundProcessing = false;
  currentJobId: string | null = null;
  processingProgress = 0;
  processingMessage = '';
  estimatedTime = '';

  constructor(
    private pdfStateService: PdfStateService,
    private snackBar: MatSnackBar,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    // Subscribe to PDF state changes
    this.pdfStateService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.pdfState = state;

        // Show success message when upload completes
        if (state.isUploaded && !state.uploadError) {
          this.snackBar.open(
            `PDF "${state.filename}" uploaded successfully! (${state.pages} pages)`,
            'Close',
            { duration: 5000 }
          );
        }

        // Show error message if upload fails
        if (state.uploadError) {
          this.snackBar.open(
            `Upload failed: ${state.uploadError}`,
            'Close',
            { duration: 8000 }
          );
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Helper method to truncate text for display
  truncateText(text: string, maxLength: number = 25): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  // Get truncated filename for display
  getTruncatedFilename(filename: string): string {
    return this.truncateText(filename, 25);
  }

  /**
   * Handle file selection
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Clear any previous errors
      if (this.pdfState.uploadError) {
        this.pdfStateService.clearError();
      }

      // Validate file type
      if (file.type !== 'application/pdf') {
        this.snackBar.open('Please select a PDF file', 'Close', { duration: 3000 });
        return;
      }

      // Validate file size (max 50MB for better support of real-world PDFs)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        this.snackBar.open('File size must be less than 50MB', 'Close', { duration: 3000 });
        return;
      }

      // Warn for large files
      if (file.size > 20 * 1024 * 1024) { // 20MB
        this.snackBar.open(
          `Large file detected (${(file.size / 1024 / 1024).toFixed(1)}MB). Processing may take longer.`,
          'OK',
          { duration: 5000 }
        );
      }

      // Upload the file
      this.uploadFile(file);
    }
  }

  /**
   * Upload file to backend
   */
  private uploadFile(file: File): void {
    this.lastSelectedFile = file; // Store for retry
    this.clearError(); // Clear any previous errors

    this.pdfStateService.uploadPdf(file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Check if this is background processing
          if (response.isBackgroundProcessing && response.jobId) {
            this.handleBackgroundProcessing(response);
          } else {
            // Immediate processing completed
            this.retryCount = 0;
            this.clearError();
          }
        },
        error: (error) => {
          this.handleUploadError(error);
        }
      });
  }

  /**
   * Trigger file input click
   */
  triggerFileInput(): void {
    const fileInput = document.getElementById('pdf-file-input') as HTMLInputElement;
    fileInput?.click();
  }

  /**
   * Clear uploaded PDF
   */
  clearPdf(): void {
    this.pdfStateService.clearPdf();
    this.snackBar.open('PDF cleared', 'Close', { duration: 2000 });
  }



  /**
   * Handle upload errors with proper fallback
   */
  private handleUploadError(error: any): void {
    this.retryCount++;

    // Determine error type based on the error
    let errorType: ErrorState['errorType'] = 'unknown';
    let errorMessage = 'Upload failed';

    if (error.message?.includes('ERR_CONNECTION_REFUSED') || error.status === 0) {
      errorType = 'network';
      errorMessage = 'Cannot connect to server. Please check if the backend is running and try again.';
    } else if (error.name === 'TimeoutError') {
      errorType = 'timeout';
      errorMessage = 'Upload timed out. The file may be too large or the connection is slow.';
    } else if (error.status >= 500) {
      errorType = 'server';
      errorMessage = 'Server error occurred while processing your upload.';
    } else if (error.status === 413) {
      errorType = 'upload';
      errorMessage = 'File is too large. Please try a smaller file.';
    } else if (error.status === 415) {
      errorType = 'upload';
      errorMessage = 'Invalid file type. Please upload a PDF file.';
    } else {
      errorType = 'upload';
      errorMessage = error.message || 'Upload failed for unknown reason';
    }

    // Create error state
    this.errorState = {
      hasError: true,
      errorType,
      errorMessage,
      errorCode: error.status?.toString(),
      timestamp: new Date(),
      retryable: this.retryCount < this.maxRetries,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries
    };

    // Update fallback config
    this.fallbackConfig = {
      showRetryButton: this.errorState.retryable,
      showContactSupport: this.retryCount >= this.maxRetries,
      showOfflineMode: errorType === 'network',
      customMessage: errorMessage,
      actionLabel: 'Retry Upload',
      onRetry: () => this.retryUpload()
    };

    // Show snack bar for immediate feedback
    this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
  }

  /**
   * Clear error state
   */
  private clearError(): void {
    this.errorState = null;
    this.retryCount = 0;
  }

  /**
   * Retry upload with the last selected file
   */
  private retryUpload(): void {
    if (this.lastSelectedFile) {
      this.clearError();
      this.uploadFile(this.lastSelectedFile);
    } else {
      this.triggerFileInput();
    }
  }

  /**
   * Handle error fallback actions
   */
  onErrorRetry(): void {
    this.retryUpload();
  }

  onErrorContactSupport(): void {
    const subject = encodeURIComponent('AI PDF Chat - Upload Error');
    const body = encodeURIComponent(`
Error Details:
- Type: ${this.errorState?.errorType}
- Message: ${this.errorState?.errorMessage}
- Code: ${this.errorState?.errorCode}
- Time: ${this.errorState?.timestamp}
- File: ${this.lastSelectedFile?.name} (${this.lastSelectedFile?.size} bytes)
- Retry Count: ${this.errorState?.retryCount}

Please describe what happened when you tried to upload the file.
    `);

    window.open(`mailto:support@example.com?subject=${subject}&body=${body}`, '_blank');
  }

  onErrorDismiss(): void {
    this.clearError();
  }

  /**
   * Handle background processing response
   */
  private handleBackgroundProcessing(response: any): void {
    this.isBackgroundProcessing = true;
    this.currentJobId = response.jobId;
    this.estimatedTime = response.estimatedProcessingTime || 'Unknown';
    this.processingProgress = 0;
    this.processingMessage = 'Queued for processing...';

    this.snackBar.open(
      `Large PDF queued for background processing. Estimated time: ${this.estimatedTime}`,
      'OK',
      { duration: 5000 }
    );

    // Start polling job status
    this.pollJobStatus();
  }

  /**
   * Poll job status for background processing
   */
  private pollJobStatus(): void {
    if (!this.currentJobId) return;

    this.apiService.pollJobStatus(this.currentJobId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status: JobStatus) => {
          this.processingProgress = status.progress;
          this.processingMessage = status.statusMessage || `Status: ${status.status}`;

          if (status.status === 'completed') {
            this.handleBackgroundProcessingComplete(status);
          } else if (status.status === 'failed') {
            this.handleBackgroundProcessingFailed(status);
          }
        },
        error: (error) => {
          console.error('Job polling error:', error);
          this.handleBackgroundProcessingFailed({
            error: 'Failed to track processing status'
          } as JobStatus);
        }
      });
  }

  /**
   * Handle successful background processing completion
   */
  private handleBackgroundProcessingComplete(status: JobStatus): void {
    this.isBackgroundProcessing = false;
    this.processingProgress = 100;
    this.processingMessage = 'Processing completed!';

    // Update PDF state with completed processing
    this.pdfStateService.setProcessingComplete(
      status.documentId,
      status.filename,
      status.result?.numPages || 0
    );

    this.snackBar.open(
      `PDF processing completed! ${status.result?.chunksCreated || 0} chunks created.`,
      'Close',
      { duration: 5000 }
    );

    this.retryCount = 0;
    this.clearError();
  }

  /**
   * Handle failed background processing
   */
  private handleBackgroundProcessingFailed(status: JobStatus): void {
    this.isBackgroundProcessing = false;

    this.errorState = {
      hasError: true,
      errorType: 'processing',
      errorMessage: status.error || 'Background processing failed',
      timestamp: new Date(),
      retryable: true,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries
    };

    this.fallbackConfig = {
      showRetryButton: true,
      showContactSupport: true,
      showOfflineMode: false,
      customMessage: `Background processing failed: ${status.error || 'Unknown error'}`,
      actionLabel: 'Retry Upload'
    };

    this.snackBar.open(
      'Background processing failed. You can retry the upload.',
      'Close',
      { duration: 5000 }
    );
  }
}
