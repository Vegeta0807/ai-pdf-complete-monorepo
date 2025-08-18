import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { Subject, takeUntil } from 'rxjs';

import { PdfStateService } from '../../services/pdf-state.service';
import { PdfNavigationService } from '../../services/pdf-navigation.service';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    PdfViewerModule
  ],
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss']
})
export class PdfViewerComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput', { static: false }) fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('pdfViewer', { static: false }) pdfViewer?: any;

  // PDF properties
  currentPage = 1;
  totalPages = 0;
  zoom = 1.0;
  isLoading = false;
  isProcessing = false; // Backend processing state
  error: string | null = null;
  selectedFile: File | null = null;
  loadingMessage = 'Loading PDF...';

  private destroy$ = new Subject<void>();
  private pageTrackingInterval?: any;

  constructor(
    private pdfState: PdfStateService,
    private pdfNavigationService: PdfNavigationService
  ) {}

  private _pdfSrc: Uint8Array | null = null;

  @Input() set pdfSrc(value: Uint8Array | null) {
    console.log('📄 PDF Viewer: Setting pdfSrc', value ? 'with data' : 'null');
    this._pdfSrc = value;

    // PDF can be rendered immediately from file data
    // No need for a separate rendering loader since PDF rendering is fast
    this.isLoading = false;
  }

  private startPdfLoading() {
    // Rendering loader not needed; render immediately when pdfSrc is set
    this.isLoading = false;
    this.error = null;
  }

  get pdfSrc(): Uint8Array | null {
    return this._pdfSrc;
  }

  ngOnInit() {
    // Subscribe to navigation service for automatic navigation
    this.pdfNavigationService.currentPage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(pageNumber => {
        console.log(`📄 Navigation service triggered: page ${pageNumber}`);
        this.goToPage(pageNumber);
      });

    // Subscribe to PDF state changes
    this.pdfState.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        const pdfState = state as any;

        // Track backend processing state
        const wasProcessing = this.isProcessing;
        this.isProcessing = pdfState.isProcessing || pdfState.isUploading;

        // Update loading message based on processing stage
        switch (pdfState.processingStage) {
          case 'uploading':
            this.loadingMessage = 'Uploading PDF to server...';
            break;
          case 'parsing':
            this.loadingMessage = 'Parsing PDF structure...';
            break;
          case 'vectorizing':
            this.loadingMessage = 'Creating searchable index...';
            break;
          case 'complete':
            this.loadingMessage = 'Rendering PDF...';
            break;
          default:
            this.loadingMessage = 'Processing PDF...';
        }

        // If processing just completed, trigger PDF rendering
        if (wasProcessing && !this.isProcessing && pdfState.isUploaded && this._pdfSrc) {
          this.startPdfLoading();
        }

        if (pdfState.pages && pdfState.pages !== this.totalPages) {
          console.log(`📄 PDF state changed: updating total pages from ${this.totalPages} to ${pdfState.pages}`);
          this.totalPages = pdfState.pages;
          this.pdfNavigationService.setTotalPages(pdfState.pages);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    // Clear page tracking interval
    if (this.pageTrackingInterval) {
      clearInterval(this.pageTrackingInterval);
    }
  }

  // File handling
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      console.log(`📄 File selected: ${file.name}`);
      this.selectedFile = file;
      this.processFile(file);
    } else {
      this.error = 'Please select a valid PDF file';
    }
  }

  private processFile(file: File) {
    // Start PDF viewer loading for immediate display
    this.startPdfLoading();

    // Convert file to Uint8Array for ng2-pdf-viewer (for immediate display)
    const fileReader = new FileReader();
    fileReader.onload = () => {
      const arrayBuffer = fileReader.result as ArrayBuffer;
      // Set the PDF source directly without triggering additional loading state
      this._pdfSrc = new Uint8Array(arrayBuffer);
      console.log(`📄 PDF loaded from file reader, size: ${arrayBuffer.byteLength} bytes`);

      // Only upload to backend if this is a new file (not already uploaded)
      if (!this.pdfState.isUploaded || this.pdfState.currentState.filename !== file.name) {
        this.uploadToBackend(file);
      }
    };
    fileReader.onerror = () => {
      this.error = 'Error reading file';
      this.isLoading = false;
    };
    fileReader.readAsArrayBuffer(file);
  }

  private uploadToBackend(file: File) {
    // Upload to backend (this will trigger the chatbot loader via PdfStateService)
    this.pdfState.uploadPdf(file).subscribe({
      next: (response) => {
        console.log('📄 PDF uploaded successfully:', response);
      },
      error: (error) => {
        console.error('📄 PDF upload failed:', error);
        this.error = 'Failed to upload PDF to server';
      }
    });
  }

  // PDF viewer events
  onPdfLoaded(pdf: any) {
    console.log(`📄 PDF loaded: ${pdf.numPages} pages`);
    this.totalPages = pdf.numPages;
    this.currentPage = 1;
    this.pdfNavigationService.setTotalPages(pdf.numPages);
    this.isLoading = false;
    this.error = null;

    // Start page tracking
    this.startPageTracking();
  }

  onPageRendered(event: any) {
    console.log(`📄 Page rendered:`, event);
  }

  private startPageTracking() {
    // Clear any existing interval
    if (this.pageTrackingInterval) {
      clearInterval(this.pageTrackingInterval);
    }

    // Poll every 500ms to check current visible page
    this.pageTrackingInterval = setInterval(() => {
      this.detectCurrentPage();
    }, 500);
  }

  private detectCurrentPage() {
    try {
      // Try to get the current page from the PDF viewer component
      if (this.pdfViewer?.pdfViewer?.currentPageNumber) {
        const detectedPage = this.pdfViewer.pdfViewer.currentPageNumber;
        if (detectedPage !== this.currentPage && detectedPage >= 1 && detectedPage <= this.totalPages) {
          console.log(`📄 Detected page change: ${this.currentPage} → ${detectedPage}`);
          this.currentPage = detectedPage;
        }
      }
    } catch (error) {
      // Silent fail - polling will continue
    }
  }

  onPdfError(error: any) {
    const message = (typeof error === 'string' ? error : (error?.message || '')).toLowerCase();
    const benignErrors = [
      'worker was destroyed',
      'rendering cancelled',
      'rendering canceled',
      'stream error'
    ];

    if (benignErrors.some(e => message.includes(e))) {
      console.warn('📄 Ignoring benign PDF.js error:', error);
      return;
    }

    console.error('📄 PDF error:', error);
    this.error = `Error loading PDF: ${error?.message || 'Unknown error'}`;
    this.isLoading = false;
  }

  // Navigation methods
  goToPage(pageNumber: number) {
    console.log(`📄 goToPage called: ${pageNumber} (current: ${this.currentPage}, total: ${this.totalPages})`);
    if (pageNumber >= 1 && pageNumber <= this.totalPages) {
      this.currentPage = pageNumber;
      console.log(`✅ Navigated to page ${pageNumber}`);
    } else {
      console.warn(`📄 Page ${pageNumber} is out of range (1-${this.totalPages})`);
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  // Zoom methods
  zoomIn() {
    this.zoom = Math.min(this.zoom + 0.25, 3.0);
    console.log(`📄 Zoom in: ${this.zoom}`);
  }

  zoomOut() {
    this.zoom = Math.max(this.zoom - 0.25, 0.5);
    console.log(`📄 Zoom out: ${this.zoom}`);
  }

  // Utility methods
  triggerFileInput() {
    this.fileInput?.nativeElement?.click();
  }

  // Drag and drop methods
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    // Check if the dragged items contain files
    if (event.dataTransfer?.types.includes('Files')) {
      // Add visual feedback for drag over
      const element = event.currentTarget as HTMLElement;
      element.classList.add('drag-over');
    }
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    // Only remove the class if we're actually leaving the element
    // (not just moving to a child element)
    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      element.classList.remove('drag-over');
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    // Remove visual feedback from all elements
    const element = event.currentTarget as HTMLElement;
    element.classList.remove('drag-over');

    // Also remove from upload area if it exists
    const uploadArea = element.querySelector('.upload-area');
    if (uploadArea) {
      uploadArea.classList.remove('drag-over');
    }

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Check if it's a PDF file
      if (file.type === 'application/pdf') {
        console.log(`📄 PDF dropped: ${file.name}`);
        this.handleDroppedFile(file);
      } else {
        this.error = 'Please drop a valid PDF file';
        console.warn('⚠️ Invalid file type dropped:', file.type);

        // Show error feedback
        setTimeout(() => {
          this.error = null;
        }, 3000);
      }
    }
  }

  private handleDroppedFile(file: File) {
    this.selectedFile = file;
    this.processFile(file);
  }

  private forceStopLoading() {
    console.log('📄 Force stopping loading state');
    this.isLoading = false;
    if (!this.totalPages && this._pdfSrc) {
      // Set a default page count if we have PDF data but no page info
      this.totalPages = 1;
      this.currentPage = 1;
      this.pdfNavigationService.setTotalPages(1);
    }
  }
}
