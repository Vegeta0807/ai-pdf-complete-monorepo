import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Subject, takeUntil, take } from 'rxjs';
import { ApiService, ChatRequest } from '../../services/api.service';
import { PdfStateService } from '../../services/pdf-state.service';
import { PdfNavigationService } from '../../services/pdf-navigation.service';

export interface Citation {
  id: number;
  pageNumber: number | null;
  text: string;
  sourceLabel: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  isTyping?: boolean;
  citations?: Citation[];
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatChipsModule,
    MatTooltipModule
  ],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.scss',
  animations: [
    trigger('messageSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('typingIndicator', [
      state('typing', style({ opacity: 1 })),
      state('idle', style({ opacity: 0 })),
      transition('idle => typing', animate('200ms ease-in')),
      transition('typing => idle', animate('200ms ease-out'))
    ])
  ]
})
export class ChatbotComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;
  @Output() userMessageSent = new EventEmitter<void>();
  @Output() citationClicked = new EventEmitter<Citation>();
  @Input() pdfSrc: Uint8Array | null = null;

  private destroy$ = new Subject<void>();

  messages: ChatMessage[] = [];
  currentMessage = '';
  isLoading = false;
  isTyping = false;
  isUploading = false;
  pdfId: string | null = null;

  constructor(
    private apiService: ApiService,
    private pdfStateService: PdfStateService,
    private pdfNavigationService: PdfNavigationService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    // Subscribe to PDF state to get the uploaded PDF ID and upload status
    this.pdfStateService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        const previousPdfId = this.pdfId;
        const wasUploading = this.isUploading;

        this.pdfId = state.pdfId;
        this.isUploading = state.isUploading || state.isProcessing;

        // Handle upload completion - only show completion message if PDF is visible
        if (wasUploading && !state.isUploading && state.isUploaded && state.pdfId && this.pdfSrc) {
          this.handleUploadComplete(state);
        }

        // Update welcome message when PDF state changes
        if (previousPdfId !== this.pdfId) {
          this.updateWelcomeMessage();
        }
      });

    // Add initial welcome message
    this.updateWelcomeMessage();
  }

  hasPdfVisible(): boolean {
    // Check if there's a PDF already visible in the viewer
    // This prevents showing the upload loader when PDF is already rendered
    return !!this.pdfSrc;
  }

  private handleUploadComplete(state: any) {
    // Add a completion message to the chat
    const filename = state.filename || 'your document';
    const truncatedFilename = this.truncateText(filename, 25);
    const pages = state.pages || 'multiple';

    const completionMessage = `✅ Perfect! I've successfully processed "${truncatedFilename}" (${pages} pages). Your document is now ready for analysis. I can help you with:

• Summarizing key points and main ideas
• Answering specific questions about the content
• Finding relevant information quickly
• Explaining complex concepts
• Comparing different sections

What would you like to know about your document?`;

    this.addMessage({
      id: this.generateId(),
      content: completionMessage,
      isUser: false,
      timestamp: new Date()
    });
  }

  private updateWelcomeMessage() {
    // Clear existing messages if this is an update
    if (this.messages.length > 0 && !this.messages[0].isUser) {
      this.messages = this.messages.slice(1);
    }

    const welcomeMessage = this.pdfId
      ? "Hello! I can see you have a PDF uploaded. Ask me any questions about it!"
      : "Hello! I'm your AI assistant. Upload a PDF first, then I can help you analyze and discuss it!";

    this.addMessage({
      id: this.generateId(),
      content: welcomeMessage,
      isUser: false,
      timestamp: new Date()
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit() {
    if (this.messageInput) {
      this.setupAutoResize();
    }
  }

  private setupAutoResize() {
    const textarea = this.messageInput.nativeElement;

    const autoResize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    };

    textarea.addEventListener('input', autoResize);
    textarea.addEventListener('paste', () => {
      setTimeout(autoResize, 0);
    });
  }

  sendMessage() {
    if (!this.currentMessage.trim() || this.isLoading) {
      return;
    }

    // Check if PDF is uploaded
    if (!this.pdfId) {
      this.snackBar.open('Please upload a PDF first to start chatting!', 'Close', { duration: 3000 });
      return;
    }

    const userMessage: ChatMessage = {
      id: this.generateId(),
      content: this.currentMessage.trim(),
      isUser: true,
      timestamp: new Date()
    };

    this.addMessage(userMessage);
    const messageToSend = this.currentMessage;
    this.currentMessage = '';
    this.userMessageSent.emit();
    this.sendToAI(messageToSend);
  }

  private sendToAI(userMessage: string) {
    this.isLoading = true;
    this.isTyping = true;

    const chatRequest: ChatRequest = {
      message: userMessage,
      documentId: this.pdfId || undefined
    };

    this.apiService.sendChatMessage(chatRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isTyping = false;
          this.isLoading = false;

          const aiMessage: ChatMessage = {
            id: this.generateId(),
            content: response.response,
            isUser: false,
            timestamp: new Date(),
            citations: response.citations || []
          };

          this.addMessage(aiMessage);
        },
        error: (error) => {
          this.isTyping = false;
          this.isLoading = false;

          const errorMessage: ChatMessage = {
            id: this.generateId(),
            content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
            isUser: false,
            timestamp: new Date()
          };

          this.addMessage(errorMessage);
          this.snackBar.open('Failed to get AI response', 'Close', { duration: 3000 });
        }
      });
  }



  private addMessage(message: ChatMessage) {
    this.messages.push(message);
    setTimeout(() => this.scrollToBottom(), 100);
  }

  private scrollToBottom() {
    const chatContainer = document.querySelector('.chat-messages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substring(2, 11);
  }

  // Helper method to truncate text for display
  private truncateText(text: string, maxLength: number = 25): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearChat() {
    this.messages = [];
    this.ngOnInit();
  }

  trackByMessageId(_: number, message: ChatMessage): string {
    return message.id;
  }

  /**
   * Generate a more informative tooltip for citations
   */
  getCitationTooltip(citation: Citation): string {
    const pageInfo = citation.pageNumber ? `Page ${citation.pageNumber}` : 'Document reference';
    const preview = citation.text.length > 100 ?
      citation.text.substring(0, 100) + '...' :
      citation.text;

    return `${pageInfo}\n\nContent preview:\n"${preview}"\n\nClick to navigate to this section`;
  }

  /**
   * Navigate to a specific page when a citation is clicked
   */
  onCitationClick(citation: Citation): void {

    // Emit citation click to parent component (for mobile PDF viewer)
    this.citationClicked.emit(citation);

    if (citation.pageNumber && citation.pageNumber > 0) {
      // Try to navigate
      this.pdfNavigationService.navigateToPage(citation.pageNumber);

      // Removed message toaster and external link per UI requirements

      // Visual feedback - scroll to PDF viewer and highlight
      setTimeout(() => {
        const pdfViewer = document.querySelector('.pdf-viewer') ||
                         document.querySelector('.pdf-content') ||
                         document.querySelector('iframe');
        if (pdfViewer) {
          pdfViewer.scrollIntoView({ behavior: 'smooth', block: 'start' });

          // Add visual highlight effect
          const htmlElement = pdfViewer as HTMLElement;
          htmlElement.style.border = '3px solid #8B5CF6';
          htmlElement.style.borderRadius = '8px';
          htmlElement.style.transition = 'all 0.3s ease';

          // Remove highlight after 3 seconds
          setTimeout(() => {
            htmlElement.style.border = '';
            htmlElement.style.borderRadius = '';
          }, 3000);
        }
      }, 500);

    } else {
      this.snackBar.open(
        `📄 This reference doesn't have specific page information, but the content is from your uploaded document.`,
        'Close',
        { duration: 4000 }
      );
    }
  }

  /**
   * Open PDF in new tab with specific page
   */
  private openPdfInNewTab(pageNumber: number): void {
    // Get the current PDF blob URL from the PDF state service
    this.pdfStateService.state$.pipe(take(1)).subscribe(state => {
      const pdfState = state as any;
      if (pdfState.file) {
        const blob = new Blob([pdfState.file], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const urlWithPage = `${url}#page=${pageNumber}`;
        window.open(urlWithPage, '_blank');

        // Clean up the URL after a delay
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
      }
    });
  }

}
