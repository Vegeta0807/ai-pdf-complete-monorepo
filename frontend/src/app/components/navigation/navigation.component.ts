import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule
  ],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss'
})
export class NavigationComponent implements OnInit {
  currentRoute = '';

  navigationItems = [
    {
      label: 'Home',
      route: '/home',
      icon: 'home',
      description: 'Welcome page'
    },
    {
      label: 'PDF Viewer',
      route: '/pdf-viewer',
      icon: 'picture_as_pdf',
      description: 'View and interact with PDFs'
    },
    {
      label: 'AI Chat',
      route: '/chatbot',
      icon: 'chat',
      description: 'Chat with AI about your documents'
    }
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentRoute = event.url;
      });

    this.currentRoute = this.router.url;
  }

  isActiveRoute(route: string): boolean {
    return this.currentRoute === route;
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
