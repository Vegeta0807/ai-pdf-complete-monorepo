import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    loadComponent: () => import('./components/landing/landing.component').then(m => m.LandingComponent),
    title: 'AI PDF Assistant - Home'
  },
  {
    path: 'upload',
    loadComponent: () => import('./pages/upload/upload.component').then(m => m.UploadComponent),
    title: 'Upload PDF - AI PDF Assistant'
  },
  {
    path: 'chat',
    loadComponent: () => import('./pages/chat/chat.component').then(m => m.ChatComponent),
    title: 'AI Chat - AI PDF Assistant'
  },
  {
    path: 'pdf-viewer',
    loadComponent: () => import('./components/pdf-viewer/pdf-viewer.component').then(m => m.PdfViewerComponent),
    title: 'PDF Viewer - AI PDF Assistant'
  },
  {
    path: 'chatbot',
    loadComponent: () => import('./components/chatbot/chatbot.component').then(m => m.ChatbotComponent),
    title: 'AI Chatbot - AI PDF Assistant'
  },
  {
    path: '**',
    redirectTo: '/home'
  }
];
