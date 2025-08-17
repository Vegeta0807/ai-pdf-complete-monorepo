import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, Output, EventEmitter } from '@angular/core';
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

  private destroy$ = new Subject<void>();

  messages: ChatMessage[] = [];
  currentMessage = '';
  isLoading = false;
  isTyping = false;
  pdfId: string | null = null;

  constructor(
    private apiService: ApiService,
    private pdfStateService: PdfStateService,
    private pdfNavigationService: PdfNavigationService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    // Subscribe to PDF state to get the uploaded PDF ID
    this.pdfStateService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        const previousPdfId = this.pdfId;
        this.pdfId = state.pdfId;

        // Update welcome message when PDF state changes
        if (previousPdfId !== this.pdfId) {
          this.updateWelcomeMessage();
        }
      });

    // Add initial welcome message
    this.updateWelcomeMessage();
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

          console.error('Chat API error:', error);

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
   * Navigate to a specific page when a citation is clicked
   */
  onCitationClick(citation: Citation): void {
    console.log('🔗 Citation clicked:', citation);

    if (citation.pageNumber && citation.pageNumber > 0) {
      // Try to navigate
      this.pdfNavigationService.navigateToPage(citation.pageNumber);

      // Show enhanced feedback with manual navigation option
      const snackBarRef = this.snackBar.open(
        `📄 Reference found on page ${citation.pageNumber}. Use the page input in PDF viewer to navigate manually.`,
        'Open in New Tab',
        {
          duration: 8000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        }
      );

      // Handle "Open in New Tab" action
      snackBarRef.onAction().subscribe(() => {
        this.openPdfInNewTab(citation.pageNumber!);
      });

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
        `⚠️ Page information not available for this citation (Page: ${citation.pageNumber})`,
        'Close',
        { duration: 3000 }
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
