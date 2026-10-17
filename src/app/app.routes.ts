import { Routes } from '@angular/router';
import { requireSessionGuard } from './core/auth/session.guard';
import { ClinicalShellComponent } from './core/layouts/clinical-shell.component';
import { SignInPageComponent } from './features/auth/sign-in-page.component';
import { SignUpPageComponent } from './features/auth/sign-up-page.component';
import { ClinicOnboardingPageComponent } from './features/onboarding/clinic-onboarding-page.component';
import { WorkspacePageComponent } from './features/workspace/workspace-page.component';
import { PatientListPageComponent } from './features/patients/patient-list-page.component';
import { PatientDetailPageComponent } from './features/patients/patient-detail-page.component';
import { AgendaPageComponent } from './features/agenda/agenda-page.component';
import { RecallsPageComponent } from './features/recalls/recalls-page.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'crm/today',
  },
  {
    path: 'sign-in',
    component: SignInPageComponent,
    title: 'Connexion | Dentaleus',
  },
  {
    path: 'sign-up',
    component: SignUpPageComponent,
    title: 'Créer un compte | Dentaleus',
  },
  {
    path: 'onboarding/clinic',
    component: ClinicOnboardingPageComponent,
    canActivate: [requireSessionGuard],
    title: 'Configurer la clinique | Dentaleus',
  },
  {
    path: 'crm',
    component: ClinicalShellComponent,
    canActivateChild: [requireSessionGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'today',
      },
      {
        path: 'today',
        component: WorkspacePageComponent,
        title: 'Aujourd’hui | Dentaleus',
        data: {
          title: 'Aujourd’hui',
          description: 'Le point de départ de la journée clinique : priorités, arrivées et tâches à suivre.',
          nextStep: 'La file de travail sera alimentée par les rendez-vous et les tâches persistés du cabinet.',
        },
      },
      {
        path: 'agenda',
        component: AgendaPageComponent,
        title: 'Agenda | Dentaleus',
      },
      {
        path: 'recalls',
        component: RecallsPageComponent,
        title: 'Rappels patients | Dentaleus',
      },
      {
        path: 'patients',
        component: PatientListPageComponent,
        title: 'Patients | Dentaleus',
      },
      {
        path: 'patients/:patientId',
        component: PatientDetailPageComponent,
        title: 'Dossier patient | Dentaleus',
      },
      {
        path: 'clinical',
        component: WorkspacePageComponent,
        title: 'Soins et odontogramme | Dentaleus',
        data: {
          title: 'Soins et odontogramme',
          description: 'Le dossier clinique doit réunir un historique fiable, un plan de traitement et un odontogramme traçable.',
          nextStep: 'L’accès au chart sera relié à la session, aux rôles cliniques et à une sauvegarde confirmée par PostgreSQL.',
        },
      },
      {
        path: 'team',
        component: WorkspacePageComponent,
        title: 'Équipe et accès | Dentaleus',
        data: {
          title: 'Équipe et accès',
          description: 'Gérez les membres et leurs autorisations au niveau de l’organisation et de chaque clinique.',
          nextStep: 'Les membres affichés devront provenir des adhésions réelles et les permissions seront appliquées par l’API.',
        },
      },
      {
        path: 'reports',
        component: WorkspacePageComponent,
        title: 'Rapports | Dentaleus',
        data: {
          title: 'Rapports',
          description: 'Des indicateurs explicables, calculés à partir de données persistées et d’une période clairement définie.',
          nextStep: 'Aucun chiffre ne sera affiché avant que sa définition et sa source de données soient vérifiées.',
        },
      },
      {
        path: 'settings',
        component: WorkspacePageComponent,
        title: 'Paramètres | Dentaleus',
        data: {
          title: 'Paramètres du cabinet',
          description: 'Configurez les informations, horaires et préférences de la clinique active.',
          nextStep: 'Les paramètres seront liés à une clinique autorisée et sauvegardés côté serveur.',
        },
      },
    ],
  },
  {
    path: '**',
    component: WorkspacePageComponent,
    title: 'Page introuvable | Dentaleus',
    data: {
      title: 'Page introuvable',
      description: 'Cette adresse ne correspond à aucun espace Dentaleus.',
      nextStep: 'Vérifiez l’adresse ou revenez à l’espace clinique.',
    },
  },
];
