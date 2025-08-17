import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { PdfStateService } from '../../services/pdf-state.service';
import { CommonModule } from '@angular/common';
import { PdfViewerComponent } from '../../components/pdf-viewer/pdf-viewer.component';
import { ChatbotComponent } from '../../components/chatbot/chatbot.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    PdfViewerComponent,
    ChatbotComponent,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements OnInit, OnDestroy {
  pdfSrc: string | Uint8Array | null = null;
  hasUserSentMessage = false;
  private fileSubscription?: any;

  constructor(
    private pdfState: PdfStateService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnInit() {
    this.fileSubscription = this.pdfState.file$.subscribe(file => {
      this.handleFileChange(file);
    });
    this.handleFileChange(this.pdfState.file);
  }

  ngOnDestroy() {
    if (this.fileSubscription) {
      this.fileSubscription.unsubscribe();
    }
  }

  private handleFileChange(file: File | null) {
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.pdfSrc = new Uint8Array(reader.result as ArrayBuffer);
        this.zone.run(() => {
          this.cdr.detectChanges();
          this.cdr.markForCheck();
        });
      };
      reader.readAsArrayBuffer(file);
    } else {
      this.pdfSrc = null;
      this.zone.run(() => {
        this.cdr.detectChanges();
        this.cdr.markForCheck();
      });
    }
  }


  getDocumentTitle(): string {
    if (!this.pdfSrc && !this.pdfState.file) {
      return 'No document loaded';
    }

    if (this.pdfState.file) {
      return `${this.pdfState.file.name} is ready!`;
    }

    return 'Your document is ready!';
  }

  getDocumentSubtitle(): string {
    return '';
  }

  hasPdf(): boolean {
    return !!(this.pdfSrc || this.pdfState.file);
  }

  shouldShowSuggestions(): boolean {
    return !this.hasUserSentMessage;
  }

  getSuggestions(): string[] {
    if (!this.pdfSrc && !this.pdfState.file) {
      return [
        'Upload a PDF to start asking questions',
        'Drag and drop or click to select your document'
      ];
    }

    const fileName = this.pdfState.file?.name?.toLowerCase() || '';

    if (fileName.includes('report') || fileName.includes('analysis')) {
      return [
        'What are the key findings in this report?',
        'Can you summarize the main conclusions?',
        'What recommendations are provided?'
      ];
    } else if (fileName.includes('contract') || fileName.includes('agreement')) {
      return [
        'What are the main terms and conditions?',
        'What are the key obligations for each party?',
        'Are there any important dates or deadlines?'
      ];
    } else if (fileName.includes('manual') || fileName.includes('guide')) {
      return [
        'How do I get started with this?',
        'What are the main features explained?',
        'Are there any troubleshooting steps?'
      ];
    } else {
      return [
        'What is the main topic of this document?',
        'Can you summarize the key points?',
        'What are the most important details?'
      ];
    }
  }

  onUserMessageSent() {
    this.hasUserSentMessage = true;
  }
}
