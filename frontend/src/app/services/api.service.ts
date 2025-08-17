import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
  chunksCreated: number;
  processingTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  /**
   * Upload PDF file to backend
   */
  uploadPdf(file: File): Observable<UploadResponse> {
    console.log('API Service: Uploading file to backend:', file.name); // Debug log
    const formData = new FormData();
    formData.append('pdf', file);

    console.log('API Service: Making POST request to:', `${this.baseUrl}/pdf/upload`); // Debug log
    return this.http.post<ApiResponse<UploadResponse>>(`${this.baseUrl}/pdf/upload`, formData)
      .pipe(
        map(response => {
          console.log('API Service: Backend response:', response); // Debug log
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Upload failed');
        }),
        catchError(this.handleError)
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
    console.error('API Error:', error);
    
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
}
