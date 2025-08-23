import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { ApiService, UploadResponse, DocumentStatus } from './api.service';

export interface PdfState {
  file: File | null;
  pdfId: string | null;
  filename: string | null;
  pages: number | null;
  isUploading: boolean;
  isProcessing: boolean; // Backend processing (parsing, vectorization)
  isUploaded: boolean;
  uploadError: string | null;
  processingStage: 'idle' | 'uploading' | 'processing' | 'parsing' | 'vectorizing' | 'complete' | 'error';
}

@Injectable({ providedIn: 'root' })
export class PdfStateService {
  private initialState: PdfState = {
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

  private stateSubject = new BehaviorSubject<PdfState>(this.initialState);

  constructor(private apiService: ApiService) {}

  get state$(): Observable<PdfState> {
    return this.stateSubject.asObservable();
  }

  get currentState(): PdfState {
    return this.stateSubject.value;
  }

  // Legacy getters for backward compatibility
  get file(): File | null {
    return this.currentState.file;
  }

  get file$(): Observable<File | null> {
    return this.stateSubject.pipe(
      map(state => state.file)
    );
  }

  get pdfId(): string | null {
    return this.currentState.pdfId;
  }

  get isUploaded(): boolean {
    return this.currentState.isUploaded;
  }

  get isProcessing(): boolean {
    return this.currentState.isProcessing;
  }

  get processingStage(): string {
    return this.currentState.processingStage;
  }

  get isInProgress(): boolean {
    return this.currentState.isUploading || this.currentState.isProcessing;
  }

  /**
   * Upload PDF file to backend
   */
  uploadPdf(file: File): Observable<UploadResponse> {
    this.updateState({
      file,
      filename: file.name,
      isUploading: true,
      isProcessing: true,
      uploadError: null,
      isUploaded: false,
      processingStage: 'uploading'
    });

    return this.apiService.uploadPdf(file).pipe(
      tap(response => {
        // Upload completed, but processing may still be ongoing
        this.updateState({
          pdfId: response.documentId,
          pages: response.numPages,
          isUploading: false,
          // Keep isProcessing true if background processing is happening
          isProcessing: response.isProcessing || response.isBackgroundProcessing || false,
          isUploaded: true, // Upload is complete, but processing may continue
          uploadError: null,
          processingStage: response.isProcessing ? 'processing' : 'complete'
        });

        // If background processing is happening, start polling for status
        if (response.isProcessing || response.isBackgroundProcessing) {
          this.startStatusPolling(response.documentId);
        }
      }),
      catchError(error => {
        let errorMessage = 'Upload failed. Please try again.';

        // Better error message detection
        if (error.status === 0 || error.message?.includes('ERR_CONNECTION_REFUSED')) {
          errorMessage = 'Cannot connect to server. Please check if the backend is running.';
        } else if (error.status === 413) {
          errorMessage = 'File is too large. Please try a smaller file.';
        } else if (error.status === 415) {
          errorMessage = 'Invalid file type. Please upload a PDF file.';
        } else if (error.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (error.name === 'TimeoutError') {
          errorMessage = 'Upload timed out. Please try again.';
        } else if (error?.error?.message) {
          errorMessage = error.error.message;
        } else if (error?.message) {
          errorMessage = error.message;
        }

        this.updateState({
          isUploading: false,
          isProcessing: false,
          isUploaded: false,
          uploadError: errorMessage,
          processingStage: 'error'
        });
        return throwError(() => error);
      })
    );
  }

  /**
   * Set file without uploading (for preview)
   */
  setFile(file: File | null): void {
    this.updateState({
      file,
      filename: file?.name || null,
      pdfId: null,
      pages: null,
      isUploaded: false,
      isProcessing: false,
      uploadError: null,
      processingStage: file ? 'idle' : 'idle'
    });
  }

  /**
   * Clear all PDF state
   */
  clearPdf(): void {
    this.stateSubject.next(this.initialState);
  }

  /**
   * Clear only the error state
   */
  clearError(): void {
    this.updateState({
      uploadError: null,
      processingStage: this.currentState.isUploaded ? 'complete' : 'idle'
    });
  }

  /**
   * Update PDF state after background processing completion
   */
  setProcessingComplete(documentId: string, filename: string, pages: number): void {
    this.updateState({
      isUploaded: true,
      isUploading: false,
      isProcessing: false,
      uploadError: null,
      processingStage: 'complete',
      pdfId: documentId,
      filename: filename,
      pages: pages
    });
  }

  /**
   * Start polling document status for background processing
   */
  private startStatusPolling(documentId: string): void {
    this.apiService.pollDocumentStatus(documentId, 2000).subscribe({
      next: (status: DocumentStatus) => {
        this.updateProcessingStatus(status);
      },
      error: (error) => {
        console.error('Status polling error:', error);
        this.updateState({
          isProcessing: false,
          uploadError: 'Failed to track processing status',
          processingStage: 'error'
        });
      },
      complete: () => {
        // Polling completed (document finished processing)
        console.log('Document processing completed');
      }
    });
  }

  /**
   * Update processing status based on document status
   */
  private updateProcessingStatus(status: DocumentStatus): void {
    let processingStage: PdfState['processingStage'] = 'processing';

    switch (status.status) {
      case 'processing':
        processingStage = 'parsing';
        break;
      case 'vectorizing':
        processingStage = 'vectorizing';
        break;
      case 'completed':
        processingStage = 'complete';
        break;
      case 'error':
        processingStage = 'error';
        break;
    }

    this.updateState({
      isProcessing: status.isProcessing,
      processingStage,
      uploadError: status.status === 'error' ? 'Processing failed' : null,
      pages: status.metadata?.numPages || this.currentState.pages
    });
  }

  /**
   * Update state partially
   */
  private updateState(partialState: Partial<PdfState>): void {
    const currentState = this.stateSubject.value;
    this.stateSubject.next({ ...currentState, ...partialState });
  }
}
