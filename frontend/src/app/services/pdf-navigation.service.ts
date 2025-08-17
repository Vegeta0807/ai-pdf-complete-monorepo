import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PdfNavigationService {
  private currentPageSubject = new BehaviorSubject<number>(1);
  public currentPage$ = this.currentPageSubject.asObservable();

  private totalPagesSubject = new BehaviorSubject<number>(1);
  public totalPages$ = this.totalPagesSubject.asObservable();

  constructor() { }

  /**
   * Navigate to a specific page in the PDF
   * @param pageNumber - The page number to navigate to
   */
  navigateToPage(pageNumber: number): void {
    console.log(`🔗 Navigation service: navigateToPage(${pageNumber}), total pages: ${this.totalPagesSubject.value}`);
    if (pageNumber >= 1 && pageNumber <= this.totalPagesSubject.value) {
      console.log(`🔗 Navigation service: Emitting page ${pageNumber}`);
      this.currentPageSubject.next(pageNumber);
      this.scrollToPdfPage(pageNumber);
    } else {
      console.warn(`🔗 Navigation service: Page ${pageNumber} out of range (1-${this.totalPagesSubject.value})`);
    }
  }

  /**
   * Set the total number of pages in the PDF
   * @param totalPages - Total number of pages
   */
  setTotalPages(totalPages: number): void {
    console.log(`🔗 Navigation service: setTotalPages(${totalPages})`);
    this.totalPagesSubject.next(totalPages);
  }

  /**
   * Get the current page number
   */
  getCurrentPage(): number {
    return this.currentPageSubject.value;
  }

  /**
   * Get the total number of pages
   */
  getTotalPages(): number {
    return this.totalPagesSubject.value;
  }

  /**
   * Scroll to a specific page in the PDF viewer
   * This method attempts to navigate the PDF iframe to the specified page
   */
  private scrollToPdfPage(pageNumber: number): void {
    // Strategy 1: Try to navigate iframe using URL fragment
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (iframe && iframe.src) {
      try {
        // For PDF iframes, we can append #page=X to navigate to a specific page
        const baseUrl = iframe.src.split('#')[0];
        iframe.src = `${baseUrl}#page=${pageNumber}`;
        console.log(`🔗 Navigated PDF iframe to page ${pageNumber}`);
        return;
      } catch (error) {
        console.warn('Could not navigate iframe to page:', error);
      }
    }

    // Strategy 2: Try to find PDF.js page elements (fallback)
    const pdfPage = document.querySelector(`[data-page-number="${pageNumber}"]`);
    if (pdfPage) {
      pdfPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      console.log(`📄 Scrolled to PDF.js page ${pageNumber}`);
      return;
    }

    // Strategy 3: Estimate scroll position based on page number (last resort)
    const pdfContainer = document.querySelector('.pdf-content') ||
                        document.querySelector('.pdf-viewer') ||
                        document.querySelector('[class*="pdf"]');

    if (pdfContainer) {
      const totalPages = this.getTotalPages();
      const scrollPercentage = (pageNumber - 1) / Math.max(totalPages - 1, 1);
      const maxScroll = pdfContainer.scrollHeight - pdfContainer.clientHeight;
      const targetScroll = maxScroll * scrollPercentage;

      pdfContainer.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
      console.log(`📜 Estimated scroll to page ${pageNumber}`);
    }
  }

  /**
   * Highlight a specific area of the PDF (future enhancement)
   * @param pageNumber - Page number
   * @param coordinates - Optional coordinates for highlighting
   */
  highlightArea(pageNumber: number, coordinates?: { x: number, y: number, width: number, height: number }): void {
    this.navigateToPage(pageNumber);
    
    // Future enhancement: Add highlighting functionality
    if (coordinates) {
      console.log(`Would highlight area on page ${pageNumber}:`, coordinates);
    }
  }
}
