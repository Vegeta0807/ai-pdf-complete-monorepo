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
  error: string | null = null;
  selectedFile: File | null = null;

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

    if (value) {
      this.isLoading = true;
      this.error = null;

      // Add timeout to prevent infinite loading
      setTimeout(() => {
        if (this.isLoading) {
          console.warn('📄 PDF loading timeout, stopping loader');
          this.isLoading = false;
        }
      }, 10000); // 10 second timeout
    } else {
      this.isLoading = false;
    }
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
      this.error = null;
      this.isLoading = true;

      // Convert file to Uint8Array for ng2-pdf-viewer
      const fileReader = new FileReader();
      fileReader.onload = () => {
        const arrayBuffer = fileReader.result as ArrayBuffer;
        this.pdfSrc = new Uint8Array(arrayBuffer);
        console.log(`📄 PDF loaded from file reader, size: ${arrayBuffer.byteLength} bytes`);
      };
      fileReader.onerror = () => {
        this.error = 'Error reading file';
        this.isLoading = false;
      };
      fileReader.readAsArrayBuffer(file);

      // Also upload to backend
      this.pdfState.uploadPdf(file).subscribe({
        next: (response) => {
          console.log('📄 PDF uploaded successfully:', response);
        },
        error: (error) => {
          console.error('📄 PDF upload failed:', error);
          this.error = 'Failed to upload PDF to server';
        }
      });
    } else {
      this.error = 'Please select a valid PDF file';
    }
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
    console.error('📄 PDF error:', error);
    this.error = `Error loading PDF: ${error?.message || 'Unknown error'}`;
    this.isLoading = false;

    // Try to reset the PDF source to allow retry
    setTimeout(() => {
      if (this.error) {
        console.log('📄 Attempting to reset PDF viewer for retry');
        this._pdfSrc = null;
        setTimeout(() => {
          if (this.selectedFile) {
            this.onFileSelected({ target: { files: [this.selectedFile] } });
          }
        }, 1000);
      }
    }, 2000);
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

  forceStopLoading() {
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
