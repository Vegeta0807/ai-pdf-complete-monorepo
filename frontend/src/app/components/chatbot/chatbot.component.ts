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
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Subject, takeUntil } from 'rxjs';
import { ApiService, ChatRequest } from '../../services/api.service';
import { PdfStateService } from '../../services/pdf-state.service';

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  isTyping?: boolean;
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
    MatSnackBarModule
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
            timestamp: new Date()
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
}
