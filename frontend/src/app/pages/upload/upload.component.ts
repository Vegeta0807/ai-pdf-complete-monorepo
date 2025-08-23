import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PdfStateService } from '../../services/pdf-state.service';
import { ErrorFallbackComponent } from '../../components/error-fallback/error-fallback.component';
import { ErrorState, FallbackConfig } from '../../interfaces/error-state.interface';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, ErrorFallbackComponent],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss'
})
export class UploadComponent implements OnInit, OnDestroy {
  isDragOver = false;
  selectedFile: File | null = null;
  private destroy$ = new Subject<void>();

  // Error handling properties
  errorState: ErrorState | null = null;
  fallbackConfig: FallbackConfig = {
    showRetryButton: true,
    showContactSupport: false,
    showOfflineMode: false
  };

  constructor(private router: Router, private pdfState: PdfStateService) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        this.selectedFile = file;
        this.uploadFile(file);
      }
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      this.uploadFile(file);
    }
  }

  uploadFile(file: File) {
    // Upload to backend and navigate to chat when successful
    this.pdfState.uploadPdf(file).subscribe({
      next: () => {
        this.router.navigate(['/chat']);
      },
      error: () => {
        // Stay on upload page if upload fails - error handling is done by the service
        // The upload component will show the error state
      }
    });
  }

  triggerFileInput() {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput.click();
  }

  ngOnInit(): void {
    // Subscribe to PDF state changes to detect upload errors
    this.pdfState.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        if (state.processingStage === 'error' && state.uploadError) {
          // Only show error fallback for server/connection errors
          if (this.isServerError(state.uploadError)) {
            this.handleUploadError();
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Check if this is a server/connection error
   */
  private isServerError(errorMessage: string): boolean {
    const serverErrorPatterns = [
      'Http failure response',
      ': 0 Unknown Error',
      'status: 0',
      'ERR_CONNECTION_REFUSED',
      'Cannot connect to server',
      'Server error. Please try again later',
      'Upload timed out'
    ];

    return serverErrorPatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Handle upload errors and show clean fallback
   */
  private handleUploadError(): void {
    this.errorState = {
      hasError: true,
      errorType: 'processing',
      errorMessage: 'Processing failed',
      timestamp: new Date(),
      retryable: true,
      retryCount: 0,
      maxRetries: 1
    };

    this.fallbackConfig = {
      showRetryButton: true,
      showContactSupport: false,
      showOfflineMode: false,
      customMessage: 'Processing failed',
      actionLabel: 'Try Again'
    };
  }

  /**
   * Handle error fallback actions
   */
  onErrorRetry(): void {
    this.clearError();
    this.resetToOriginalState();
  }

  onErrorDismiss(): void {
    this.clearError();
    this.resetToOriginalState();
  }

  /**
   * Clear error state
   */
  private clearError(): void {
    this.errorState = null;
  }

  /**
   * Reset component to original state
   */
  private resetToOriginalState(): void {
    // Clear file selection and loading state
    this.selectedFile = null;
    this.isDragOver = false;

    // Clear PDF state service
    this.pdfState.clearPdf();

    // Reset file input
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }
}
