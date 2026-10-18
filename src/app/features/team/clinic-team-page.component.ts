import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { firstValueFrom } from 'rxjs';

interface TeamMember {
  userId: string;
  name: string;
  email: string;
  organizationRole: string;
  clinicRole: string | null;
  effectiveRole: string;
  joinedAt: string | null;
}
interface TeamResponse { data: TeamMember[]; canManage: boolean; }

@Component({
  selector: 'app-clinic-team-page',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clinic-team-page.component.html',
  styleUrl: './clinic-team-page.component.css',
})
export class ClinicTeamPageComponent {
  readonly tenant = inject(TenantContextService);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  readonly members = signal<TeamMember[]>([]);
  readonly canManage = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  roleDrafts: Record<string, string> = {};
  addUserId = '';
  newRole = 'DENTIST';
  private context = '';
  private sequence = 0;

  readonly roleOptions = [
    { value: 'CLINIC_ADMIN', label: 'Administrateur clinique' },
    { value: 'DENTIST', label: 'Chirurgien-dentiste' },
    { value: 'ORTHODONTIST', label: 'Orthodontiste' },
    { value: 'HYGIENIST', label: 'Hygiéniste' },
    { value: 'ASSISTANT', label: 'Assistant(e)' },
    { value: 'RECEPTIONIST', label: 'Accueil' },
  ];

  constructor() {
    effect(() => {
      const clinic = this.tenant.activeClinic();
      if (!isPlatformBrowser(this.platformId)) return;
      if (!clinic) {
        this.context = '';
        this.members.set([]);
        this.error.set('Sélectionnez une clinique autorisée pour gérer son équipe.');
        return;
      }
      const key = clinic.organizationId + ':' + clinic.id;
      if (key === this.context) return;
      this.context = key;
      this.members.set([]);
      void this.load();
    });
  }

  private url(): string {
    const clinic = this.tenant.activeClinic();
    return clinic
      ? `/api/v1/organizations/${encodeURIComponent(clinic.organizationId)}/clinics/${encodeURIComponent(clinic.id)}/team`
      : '';
  }

  async load(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic) return;
    const seq = ++this.sequence;
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.http.get<TeamResponse>(this.url(), { withCredentials: true }));
      if (seq !== this.sequence || this.tenant.activeClinic()?.id !== clinic.id) return;
      this.members.set(response.data);
      this.canManage.set(response.canManage);
      this.roleDrafts = Object.fromEntries(response.data.map((member) => [member.userId, member.clinicRole ?? 'DENTIST']));
      if (!response.data.some((member) => member.userId === this.addUserId && !member.clinicRole)) {
        this.addUserId = response.data.find((member) => !member.clinicRole)?.userId ?? '';
      }
    } catch (error) {
      if (seq === this.sequence) this.error.set(error instanceof HttpErrorResponse && error.status === 403
        ? 'Votre rôle ne permet pas de consulter cette équipe.'
        : 'La liste des membres ne peut pas être chargée.');
    } finally {
      if (seq === this.sequence) this.loading.set(false);
    }
  }

  get assignedCount(): number {
    return this.members().filter((member) => !!member.clinicRole).length;
  }

  isOrganizationAdmin(role: string): boolean {
    return role === 'ORGANIZATION_OWNER' || role === 'ORGANIZATION_ADMIN';
  }

  get availableMembers(): TeamMember[] {
    return this.members().filter((member) => !member.clinicRole && !['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(member.organizationRole));
  }

  roleLabel(role: string | null): string {
    const labels: Record<string, string> = {
      ORGANIZATION_OWNER: 'Propriétaire organisation', ORGANIZATION_ADMIN: 'Admin. organisation',
      ORGANIZATION_MEMBER: 'Membre organisation', CLINIC_ADMIN: 'Administrateur clinique',
      DENTIST: 'Chirurgien-dentiste', ORTHODONTIST: 'Orthodontiste',
      HYGIENIST: 'Hygiéniste', ASSISTANT: 'Assistant(e)', RECEPTIONIST: 'Accueil',
    };
    return role ? labels[role] ?? role : 'Pas encore affecté';
  }

  async addMember(): Promise<void> {
    if (!this.canManage() || !this.addUserId || this.saving()) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    try {
      await firstValueFrom(this.http.post(this.url(), { userId: this.addUserId, role: this.newRole }, { withCredentials: true }));
      this.success.set('L’accès à la clinique a été attribué.');
      this.addUserId = '';
      await this.load();
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 409
        ? 'Ce membre dispose déjà d’un accès à cette clinique.'
        : error instanceof HttpErrorResponse && error.status === 404
          ? 'Ce compte ne fait pas partie de cette organisation.'
          : 'L’accès n’a pas pu être attribué.');
    } finally { this.saving.set(false); }
  }

  async saveRole(member: TeamMember): Promise<void> {
    if (!this.canManage() || !member.clinicRole || this.saving()) return;
    const role = this.roleDrafts[member.userId];
    if (!role || role === member.clinicRole) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    try {
      await firstValueFrom(this.http.put(this.url() + '/' + encodeURIComponent(member.userId), { role }, { withCredentials: true }));
      this.success.set('Le rôle du membre a été mis à jour.');
      await this.load();
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 409
        ? 'Ce rôle est géré au niveau de l’organisation et ne peut pas être modifié ici.'
        : 'Le rôle n’a pas pu être modifié.');
    } finally { this.saving.set(false); }
  }

  async removeMember(member: TeamMember): Promise<void> {
    if (!this.canManage() || !member.clinicRole || this.saving()) return;
    if (!window.confirm(`Retirer l’accès à ${member.name} pour cette clinique ? Son compte et ses accès aux autres cliniques ne seront pas supprimés.`)) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    try {
      await firstValueFrom(this.http.delete(this.url() + '/' + encodeURIComponent(member.userId), { withCredentials: true }));
      this.success.set('L’accès à cette clinique a été retiré.');
      await this.load();
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 409
        ? 'Les administrateurs de l’organisation doivent être gérés au niveau de l’organisation.'
        : 'L’accès n’a pas pu être retiré.');
    } finally { this.saving.set(false); }
  }
}
