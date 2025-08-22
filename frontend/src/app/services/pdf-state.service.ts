import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { ApiService, UploadResponse } from './api.service';

export interface PdfState {
  file: File | null;
  pdfId: string | null;
  filename: string | null;
  pages: number | null;
  isUploading: boolean;
  isProcessing: boolean; // Backend processing (parsing, vectorization)
  isUploaded: boolean;
  uploadError: string | null;
  processingStage: 'idle' | 'uploading' | 'parsing' | 'vectorizing' | 'complete' | 'error';
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
        this.updateState({
          pdfId: response.documentId, // Map documentId to pdfId for internal use
          pages: response.numPages || response.chunksCreated, // Use numPages from backend, fallback to chunksCreated
          isUploading: false,
          isProcessing: false,
          isUploaded: true,
          uploadError: null,
          processingStage: 'complete'
        });
      }),
      catchError(error => {
        this.updateState({
          isUploading: false,
          isProcessing: false,
          isUploaded: false,
          uploadError: error.message,
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
   * Update state partially
   */
  private updateState(partialState: Partial<PdfState>): void {
    const currentState = this.stateSubject.value;
    this.stateSubject.next({ ...currentState, ...partialState });
  }
}
