import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpEventType } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, timeout, filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

export interface ChatRequest {
  message: string;
  documentId?: string;
}

export interface Citation {
  id: number;
  pageNumber: number | null;
  text: string;
  sourceLabel: string;
}

export interface Source {
  id: number;
  content: string;
  similarity: number;
  pageNumber: number | null;
  chunkIndex: number | null;
  metadata: any;
}

export interface ChatResponse {
  response: string;
  sources?: Source[];
  citations?: Citation[];
  confidence?: number;
  tokensUsed?: number;
}

export interface UploadResponse {
  documentId: string;
  filename: string;
  fileSize: number;
  numPages?: number;
  chunksCreated?: number;
  processingTime?: number;
  isBackgroundProcessing: boolean;
  jobId?: string;
  estimatedProcessingTime?: string;
}

export interface JobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  statusMessage?: string;
  documentId: string;
  filename: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  /**
   * Upload PDF file to backend
   */
  uploadPdf(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('pdf', file);

    // Calculate timeout based on file size (minimum 2 minutes, +30 seconds per MB)
    const timeoutMs = Math.max(120000, 30000 + (file.size / 1024 / 1024) * 30000);

    return this.http.post<ApiResponse<UploadResponse>>(`${this.baseUrl}/pdf/upload`, formData, {
      // Add timeout and progress reporting
      reportProgress: true,
      observe: 'events'
    }).pipe(
      timeout(timeoutMs),
      filter((event: any) => event.type === HttpEventType.Response),
      map((event: any) => {
        const response = event.body;
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Upload failed');
      }),
      catchError(error => {
        if (error.name === 'TimeoutError') {
          throw new Error(`Upload timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try a smaller file or check your connection.`);
        }
        return this.handleError(error);
      })
    );
  }

  /**
   * Send chat message to AI
   */
  sendChatMessage(request: ChatRequest): Observable<ChatResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<ApiResponse<ChatResponse>>(`${this.baseUrl}/chat/message`, request, { headers })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Chat request failed');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get PDF content/text
   */
  getPdfContent(pdfId: string): Observable<{ content: string; pages: number }> {
    return this.http.get<ApiResponse<{ content: string; pages: number }>>(`${this.baseUrl}/pdf/${pdfId}/content`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to get PDF content');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Check backend health
   */
  checkHealth(): Observable<{ status: string; timestamp: string }> {
    return this.http.get<ApiResponse<{ status: string; timestamp: string }>>(`${this.baseUrl}/health`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error('Health check failed');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: any): Observable<never> => {
    
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.status === 0) {
      errorMessage = 'Unable to connect to server. Please check if the backend is running.';
    } else if (error.status >= 400 && error.status < 500) {
      errorMessage = 'Client error: ' + (error.statusText || 'Bad request');
    } else if (error.status >= 500) {
      errorMessage = 'Server error: ' + (error.statusText || 'Internal server error');
    }

    return throwError(() => new Error(errorMessage));
  }

  /**
   * Get job status for background processing
   */
  getJobStatus(jobId: string): Observable<JobStatus> {
    return this.http.get<ApiResponse<JobStatus>>(`${this.baseUrl}/pdf/job/${jobId}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to get job status');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Poll job status until completion
   */
  pollJobStatus(jobId: string, intervalMs: number = 2000): Observable<JobStatus> {
    return new Observable(observer => {
      const poll = () => {
        this.getJobStatus(jobId).subscribe({
          next: (status) => {
            observer.next(status);

            if (status.status === 'completed' || status.status === 'failed') {
              observer.complete();
            } else {
              setTimeout(poll, intervalMs);
            }
          },
          error: (error) => {
            observer.error(error);
          }
        });
      };

      poll();
    });
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/pdf/queue/stats`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to get queue stats');
        }),
        catchError(this.handleError)
      );
  }
}
