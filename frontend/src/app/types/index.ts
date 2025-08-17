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
  citations?: Citation[];
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
