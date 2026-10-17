import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-workspace-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-page.component.html',
  styleUrl: './workspace-page.component.css',
})
export class WorkspacePageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly title = String(this.route.snapshot.data['title'] ?? 'Espace clinique');
  readonly description = String(this.route.snapshot.data['description'] ?? 'Espace de travail Dentaleus.');
  readonly nextStep = String(this.route.snapshot.data['nextStep'] ?? 'La connexion des données sera ajoutée dans une phase dédiée.');
}
