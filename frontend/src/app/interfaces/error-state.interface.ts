export interface ErrorState {
  hasError: boolean;
  errorType: 'network' | 'server' | 'timeout' | 'upload' | 'processing' | 'unknown';
  errorMessage: string;
  errorCode?: string;
  timestamp: Date;
  retryable: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export interface FallbackConfig {
  showRetryButton: boolean;
  showContactSupport: boolean;
  showOfflineMode: boolean;
  customMessage?: string;
  actionLabel?: string;
  onRetry?: () => void;
  onContactSupport?: () => void;
}
