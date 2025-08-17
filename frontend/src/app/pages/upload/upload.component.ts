import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PdfStateService } from '../../services/pdf-state.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss'
})
export class UploadComponent {
  isDragOver = false;
  selectedFile: File | null = null;

  constructor(private router: Router, private pdfState: PdfStateService) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        this.selectedFile = file;
        this.uploadFile(file);
      }
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      this.uploadFile(file);
    }
  }

  uploadFile(file: File) {
    // Upload to backend and navigate to chat when successful
    this.pdfState.uploadPdf(file).subscribe({
      next: (response) => {
        console.log('PDF uploaded successfully from upload page:', response);
        this.router.navigate(['/chat']);
      },
      error: (error) => {
        console.error('PDF upload failed from upload page:', error);
        // Stay on upload page if upload fails
      }
    });
  }

  triggerFileInput() {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput.click();
  }
}
