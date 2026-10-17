import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export const requireSessionGuard: CanActivateChildFn = async (_childRoute, state) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const authenticated = await session.ensureSession();
  return authenticated || router.createUrlTree(['/sign-in'], {
    queryParams: { returnUrl: state.url },
  });
};
