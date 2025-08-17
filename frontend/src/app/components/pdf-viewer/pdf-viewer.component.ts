import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PdfStateService } from '../../services/pdf-state.service';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './pdf-viewer.component.html',
  styleUrl: './pdf-viewer.component.scss'
})
export class PdfViewerComponent implements OnInit, OnDestroy {

  constructor(
    private sanitizer: DomSanitizer,
    private pdfState: PdfStateService
  ) {}
  @Input() set pdfSrc(value: string | Uint8Array | null) {
    if (value instanceof Uint8Array) {
      const blob = new Blob([value as any], { type: 'application/pdf' });
      this.rawBlobUrl = URL.createObjectURL(blob);
      this.pdfBlobUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.rawBlobUrl);
    } else if (typeof value === 'string') {
      this.rawBlobUrl = value;
      this.pdfBlobUrl = this.sanitizer.bypassSecurityTrustResourceUrl(value);
    } else {
      if (this.rawBlobUrl) {
        URL.revokeObjectURL(this.rawBlobUrl);
        this.rawBlobUrl = null;
        this.pdfBlobUrl = null;
      }
    }
    this._pdfSrc = value;
  }
  get pdfSrc(): string | Uint8Array | null {
    return this._pdfSrc;
  }
  private _pdfSrc: string | Uint8Array | null = null;

  @ViewChild('fileInput', { static: false }) fileInput?: ElementRef<HTMLInputElement>;

  zoom = 1.0;
  page = 1;
  totalPages = 0;
  isLoaded = false;
  error: string | null = null;
  selectedFile: File | null = null;
  pdfBlobUrl: SafeResourceUrl | null = null;
  private rawBlobUrl: string | null = null;

  ngOnInit() {}

  ngOnDestroy() {
    // Cleanup blob URL
    if (this.rawBlobUrl) {
      URL.revokeObjectURL(this.rawBlobUrl);
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];

    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;

      // Upload to backend for AI processing
      this.pdfState.uploadPdf(file).subscribe({
        next: (response) => {
          console.log('PDF uploaded successfully from viewer:', response);
        },
        error: (error) => {
          console.error('PDF upload failed from viewer:', error);
          this.error = `Upload failed: ${error.message}`;
        }
      });

      // Also load for local viewing
      const fileReader = new FileReader();
      fileReader.onload = () => {
        this.pdfSrc = new Uint8Array(fileReader.result as ArrayBuffer);
        this.error = null;
      };
      fileReader.onerror = () => {
        this.error = 'Error reading file';
      };
      fileReader.readAsArrayBuffer(file);
    } else {
      this.error = 'Please select a valid PDF file';
    }
  }

  onPdfLoadComplete(pdf: any) {
    this.totalPages = pdf?.pagesCount ?? pdf?.numPages ?? 0;
    this.isLoaded = true;
    this.error = null;
  }

  onPdfLoadError(error: any) {
    this.error = 'Error loading PDF: ' + (error?.message || error);
    this.isLoaded = false;
  }

  // Navigation methods
  previousPage() {
    if (this.page > 1) {
      this.page--;
    }
  }

  nextPage() {
    if (this.page < this.totalPages) {
      this.page++;
    }
  }

  goToPage(pageNumber: number) {
    if (pageNumber >= 1 && pageNumber <= this.totalPages) {
      this.page = pageNumber;
    }
  }

  // Zoom methods
  zoomIn() {
    this.zoom = Math.min(this.zoom + 0.25, 3.0);
  }

  zoomOut() {
    this.zoom = Math.max(this.zoom - 0.25, 0.5);
  }

  resetZoom() {
    this.zoom = 1.0;
  }

  // Download functionality
  downloadPdf() {
    if (this.selectedFile) {
      const url = URL.createObjectURL(this.selectedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.selectedFile.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  triggerFileInput() {
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.click();
    } else {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.click();
      }
    }
  }
}
