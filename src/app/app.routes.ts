import { Routes } from '@angular/router';
import { ClinicalShellComponent } from './core/layouts/clinical-shell.component';
import { WorkspacePageComponent } from './features/workspace/workspace-page.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'crm/today',
  },
  {
    path: 'crm',
    component: ClinicalShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'today',
      },
      {
        path: 'today',
        component: WorkspacePageComponent,
        data: {
          title: 'Aujourd’hui',
          description: 'Le point de départ de la journée clinique : priorités, arrivées et tâches à suivre.',
          nextStep: 'La file de travail sera alimentée par les rendez-vous et les tâches persistés du cabinet.',
        },
      },
      {
        path: 'agenda',
        component: WorkspacePageComponent,
        data: {
          title: 'Agenda',
          description: 'Organisez les rendez-vous, les salles et les fauteuils autour du rythme réel du cabinet.',
          nextStep: 'Les rendez-vous doivent être persistés et les conflits de planning vérifiés côté serveur.',
        },
      },
      {
        path: 'patients',
        component: WorkspacePageComponent,
        data: {
          title: 'Patients',
          description: 'Retrouvez le dossier du patient autorisé dans le contexte de la clinique active.',
          nextStep: 'La liste et la recherche seront connectées à l’API tenant-scoped, sans dossiers fictifs.',
        },
      },
      {
        path: 'clinical',
        component: WorkspacePageComponent,
        data: {
          title: 'Soins et odontogramme',
          description: 'Le dossier clinique doit réunir un historique fiable, un plan de traitement et un odontogramme traçable.',
          nextStep: 'L’accès au chart sera relié à la session, aux rôles cliniques et à une sauvegarde confirmée par PostgreSQL.',
        },
      },
      {
        path: 'team',
        component: WorkspacePageComponent,
        data: {
          title: 'Équipe et accès',
          description: 'Gérez les membres et leurs autorisations au niveau de l’organisation et de chaque clinique.',
          nextStep: 'Les membres affichés devront provenir des adhésions réelles et les permissions seront appliquées par l’API.',
        },
      },
      {
        path: 'reports',
        component: WorkspacePageComponent,
        data: {
          title: 'Rapports',
          description: 'Des indicateurs explicables, calculés à partir de données persistées et d’une période clairement définie.',
          nextStep: 'Aucun chiffre ne sera affiché avant que sa définition et sa source de données soient vérifiées.',
        },
      },
      {
        path: 'settings',
        component: WorkspacePageComponent,
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
    data: {
      title: 'Page introuvable',
      description: 'Cette adresse ne correspond à aucun espace Dentaleus.',
      nextStep: 'Vérifiez l’adresse ou revenez à l’espace clinique.',
    },
  },
];
