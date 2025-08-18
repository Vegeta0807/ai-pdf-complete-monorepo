import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { RouterModule } from '@angular/router';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import { PdfStateService } from '../../services/pdf-state.service';
import { PdfNavigationService } from '../../services/pdf-navigation.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    RouterModule
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('staggerAnimation', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(30px)' }),
          stagger(200, [
            animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  private observer!: IntersectionObserver;

  features = [
    {
      icon: 'picture_as_pdf',
      title: 'PDF Viewer',
      description: 'Advanced PDF rendering with zoom, navigation, and search capabilities'
    },
    {
      icon: 'chat',
      title: 'AI Chatbot',
      description: 'Intelligent conversation about your PDF content with AI assistance'
    },
    {
      icon: 'search',
      title: 'Smart Search',
      description: 'Find information quickly with AI-powered search and highlighting'
    },
    {
      icon: 'analytics',
      title: 'Document Analysis',
      description: 'Get insights and summaries from your PDF documents automatically'
    }
  ];

  constructor(private elementRef: ElementRef, private pdfState: PdfStateService, private pdfNav: PdfNavigationService) {}

  ngOnInit() {
    // Clear all relevant app states when landing page loads
    this.pdfState.clearPdf();
    this.pdfNav.setTotalPages(1);

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );
  }

  ngAfterViewInit() {
    const animatedElements = this.elementRef.nativeElement.querySelectorAll('.animate-on-scroll');
    animatedElements.forEach((element: Element) => {
      this.observer.observe(element);
    });
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
