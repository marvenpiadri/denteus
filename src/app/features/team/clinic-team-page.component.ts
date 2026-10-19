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
}
interface TeamResponse { data: TeamMember[]; canManage: boolean; }
interface OrganizationMember { userId: string; name: string; email: string; role: string; joinedAt: string; isCurrentUser: boolean; clinics: Array<{id:string;name:string;role:string}>; }
interface OrganizationTeamResponse { data: OrganizationMember[]; canManage: boolean; canManageOwners: boolean; }
interface OrganizationInvitation { id: string; email: string; role: string; clinicIds: string[]; expiresAt: string; acceptedAt: string | null; revokedAt: string | null; createdAt: string; invitedByName: string | null; status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'; }
interface InvitationResponse { data: OrganizationInvitation[]; }
interface CreatedInvitationResponse { data: { id: string; email: string; role: string; clinicIds: string[]; expiresAt: string; token: string; }; }

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
  readonly organizationMembers = signal<OrganizationMember[]>([]);
  readonly canManageOrganization = signal(false);
  readonly canManageOwners = signal(false);
  readonly invitations = signal<OrganizationInvitation[]>([]);
  readonly invitationSaving = signal(false);
  invitationEmail = '';
  invitationRole = 'DENTIST';
  invitationClinicIds: string[] = [];
  createdInvitationUrl = '';
  organizationRoleDrafts: Record<string, string> = {};
  readonly organizationRoleOptions = [
    { value: 'ORGANIZATION_ADMIN', label: 'Administrateur organisation' },
    { value: 'CLINIC_ADMIN', label: 'Administrateur clinique' },
    { value: 'DENTIST', label: 'Chirurgien-dentiste' },
    { value: 'ORTHODONTIST', label: 'Orthodontiste' },
    { value: 'HYGIENIST', label: 'Hygiéniste' },
    { value: 'ASSISTANT', label: 'Assistant(e)' },
    { value: 'RECEPTIONIST', label: 'Accueil' },
    { value: 'ACCOUNTANT', label: 'Comptabilité' },
  ];
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
        this.organizationMembers.set([]);
        this.error.set('Sélectionnez une clinique autorisée pour gérer son équipe.');
        return;
      }
      const key = clinic.organizationId + ':' + clinic.id;
      if (key === this.context) return;
      this.context = key;
      this.members.set([]);
      void this.loadOrganizationTeam();
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
      ORGANIZATION_MEMBER: 'Membre organisation', CLINIC_ADMIN: 'Administrateur clinique', ACCOUNTANT: 'Comptabilité',
      DENTIST: 'Chirurgien-dentiste', ORTHODONTIST: 'Orthodontiste',
      HYGIENIST: 'Hygiéniste', ASSISTANT: 'Assistant(e)', RECEPTIONIST: 'Accueil',
    };
    return role ? labels[role] ?? role : 'Pas encore affecté';
  }

  get invitableClinics(): Array<{ id: string; name: string }> {
    const organizationId = this.tenant.activeClinic()?.organizationId;
    return this.tenant.clinics().filter((clinic) => clinic.organizationId === organizationId).map((clinic) => ({ id: clinic.id, name: clinic.name }));
  }

  get invitationRoleOptions(): Array<{ value: string; label: string }> {
    return this.canManageOwners()
      ? this.organizationRoleOptions
      : this.organizationRoleOptions.filter((role) => role.value !== 'ORGANIZATION_ADMIN');
  }

  private organizationUrl(): string {
    const clinic = this.tenant.activeClinic();
    return clinic ? '/api/v1/organizations/' + encodeURIComponent(clinic.organizationId) + '/team' : '';
  }

  async loadOrganizationTeam(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic) return;
    const orgId = clinic.organizationId;
    try {
      const response = await firstValueFrom(this.http.get<OrganizationTeamResponse>(this.organizationUrl(), { withCredentials: true }));
      if (this.tenant.activeClinic()?.organizationId !== orgId) return;
      this.organizationMembers.set(response.data);
      this.canManageOrganization.set(response.canManage);
      this.canManageOwners.set(response.canManageOwners);
      this.organizationRoleDrafts = Object.fromEntries(response.data.map((member) => [member.userId, member.role]));
      if (response.canManage) await this.loadInvitations();
    } catch (error) {
      if (this.tenant.activeClinic()?.organizationId === orgId) {
        this.organizationMembers.set([]);
        this.canManageOrganization.set(false);
        this.error.set(error instanceof HttpErrorResponse && error.status === 403
          ? 'Votre rôle ne permet pas de gérer les membres de l’organisation.'
          : 'Les membres de l’organisation ne peuvent pas être chargés.');
      }
    }
  }

  async loadInvitations(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || !this.canManageOrganization()) return;
    try {
      const response = await firstValueFrom(this.http.get<InvitationResponse>(this.organizationUrl().replace('/team', '/invitations'), { withCredentials: true }));
      if (this.tenant.activeClinic()?.organizationId === clinic.organizationId) this.invitations.set(response.data);
    } catch { this.invitations.set([]); }
  }

  async createInvitation(): Promise<void> {
    if (!this.canManageOrganization() || !this.invitationEmail.trim() || this.invitationSaving()) return;
    if (this.invitationRole !== 'ORGANIZATION_ADMIN' && !this.invitationClinicIds.length) { this.error.set('Sélectionnez au moins une clinique pour ce rôle.'); return; }
    this.invitationSaving.set(true); this.error.set(''); this.success.set(''); this.createdInvitationUrl = '';
    try {
      const response = await firstValueFrom(this.http.post<CreatedInvitationResponse>(this.organizationUrl().replace('/team', '/invitations'), { email: this.invitationEmail.trim(), role: this.invitationRole, clinicIds: this.invitationRole === 'ORGANIZATION_ADMIN' ? [] : this.invitationClinicIds }, { withCredentials: true }));
      this.createdInvitationUrl = window.location.origin + '/accept-invitation?token=' + encodeURIComponent(response.data.token);
      this.invitationEmail = '';
      this.success.set('Invitation créée. Copiez le lien et transmettez-le à la personne invitée. Il expire dans 7 jours.');
      await this.loadInvitations();
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 409
        ? 'Cette personne est déjà membre ou possède déjà une invitation active.'
        : error instanceof HttpErrorResponse && error.status === 403
          ? 'Seul un propriétaire peut inviter un administrateur organisationnel.'
          : 'L’invitation n’a pas pu être créée. Vérifiez l’adresse et les cliniques sélectionnées.');
    } finally { this.invitationSaving.set(false); }
  }

  async copyInvitationLink(): Promise<void> {
    if (!this.createdInvitationUrl) return;
    try { await navigator.clipboard.writeText(this.createdInvitationUrl); this.success.set('Lien d’invitation copié.'); }
    catch { this.error.set('La copie automatique est indisponible. Sélectionnez et copiez le lien affiché.'); }
  }

  async revokeInvitation(invitation: OrganizationInvitation): Promise<void> {
    if (!this.canManageOrganization() || invitation.status !== 'PENDING' || this.invitationSaving()) return;
    if (!window.confirm('Révoquer l’invitation destinée à ' + invitation.email + ' ? Son lien ne permettra plus de rejoindre l’organisation.')) return;
    this.invitationSaving.set(true); this.error.set(''); this.success.set('');
    try {
      await firstValueFrom(this.http.delete(this.organizationUrl().replace('/team', '/invitations') + '/' + encodeURIComponent(invitation.id), { withCredentials: true }));
      this.success.set('Invitation révoquée.'); await this.loadInvitations();
    } catch { this.error.set('Cette invitation n’a pas pu être révoquée. Actualisez la liste.'); }
    finally { this.invitationSaving.set(false); }
  }

  dateLabel(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: this.tenant.activeClinic()?.timezone || 'Africa/Casablanca' }).format(new Date(value));
  }

  invitationStatusLabel(status: OrganizationInvitation['status']): string {
    return ({ PENDING: 'En attente', ACCEPTED: 'Acceptée', REVOKED: 'Révoquée', EXPIRED: 'Expirée' } as const)[status];
  }
  canEditOrganizationMember(member: OrganizationMember): boolean {
    return this.canManageOrganization() && !member.isCurrentUser &&
      (this.canManageOwners() || !['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(member.role));
  }

  availableOrganizationRoles(member: OrganizationMember): Array<{value:string;label:string}> {
    const options = this.canManageOwners()
      ? [{ value: 'ORGANIZATION_OWNER', label: 'Propriétaire organisation' }, ...this.organizationRoleOptions]
      : this.organizationRoleOptions.filter((role) => role.value !== 'ORGANIZATION_ADMIN');
    return options.filter((role) =>
      (member.role !== 'ORGANIZATION_OWNER' || this.canManageOwners()) &&
      (!member.isCurrentUser || role.value === member.role),
    );
  }

  async saveOrganizationRole(member: OrganizationMember): Promise<void> {
    if (!this.canManageOrganization() || member.isCurrentUser || this.saving()) return;
    const role = this.organizationRoleDrafts[member.userId];
    if (!role || role === member.role) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    try {
      await firstValueFrom(this.http.put(this.organizationUrl() + '/' + encodeURIComponent(member.userId), { role }, { withCredentials: true }));
      this.success.set('Le rôle dans l’organisation a été mis à jour.');
      await this.loadOrganizationTeam();
      await this.load();
      await this.tenant.load(true);
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 409
        ? 'L’organisation doit conserver au moins un propriétaire.'
        : 'Le rôle organisationnel n’a pas pu être modifié.');
    } finally { this.saving.set(false); }
  }

  async removeOrganizationMember(member: OrganizationMember): Promise<void> {
    if (!this.canManageOrganization() || member.isCurrentUser || this.saving()) return;
    if (!window.confirm('Retirer ' + member.name + ' de l’organisation ? Ses accès à toutes les cliniques de cette organisation seront retirés, mais son compte et son historique clinique seront conservés.')) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    try {
      await firstValueFrom(this.http.delete(this.organizationUrl() + '/' + encodeURIComponent(member.userId), { withCredentials: true }));
      this.success.set('Le membre a été retiré de l’organisation et de ses cliniques.');
      await this.loadOrganizationTeam();
      await this.load();
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 409
        ? 'L’organisation doit conserver au moins un propriétaire.'
        : error instanceof HttpErrorResponse && error.status === 403
          ? 'Seul un propriétaire peut retirer un autre propriétaire ou administrateur de l’organisation.'
          : 'Le membre n’a pas pu être retiré.');
    } finally { this.saving.set(false); }
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
        ? 'Cette modification est protégée : conservez au moins un administrateur et gérez les rôles organisationnels à leur niveau.'
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
        ? 'Cette action est protégée : conservez au moins un administrateur et gérez les rôles organisationnels à leur niveau.'
        : 'L’accès n’a pas pu être retiré.');
    } finally { this.saving.set(false); }
  }
}
