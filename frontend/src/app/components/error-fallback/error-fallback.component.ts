import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { ErrorState, FallbackConfig } from '../../interfaces/error-state.interface';

@Component({
  selector: 'app-error-fallback',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './error-fallback.component.html',
  styleUrl: './error-fallback.component.scss'
})
export class ErrorFallbackComponent {
  @Input() errorState!: ErrorState;
  @Input() config: FallbackConfig = {
    showRetryButton: true,
    showContactSupport: false,
    showOfflineMode: false
  };

  @Output() retry = new EventEmitter<void>();
  @Output() contactSupport = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();

  getErrorIcon(): string {
    switch (this.errorState.errorType) {
      case 'network':
        return 'wifi_off';
      case 'server':
        return 'error_outline';
      case 'timeout':
        return 'schedule';
      case 'upload':
        return 'cloud_off';
      case 'processing':
        return 'build_circle';
      default:
        return 'error';
    }
  }

  getErrorTitle(): string {
    switch (this.errorState.errorType) {
      case 'network':
        return 'Connection Problem';
      case 'server':
        return 'Server Error';
      case 'timeout':
        return 'Request Timed Out';
      case 'upload':
        return 'Upload Failed';
      case 'processing':
        return 'Processing Error';
      default:
        return 'Something Went Wrong';
    }
  }

  getErrorDescription(): string {
    if (this.config.customMessage) {
      return this.config.customMessage;
    }

    switch (this.errorState.errorType) {
      case 'network':
        return 'Please check your internet connection and try again.';
      case 'server':
        return 'Our servers are experiencing issues. Please try again in a few moments.';
      case 'timeout':
        return 'The request took too long to complete. This might be due to a large file or slow connection.';
      case 'upload':
        return 'Failed to upload your file. Please check the file format and size, then try again.';
      case 'processing':
        return 'We encountered an issue processing your document. Please try uploading it again.';
      default:
        return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
    }
  }

  onRetry(): void {
    if (this.errorState.retryable && this.config.showRetryButton) {
      this.retry.emit();
    }
  }

  onContactSupport(): void {
    if (this.config.showContactSupport) {
      this.contactSupport.emit();
    }
  }

  onDismiss(): void {
    this.dismiss.emit();
  }

  shouldShowRetry(): boolean {
    return this.config.showRetryButton && 
           this.errorState.retryable && 
           (this.errorState.retryCount || 0) < (this.errorState.maxRetries || 3);
  }
}
