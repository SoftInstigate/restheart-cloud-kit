import { inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { RhAuthService } from './auth.service.js';

export const rhAuthInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth = inject(RhAuthService);

  const withCredentials = req.clone({ withCredentials: true });

  return next(withCredentials).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        auth.clearSession();
      }
      return throwError(() => err);
    })
  );
};
