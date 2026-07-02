import { inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { RhAuthService } from './auth.service.js';
import { clearToken, cancelRefresh } from '@restheart-cloud/kit';

export const rhAuthInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth = inject(RhAuthService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        clearToken();
        cancelRefresh();
        auth.clearSession();
      }
      return throwError(() => err);
    })
  );
};
