import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';

@Component({
  selector: 'app-sign-in-page',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sign-in-page.component.html',
  styleUrl: './sign-in-page.component.css',
})
export class SignInPageComponent {
  private readonly sessions = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  submitting = false;
  errorMessage = '';
  showPassword = false;

  get sessionsUnavailable(): boolean {
    return this.sessions.status() === 'unavailable';
  }

  async submit(): Promise<void> {
    if (this.submitting) return;
    this.errorMessage = '';
    this.submitting = true;

    try {
      await this.sessions.signIn(this.email.trim(), this.password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const safeReturnUrl = returnUrl?.startsWith('/crm/') ? returnUrl : '/crm/today';
      await this.router.navigateByUrl(safeReturnUrl);
    } catch (error) {
      this.errorMessage = this.sessions.messageFor(error);
    } finally {
      this.submitting = false;
    }
  }
}
