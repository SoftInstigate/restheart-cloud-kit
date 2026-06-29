import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { map, tap } from 'rxjs';
import { RhAuthService } from './auth.service.js';

export const authGuard: CanActivateFn = () => {
  const auth = inject(RhAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  return auth.checkSession().pipe(
    map(user => user !== null),
    tap(ok => { if (!ok) router.navigate(['/auth/login']); })
  );
};

export const publicGuard: CanActivateFn = () => {
  const auth = inject(RhAuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return true;

  return auth.checkSession().pipe(
    map(user => user === null),
    tap(isPublic => { if (!isPublic) router.navigate(['/']); })
  );
};
