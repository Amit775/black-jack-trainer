import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomeComponent),
  },
  {
    path: 'play',
    loadComponent: () => import('./pages/play/play').then((m) => m.PlayComponent),
  },
  {
    path: 'statistics',
    loadComponent: () => import('./pages/statistics/statistics').then((m) => m.StatisticsComponent),
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
