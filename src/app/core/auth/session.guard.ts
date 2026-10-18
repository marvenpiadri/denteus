import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateChildFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export const requireSessionGuard: CanActivateChildFn = async (_childRoute, state) => {
  const platformId = inject(PLATFORM_ID);
  // The current SSR workspace renders only non-sensitive placeholders. Never
  // treat this client-side guard as API authorization; every private API route
  // must independently validate the session and clinic membership.
  if (!isPlatformBrowser(platformId)) return true;

  const session = inject(SessionService);
  const router = inject(Router);
  const authenticated = await session.ensureSession();
  return authenticated || router.createUrlTree(['/sign-in'], {
    queryParams: { returnUrl: state.url },
  });
};
