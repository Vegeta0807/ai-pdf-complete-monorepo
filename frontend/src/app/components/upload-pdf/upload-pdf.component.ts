import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { Subject, takeUntil } from 'rxjs';
import { PdfStateService, PdfState } from '../../services/pdf-state.service';

@Component({
  selector: 'app-upload-pdf',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatCardModule
  ],
  templateUrl: './upload-pdf.component.html',
  styleUrl: './upload-pdf.component.scss'
})
export class UploadPdfComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  pdfState: PdfState = {
    file: null,
    pdfId: null,
    filename: null,
    pages: null,
    isUploading: false,
    isUploaded: false,
    uploadError: null
  };

  constructor(
    private pdfStateService: PdfStateService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Subscribe to PDF state changes
    this.pdfStateService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.pdfState = state;

        // Show success message when upload completes
        if (state.isUploaded && !state.uploadError) {
          this.snackBar.open(
            `PDF "${state.filename}" uploaded successfully! (${state.pages} pages)`,
            'Close',
            { duration: 5000 }
          );
        }

        // Show error message if upload fails
        if (state.uploadError) {
          this.snackBar.open(
            `Upload failed: ${state.uploadError}`,
            'Close',
            { duration: 8000 }
          );
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Helper method to truncate text for display
  truncateText(text: string, maxLength: number = 25): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  // Get truncated filename for display
  getTruncatedFilename(filename: string): string {
    return this.truncateText(filename, 25);
  }

  /**
   * Handle file selection
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Validate file type
      if (file.type !== 'application/pdf') {
        this.snackBar.open('Please select a PDF file', 'Close', { duration: 3000 });
        return;
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        this.snackBar.open('File size must be less than 10MB', 'Close', { duration: 3000 });
        return;
      }

      // Upload the file
      this.uploadFile(file);
    }
  }

  /**
   * Upload file to backend
   */
  private uploadFile(file: File): void {
    this.pdfStateService.uploadPdf(file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Upload successful
        },
        error: (error) => {
          // Upload failed
        }
      });
  }

  /**
   * Trigger file input click
   */
  triggerFileInput(): void {
    const fileInput = document.getElementById('pdf-file-input') as HTMLInputElement;
    fileInput?.click();
  }

  /**
   * Clear uploaded PDF
   */
  clearPdf(): void {
    this.pdfStateService.clearPdf();
    this.snackBar.open('PDF cleared', 'Close', { duration: 2000 });
  }
}
