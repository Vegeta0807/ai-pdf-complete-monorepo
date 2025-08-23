import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PdfErrorHandlerService {
  private originalConsoleError: (...args: any[]) => void;
  private isSuppressionActive = false;

  constructor() {
    // Store the original console.error function
    this.originalConsoleError = console.error.bind(console);
  }

  /**
   * Enable PDF.js error suppression
   * Should be called when PDF viewer component initializes
   */
  enableSuppression(): void {
    if (this.isSuppressionActive) {
      return; // Already active
    }

    console.error = (...args: any[]) => {
      if (this.isPdfJsError(args)) {
        // Suppress PDF.js initialization errors
        return;
      }
      
      // Log all other errors normally
      this.originalConsoleError(...args);
    };

    this.isSuppressionActive = true;
  }

  /**
   * Disable PDF.js error suppression
   * Should be called when PDF viewer component is destroyed
   */
  disableSuppression(): void {
    if (!this.isSuppressionActive) {
      return; // Already disabled
    }

    // Restore original console.error
    console.error = this.originalConsoleError;
    this.isSuppressionActive = false;
  }

  /**
   * Check if the error is related to PDF.js initialization
   */
  private isPdfJsError(args: any[]): boolean {
    // Convert all arguments to strings for comprehensive checking
    const fullErrorText = args.map(arg => {
      if (arg && typeof arg === 'object') {
        const objText = JSON.stringify(arg, null, 0);
        const stackText = arg.stack || '';
        const messageText = arg.message || '';
        return objText + stackText + messageText;
      }
      return String(arg || '');
    }).join(' ');

    // PDF.js error patterns that are safe to suppress
    const pdfJsErrorPatterns = [
      // Specific error patterns
      'Cannot read properties of undefined (reading \'_on\')',
      'Cannot read properties of undefined (reading \'_listeners\')',
      
      // Component and method patterns
      'PDFFindController',
      '_PdfViewerComponent',
      'initPDFServices',
      'setupViewer',
      'loadPDF',
      
      // File patterns
      'pdf_viewer.mjs',
      'ng2-pdf-viewer',
      
      // Stack trace patterns
      'at new PDFFindController',
      'at _PdfViewerComponent.initPDFServices',
      'at _PdfViewerComponent.setupViewer',
      'at _PdfViewerComponent.loadPDF'
    ];

    // Check if this error matches any PDF.js patterns
    return pdfJsErrorPatterns.some(pattern => 
      fullErrorText.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Get current suppression status
   */
  isActive(): boolean {
    return this.isSuppressionActive;
  }

  /**
   * Manually log a message (bypasses suppression)
   */
  forceLog(message: string, ...args: any[]): void {
    this.originalConsoleError(message, ...args);
  }
}
