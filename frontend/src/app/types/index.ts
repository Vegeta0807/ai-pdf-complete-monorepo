// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Chat Types
export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

export interface ChatRequest {
  message: string;
  pdfId?: string;
}

export interface ChatResponse {
  response: string;
  sources?: string[];
}

// PDF Types
export interface UploadResponse {
  pdfId: string;
  filename: string;
  pages: number;
  message: string;
}

export interface PdfContent {
  content: string;
  pages: number;
}

export interface PdfState {
  file: File | null;
  pdfId: string | null;
  filename: string | null;
  pages: number | null;
  isUploading: boolean;
  isUploaded: boolean;
  uploadError: string | null;
}

// Health Check Types
export interface HealthResponse {
  status: string;
  timestamp: string;
}

// Error Types
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}
