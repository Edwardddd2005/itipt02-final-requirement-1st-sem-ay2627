
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'library',
    loadComponent: () =>
      import('./pages/library/library.page').then((m) => m.LibraryPage),
  },
  {
    path: 'playlists',
    loadComponent: () =>
      import('./pages/playlists/playlists.page').then((m) => m.PlaylistsPage),
  },
  {
    path: 'favorites',
    loadComponent: () =>
      import('./pages/favorites/favorites.page').then((m) => m.FavoritesPage),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'services',
    loadComponent: () =>
      import('./pages/services/services.page').then((m) => m.ServicesPage),
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
