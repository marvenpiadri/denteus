import { Injectable, computed, signal } from '@angular/core';
import { Patient } from '../models/patient.models';
import { ToothCondition, ToothNumberingSystem } from '../models/dental.models';
import { PeriodontalExamination } from '../models/periodontal.models';
import { DentalProcedure, TreatmentPlan } from '../models/treatment.models';
import { Appointment } from '../models/appointment.models';
import { Invoice, PaymentRecord } from '../models/billing.models';
import { ClinicalNote } from '../models/clinical-notes.models';
import { DentalDocument } from '../models/document.models';
import { AuditLog, SubscriptionPlan } from '../models/audit.models';

const INITIAL_PROCEDURES: DentalProcedure[] = [
  { id: 'p-1', code: 'CONS', name: 'Consultation & Bilan bucco-dentaire complet', category: 'consultation', defaultFee: 300, durationMinutes: 30, requiresTooth: false, isActive: true },
  { id: 'p-2', code: 'URG', name: 'Consultation d’urgence & soulagement de la douleur', category: 'consultation', defaultFee: 400, durationMinutes: 30, requiresTooth: true, isActive: true },
  { id: 'p-3', code: 'DET-1', name: 'Détartrage sus et sous-gingival & polissage', category: 'prevention', defaultFee: 500, durationMinutes: 45, requiresTooth: false, isActive: true },
  { id: 'p-4', code: 'SURF', name: 'Surfaçage radiculaire / Débridement parodontal (par quadrant)', category: 'parodontologie', defaultFee: 800, durationMinutes: 60, requiresTooth: false, isActive: true },
  { id: 'p-5', code: 'COMP-1', name: 'Obturation composite 1 face (résine esthétique)', category: 'soins_conservateurs', defaultFee: 450, durationMinutes: 30, requiresTooth: true, isActive: true },
  { id: 'p-6', code: 'COMP-2', name: 'Obturation composite 2 à 3 faces (stratification)', category: 'soins_conservateurs', defaultFee: 650, durationMinutes: 45, requiresTooth: true, isActive: true },
  { id: 'p-7', code: 'COMP-REC', name: 'Reconstitution coronaire complexe pré-prothétique', category: 'soins_conservateurs', defaultFee: 850, durationMinutes: 45, requiresTooth: true, isActive: true },
  { id: 'p-8', code: 'ENDO-UNI', name: 'Traitement endodontique incisive ou canine (1 canal)', category: 'endodontie', defaultFee: 900, durationMinutes: 60, requiresTooth: true, isActive: true },
  { id: 'p-9', code: 'ENDO-PRE', name: 'Traitement endodontique prémolaire (1-2 canaux)', category: 'endodontie', defaultFee: 1200, durationMinutes: 60, requiresTooth: true, isActive: true },
  { id: 'p-10', code: 'ENDO-MOL', name: 'Traitement endodontique molaire complexe (3-4 canaux)', category: 'endodontie', defaultFee: 1800, durationMinutes: 90, requiresTooth: true, isActive: true },
  { id: 'p-11', code: 'RETRAITE', name: 'Retraitement endodontique sous microscope (par canal)', category: 'endodontie', defaultFee: 700, durationMinutes: 60, requiresTooth: true, isActive: true },
  { id: 'p-12', code: 'CRN-CCM', name: 'Couronne céramo-métallique biocompatible', category: 'prothese', defaultFee: 2200, durationMinutes: 45, requiresTooth: true, isActive: true },
  { id: 'p-13', code: 'CRN-ZR', name: 'Couronne tout-céramique Zircone multicouche', category: 'prothese', defaultFee: 3200, durationMinutes: 45, requiresTooth: true, isActive: true },
  { id: 'p-14', code: 'INLAY-ON', name: 'Inlay / Onlay / Overlay céramique E-Max', category: 'prothese', defaultFee: 2400, durationMinutes: 45, requiresTooth: true, isActive: true },
  { id: 'p-15', code: 'EXT-SIMP', name: 'Avulsion simple dent permanente monoradiculée', category: 'chirurgie', defaultFee: 400, durationMinutes: 30, requiresTooth: true, isActive: true },
  { id: 'p-16', code: 'EXT-CHIR', name: 'Avulsion chirurgicale de dent de sagesse incluse', category: 'chirurgie', defaultFee: 1200, durationMinutes: 60, requiresTooth: true, isActive: true },
  { id: 'p-17', code: 'IMP-TIT', name: 'Pose d’implant dentaire titane de grade médical', category: 'implantologie', defaultFee: 6500, durationMinutes: 60, requiresTooth: true, isActive: true },
  { id: 'p-18', code: 'IMP-CRN', name: 'Couronne transvissée sur implant Zircone', category: 'implantologie', defaultFee: 4000, durationMinutes: 45, requiresTooth: true, isActive: true },
  { id: 'p-19', code: 'BLANCH', name: 'Éclaircissement dentaire au fauteuil (Blanchiment LED)', category: 'esthetique', defaultFee: 2500, durationMinutes: 60, requiresTooth: false, isActive: true },
];

const INITIAL_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-solo',
    name: 'Denteus Solo',
    description: 'Conçu sur-mesure pour les chirurgiens-dentistes exerçant en cabinet individuel.',
    monthlyFeeMAD: 299,
    yearlyFeeMAD: 2990,
    monthlyFeeEUR: 29,
    yearlyFeeEUR: 290,
    maxChairs: 1,
    maxDoctors: 1,
    maxStorageGb: 15,
    features: [
      'Dossier patient complet & alertes médicales',
      'Odontogramme interactif complet (FDI / Universal / Palmer)',
      'Bilan parodontal & indices de saignement BOP',
      'Agenda avec rappel des rendez-vous',
      'Facturation et encaissements sans commission',
      'Export PDF des devis & ordonnances',
    ],
  },
  {
    id: 'plan-clinic',
    badge: 'Recommandé',
    isPopular: true,
    name: 'Denteus Clinique',
    description: 'La solution complète pour cabinets multi-fauteuils et cliniques dentaires dynamiques.',
    monthlyFeeMAD: 599,
    yearlyFeeMAD: 5990,
    monthlyFeeEUR: 59,
    yearlyFeeEUR: 590,
    maxChairs: 4,
    maxDoctors: 5,
    maxStorageGb: 100,
    features: [
      'Toutes les fonctionnalités Solo incluses',
      'Gestion multi-fauteuils & flux salle d’attente en temps réel',
      'Historique comparatif d’examens parodontaux',
      'Suivi de la production par praticien',
      'Gestion des rôles & permissions (Dentiste, Assistante, Accueil)',
      'Statistiques cliniques & financières avancées',
      'Sauvegardes chiffrées automatiques',
    ],
  },
  {
    id: 'plan-group',
    name: 'Denteus Groupe',
    description: 'Pour les centres dentaires multisites et réseaux de cliniques à forte volumétrie.',
    monthlyFeeMAD: 999,
    yearlyFeeMAD: 9990,
    monthlyFeeEUR: 99,
    yearlyFeeEUR: 990,
    maxChairs: 15,
    maxDoctors: 20,
    maxStorageGb: 500,
    features: [
      'Multi-cliniques centralisé avec bascule en 1 clic',
      'Nombre de fauteuils et praticiens étendu',
      'Dossier patient partagé inter-cliniques avec traçabilité',
      'Module d’audit complet conforme aux exigences légales',
      'Support prioritaire dédié 6j/7',
      'Accès API & intégration imagerie Cone Beam CBCT',
    ],
  },
];

const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'pat-1',
    organizationId: 'org-1',
    clinicIds: ['clinic-1'],
    patientNumber: 'DEN-2026-0042',
    firstName: 'Amina',
    lastName: 'Tazi',
    cin: 'BK489123',
    birthDate: '1988-04-12',
    gender: 'F',
    phone: '+212 661 88 99 00',
    email: 'amina.tazi@gmail.com',
    address: '14 Bd Zerktouni, Gauthier',
    city: 'Casablanca',
    emergencyContact: {
      name: 'Driss Tazi',
      relationship: 'Époux',
      phone: '+212 662 11 22 33',
    },
    medicalAlert: {
      allergies: ['Pénicilline'],
      medicalConditions: ['Hypertension artérielle modérée'],
      medications: ['Amlodipine 5mg'],
      notes: 'Anesthésie sans vasoconstricteur recommandée selon prescription cardiologique.',
      bloodGroup: 'A+',
      hasHighRisk: true,
    },
    balanceDue: 2400,
    nextRecall: {
      id: 'rec-1',
      patientId: 'pat-1',
      dueDate: '2026-10-15',
      type: 'periodontal_maintenance',
      status: 'pending',
      notes: 'Contrôle parodontal à 3 mois post-surfaçage',
    },
    createdAt: '2025-03-10',
    updatedAt: '2026-09-20',
  },
  {
    id: 'pat-2',
    organizationId: 'org-1',
    clinicIds: ['clinic-1', 'clinic-2'],
    patientNumber: 'DEN-2026-0089',
    firstName: 'Karim',
    lastName: 'Benjelloun',
    cin: 'A745910',
    birthDate: '1975-11-28',
    gender: 'M',
    phone: '+212 663 44 55 66',
    email: 'k.benjelloun@finance.ma',
    address: '8 Rue Abou Inan',
    city: 'Rabat',
    emergencyContact: {
      name: 'Meryem Benjelloun',
      relationship: 'Sœur',
      phone: '+212 661 99 88 77',
    },
    medicalAlert: {
      allergies: [],
      medicalConditions: ['Diabète type 2 (HbA1c = 6.8%)'],
      medications: ['Metformine 850mg'],
      notes: 'Risque parodontal accru lié au profil diabétique.',
      bloodGroup: 'O+',
      hasHighRisk: true,
    },
    balanceDue: 0,
    nextRecall: {
      id: 'rec-2',
      patientId: 'pat-2',
      dueDate: '2026-11-01',
      type: 'cleaning',
      status: 'pending',
    },
    createdAt: '2025-08-14',
    updatedAt: '2026-09-15',
  },
  {
    id: 'pat-3',
    organizationId: 'org-1',
    clinicIds: ['clinic-1'],
    patientNumber: 'DEN-2026-0114',
    firstName: 'Leila',
    lastName: 'Chraibi',
    cin: 'BE892301',
    birthDate: '1995-07-03',
    gender: 'F',
    phone: '+212 665 12 34 56',
    email: 'leila.chraibi@outlook.com',
    address: '27 Rue d’Ifrane, CIL',
    city: 'Casablanca',
    medicalAlert: {
      allergies: ['Latex'],
      medicalConditions: [],
      medications: [],
      notes: 'Utiliser exclusivement des gants et digues en nitrile / sans latex.',
      bloodGroup: 'B+',
      hasHighRisk: false,
    },
    balanceDue: 850,
    createdAt: '2026-01-18',
    updatedAt: '2026-09-25',
  },
  {
    id: 'pat-4',
    organizationId: 'org-1',
    clinicIds: ['clinic-1'],
    patientNumber: 'DEN-2026-0165',
    firstName: 'Mehdi',
    lastName: 'Idrissi',
    cin: 'BK339012',
    birthDate: '1982-02-19',
    gender: 'M',
    phone: '+212 667 98 76 54',
    email: 'mehdi.idrissi@tech.ma',
    address: '102 Rue de Normandie',
    city: 'Casablanca',
    medicalAlert: {
      allergies: [],
      medicalConditions: [],
      medications: [],
      hasHighRisk: false,
    },
    balanceDue: 5200,
    createdAt: '2026-04-05',
    updatedAt: '2026-09-22',
  },
  {
    id: 'pat-5',
    organizationId: 'org-1',
    clinicIds: ['clinic-1'],
    patientNumber: 'DEN-2026-0201',
    firstName: 'Fatima Zahra',
    lastName: 'Filali',
    cin: 'CD540981',
    birthDate: '1968-09-14',
    gender: 'F',
    phone: '+212 660 33 22 11',
    email: 'fz.filali@gmail.com',
    address: '5 Résidence Anfa Plage',
    city: 'Casablanca',
    medicalAlert: {
      allergies: ['AINS (Ibuprofène, Kétoprofène)'],
      medicalConditions: ['Ostéoporose sous bisphosphonates oraux'],
      medications: ['Fosamax 70mg hebdomadaire'],
      notes: 'ATTENTION : Pas d’extraction chirurgicale non encadrée. Risque d’ostéonécrose des mâchoires.',
      bloodGroup: 'AB+',
      hasHighRisk: true,
    },
    balanceDue: 0,
    createdAt: '2026-05-12',
    updatedAt: '2026-09-27',
  },
];

const INITIAL_TOOTH_CONDITIONS: ToothCondition[] = [
  // Patient 1 (Amina Tazi)
  { id: 'c-1', patientId: 'pat-1', toothNumber: 16, condition: 'caries', surfaces: ['O', 'D'], status: 'diagnosed', severity: 3, diagnosedAt: '2026-09-20', createdBy: 'Dr. Youssef Alami', notes: 'Carie occluso-distale avec atteinte dentinaire moyenne' },
  { id: 'c-2', patientId: 'pat-1', toothNumber: 21, condition: 'filling', surfaces: ['M'], status: 'completed', material: 'Composite E-Max', diagnosedAt: '2025-06-10', resolvedAt: '2025-06-18', createdBy: 'Dr. Youssef Alami', notes: 'Composite antérieur esthétique teinté A2' },
  { id: 'c-3', patientId: 'pat-1', toothNumber: 36, condition: 'endo_treated', surfaces: ['O'], status: 'completed', material: 'Céramique CCM', diagnosedAt: '2025-04-12', resolvedAt: '2025-05-02', createdBy: 'Dr. Salma Berrada', notes: 'Traitement canalaire 3 canaux + obturation Gutapercha' },
  { id: 'c-4', patientId: 'pat-1', toothNumber: 36, condition: 'crown', surfaces: ['O', 'M', 'D', 'B', 'L'], status: 'completed', material: 'Couronne CCM', diagnosedAt: '2025-05-02', resolvedAt: '2025-05-15', createdBy: 'Dr. Youssef Alami' },
  { id: 'c-5', patientId: 'pat-1', toothNumber: 46, condition: 'missing', surfaces: [], status: 'existing', diagnosedAt: '2025-03-10', createdBy: 'Dr. Youssef Alami', notes: 'Extraite il y a 5 ans par un confrère' },
  { id: 'c-6', patientId: 'pat-1', toothNumber: 46, condition: 'implant', surfaces: ['O', 'B', 'L'], status: 'planned', material: 'Implant Titane Straumann 4.1mm', diagnosedAt: '2026-09-20', createdBy: 'Dr. Youssef Alami', notes: 'Prévu dans le plan de traitement global' },
  { id: 'c-7', patientId: 'pat-1', toothNumber: 26, condition: 'caries', surfaces: ['O'], status: 'planned', severity: 2, diagnosedAt: '2026-09-20', createdBy: 'Dr. Youssef Alami' },

  // Patient 2 (Karim Benjelloun)
  { id: 'c-8', patientId: 'pat-2', toothNumber: 11, condition: 'crown', surfaces: ['O', 'M', 'D', 'B', 'L'], status: 'completed', material: 'Couronne Zircone', diagnosedAt: '2025-09-01', resolvedAt: '2025-09-18', createdBy: 'Dr. Youssef Alami' },
  { id: 'c-9', patientId: 'pat-2', toothNumber: 26, condition: 'filling', surfaces: ['O', 'M'], status: 'completed', material: 'Composite A3', diagnosedAt: '2025-10-12', resolvedAt: '2025-10-12', createdBy: 'Dr. Salma Berrada' },
  { id: 'c-10', patientId: 'pat-2', toothNumber: 37, condition: 'caries', surfaces: ['O'], status: 'diagnosed', severity: 2, diagnosedAt: '2026-09-15', createdBy: 'Dr. Salma Berrada' },
  { id: 'c-11', patientId: 'pat-2', toothNumber: 47, condition: 'filling', surfaces: ['O'], status: 'completed', material: 'Amalgame ancien', diagnosedAt: '2025-08-14', createdBy: 'Dr. Youssef Alami' },
];

const INITIAL_PERIODONTAL_EXAMS: PeriodontalExamination[] = [
  {
    id: 'perio-1',
    patientId: 'pat-1',
    clinicId: 'clinic-1',
    doctorId: 'user-2',
    doctorName: 'Dr. Salma Berrada',
    examDate: '2026-09-20',
    summary: {
      totalSitesCharted: 96,
      bleedingSitesCount: 18,
      bopPercentage: 18.7,
      deepPocketsCount: 4,
      worstCal: 6,
      worstCalTooth: 16,
      plaqueIndexPercentage: 24,
      diagnosis: 'Parodontite Stade II',
    },
    notes: 'Examen de contrôle à 6 mois. Réduction significative de l’inflammation par rapport au bilan initial.',
    createdAt: '2026-09-20T10:30:00',
    measurements: {
      16: {
        toothNumber: 16,
        mobility: 1,
        sites: {
          MB: { pd: 5, gm: 1, cal: 6, bop: true, suppuration: false },
          B: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
          DB: { pd: 6, gm: 0, cal: 6, bop: true, suppuration: true },
          ML: { pd: 4, gm: 0, cal: 4, bop: false, suppuration: false },
          L: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
          DL: { pd: 4, gm: 0, cal: 4, bop: true, suppuration: false },
        },
        furcation: { B: 1 },
      },
      15: {
        toothNumber: 15,
        mobility: 0,
        sites: {
          MB: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
          B: { pd: 2, gm: 0, cal: 2, bop: false, suppuration: false },
          DB: { pd: 4, gm: 0, cal: 4, bop: true, suppuration: false },
          ML: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
          L: { pd: 2, gm: 0, cal: 2, bop: false, suppuration: false },
          DL: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
        },
      },
      26: {
        toothNumber: 26,
        mobility: 0,
        sites: {
          MB: { pd: 4, gm: 0, cal: 4, bop: true, suppuration: false },
          B: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
          DB: { pd: 4, gm: 0, cal: 4, bop: false, suppuration: false },
          ML: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
          L: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
          DL: { pd: 5, gm: 0, cal: 5, bop: true, suppuration: false },
        },
      },
      36: {
        toothNumber: 36,
        mobility: 0,
        sites: {
          MB: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
          B: { pd: 2, gm: 0, cal: 2, bop: false, suppuration: false },
          DB: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
          ML: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
          L: { pd: 2, gm: 0, cal: 2, bop: false, suppuration: false },
          DL: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
        },
      },
    },
  },
  {
    id: 'perio-0',
    patientId: 'pat-1',
    clinicId: 'clinic-1',
    doctorId: 'user-2',
    doctorName: 'Dr. Salma Berrada',
    examDate: '2026-03-15',
    summary: {
      totalSitesCharted: 96,
      bleedingSitesCount: 38,
      bopPercentage: 39.5,
      deepPocketsCount: 11,
      worstCal: 7,
      worstCalTooth: 16,
      plaqueIndexPercentage: 58,
      diagnosis: 'Parodontite Stade III',
    },
    notes: 'Bilan initial pré-thérapeutique. Poches généralisées avec inflammation gingivale sévère.',
    createdAt: '2026-03-15T11:00:00',
    measurements: {
      16: {
        toothNumber: 16,
        mobility: 2,
        sites: {
          MB: { pd: 6, gm: 1, cal: 7, bop: true, suppuration: true },
          B: { pd: 4, gm: 0, cal: 4, bop: true, suppuration: false },
          DB: { pd: 7, gm: 0, cal: 7, bop: true, suppuration: true },
          ML: { pd: 5, gm: 0, cal: 5, bop: true, suppuration: false },
          L: { pd: 4, gm: 0, cal: 4, bop: false, suppuration: false },
          DL: { pd: 5, gm: 0, cal: 5, bop: true, suppuration: false },
        },
        furcation: { B: 2 },
      },
    },
  },
];

const INITIAL_TREATMENT_PLANS: TreatmentPlan[] = [
  {
    id: 'tp-1',
    patientId: 'pat-1',
    clinicId: 'clinic-1',
    doctorId: 'user-1',
    doctorName: 'Dr. Youssef Alami',
    title: 'Plan Global Réhabilitation & Implantologie 46',
    createdAt: '2026-09-20',
    status: 'accepted',
    subtotal: 11800,
    discountPercent: 5,
    total: 11210,
    notes: 'Devis accepté par la patiente. Phase 1 : Soins & Parodontie. Phase 2 : Implantologie.',
    items: [
      { id: 'tpi-1', planId: 'tp-1', toothNumber: 16, surfaces: ['O', 'D'], procedureCode: 'COMP-2', procedureName: 'Composite 2 faces 16', category: 'soins_conservateurs', fee: 650, status: 'pending' },
      { id: 'tpi-2', planId: 'tp-1', toothNumber: 26, surfaces: ['O'], procedureCode: 'COMP-1', procedureName: 'Composite 1 face 26', category: 'soins_conservateurs', fee: 450, status: 'pending' },
      { id: 'tpi-3', planId: 'tp-1', procedureCode: 'SURF', procedureName: 'Surfaçage quadrant 1 & 4', category: 'parodontologie', fee: 1600, status: 'completed' },
      { id: 'tpi-4', planId: 'tp-1', toothNumber: 46, procedureCode: 'IMP-TIT', procedureName: 'Pose implant titane 46', category: 'implantologie', fee: 6500, status: 'scheduled' },
      { id: 'tpi-5', planId: 'tp-1', toothNumber: 46, procedureCode: 'IMP-CRN', procedureName: 'Couronne transvissée sur implant 46', category: 'implantologie', fee: 4000, status: 'pending' },
    ],
  },
];

const TODAY = new Date().toISOString().split('T')[0];

const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1',
    organizationId: 'org-1',
    clinicId: 'clinic-1',
    patientId: 'pat-1',
    patientName: 'Amina Tazi',
    patientPhone: '+212 661 88 99 00',
    patientNumber: 'DEN-2026-0042',
    doctorId: 'user-1',
    doctorName: 'Dr. Youssef Alami',
    doctorColor: '#0d9488',
    chairId: 'chair-1',
    chairName: 'Fauteuil 1 (Chirurgie)',
    appointmentType: 'soin',
    startTime: `${TODAY}T09:00:00`,
    endTime: `${TODAY}T09:45:00`,
    durationMinutes: 45,
    status: 'in_treatment',
    arrivedAt: `${TODAY}T08:50:00`,
    inTreatmentAt: `${TODAY}T09:05:00`,
    reason: 'Composite 16 & préparation pose implant',
    notes: 'Patiente allergique à la pénicilline',
  },
  {
    id: 'apt-2',
    organizationId: 'org-1',
    clinicId: 'clinic-1',
    patientId: 'pat-2',
    patientName: 'Karim Benjelloun',
    patientPhone: '+212 663 44 55 66',
    patientNumber: 'DEN-2026-0089',
    doctorId: 'user-2',
    doctorName: 'Dr. Salma Berrada',
    doctorColor: '#3b82f6',
    chairId: 'chair-2',
    chairName: 'Fauteuil 2 (Omnipratique)',
    appointmentType: 'detartrage',
    startTime: `${TODAY}T09:30:00`,
    endTime: `${TODAY}T10:15:00`,
    durationMinutes: 45,
    status: 'arrived',
    arrivedAt: `${TODAY}T09:20:00`,
    reason: 'Détartrage & contrôle parodontal semestriel',
  },
  {
    id: 'apt-3',
    organizationId: 'org-1',
    clinicId: 'clinic-1',
    patientId: 'pat-3',
    patientName: 'Leila Chraibi',
    patientPhone: '+212 665 12 34 56',
    patientNumber: 'DEN-2026-0114',
    doctorId: 'user-1',
    doctorName: 'Dr. Youssef Alami',
    doctorColor: '#0d9488',
    chairId: 'chair-1',
    chairName: 'Fauteuil 1 (Chirurgie)',
    appointmentType: 'consultation',
    startTime: `${TODAY}T10:30:00`,
    endTime: `${TODAY}T11:00:00`,
    durationMinutes: 30,
    status: 'confirmed',
    reason: 'Première consultation bilan & sensibilité dentaire',
    notes: 'Allergie Latex notifiée',
  },
  {
    id: 'apt-4',
    organizationId: 'org-1',
    clinicId: 'clinic-1',
    patientId: 'pat-4',
    patientName: 'Mehdi Idrissi',
    patientPhone: '+212 667 98 76 54',
    patientNumber: 'DEN-2026-0165',
    doctorId: 'user-2',
    doctorName: 'Dr. Salma Berrada',
    doctorColor: '#3b82f6',
    chairId: 'chair-2',
    chairName: 'Fauteuil 2 (Omnipratique)',
    appointmentType: 'endodontie',
    startTime: `${TODAY}T11:15:00`,
    endTime: `${TODAY}T12:30:00`,
    durationMinutes: 75,
    status: 'booked',
    reason: 'Dévitalisation molaire 37 (séance 2/2 obturation)',
  },
  {
    id: 'apt-5',
    organizationId: 'org-1',
    clinicId: 'clinic-1',
    patientId: 'pat-5',
    patientName: 'Fatima Zahra Filali',
    patientPhone: '+212 660 33 22 11',
    patientNumber: 'DEN-2026-0201',
    doctorId: 'user-1',
    doctorName: 'Dr. Youssef Alami',
    doctorColor: '#0d9488',
    chairId: 'chair-3',
    chairName: 'Fauteuil 3 (Hygiène & Soins)',
    appointmentType: 'controle',
    startTime: `${TODAY}T08:15:00`,
    endTime: `${TODAY}T08:45:00`,
    durationMinutes: 30,
    status: 'completed',
    arrivedAt: `${TODAY}T08:10:00`,
    inTreatmentAt: `${TODAY}T08:15:00`,
    completedAt: `${TODAY}T08:45:00`,
    reason: 'Contrôle cicatrisation muqueuse',
  },
];

const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    organizationId: 'org-1',
    clinicId: 'clinic-1',
    patientId: 'pat-1',
    patientName: 'Amina Tazi',
    patientNumber: 'DEN-2026-0042',
    doctorId: 'user-1',
    doctorName: 'Dr. Youssef Alami',
    invoiceNumber: 'FAC-2026-0038',
    date: '2026-09-20',
    dueDate: '2026-10-20',
    subtotal: 4000,
    discount: 0,
    total: 4000,
    paidAmount: 1600,
    balanceDue: 2400,
    status: 'partially_paid',
    items: [
      { id: 'ii-1', procedureCode: 'SURF', description: 'Surfaçage radiculaire (quadrants 1 & 4)', quantity: 2, unitPrice: 800, total: 1600 },
      { id: 'ii-2', procedureCode: 'ACOMPTE-IMP', description: 'Acompte commande implant titane 46', quantity: 1, unitPrice: 2400, total: 2400 },
    ],
  },
  {
    id: 'inv-2',
    organizationId: 'org-1',
    clinicId: 'clinic-1',
    patientId: 'pat-2',
    patientName: 'Karim Benjelloun',
    patientNumber: 'DEN-2026-0089',
    doctorId: 'user-1',
    doctorName: 'Dr. Youssef Alami',
    invoiceNumber: 'FAC-2026-0035',
    date: '2026-09-01',
    dueDate: '2026-09-01',
    subtotal: 3200,
    discount: 0,
    total: 3200,
    paidAmount: 3200,
    balanceDue: 0,
    status: 'paid',
    items: [
      { id: 'ii-3', procedureCode: 'CRN-ZR', description: 'Couronne Zircone esthétique 11', toothNumber: 11, quantity: 1, unitPrice: 3200, total: 3200 },
    ],
  },
  {
    id: 'inv-3',
    organizationId: 'org-1',
    clinicId: 'clinic-1',
    patientId: 'pat-3',
    patientName: 'Leila Chraibi',
    patientNumber: 'DEN-2026-0114',
    doctorId: 'user-2',
    doctorName: 'Dr. Salma Berrada',
    invoiceNumber: 'FAC-2026-0041',
    date: '2026-09-22',
    dueDate: '2026-10-22',
    subtotal: 850,
    discount: 0,
    total: 850,
    paidAmount: 0,
    balanceDue: 850,
    status: 'unpaid',
    items: [
      { id: 'ii-4', procedureCode: 'COMP-REC', description: 'Reconstitution composite pré-prothétique 24', toothNumber: 24, quantity: 1, unitPrice: 850, total: 850 },
    ],
  },
];

const INITIAL_PAYMENTS: PaymentRecord[] = [
  {
    id: 'pay-1',
    invoiceId: 'inv-1',
    patientId: 'pat-1',
    clinicId: 'clinic-1',
    receiptNumber: 'REC-2026-0072',
    paymentDate: '2026-09-20',
    amount: 1600,
    method: 'card',
    referenceNumber: 'TPE-489012',
    notes: 'Règlement séance surfaçage par CB',
    recordedBy: 'Kenza Bennani',
  },
  {
    id: 'pay-2',
    invoiceId: 'inv-2',
    patientId: 'pat-2',
    clinicId: 'clinic-1',
    receiptNumber: 'REC-2026-0068',
    paymentDate: '2026-09-01',
    amount: 3200,
    method: 'cheque',
    referenceNumber: 'CHQ-890123 Attijariwafa',
    notes: 'Paiement intégral couronne',
    recordedBy: 'Kenza Bennani',
  },
];

const INITIAL_CLINICAL_NOTES: ClinicalNote[] = [
  {
    id: 'note-1',
    patientId: 'pat-1',
    clinicId: 'clinic-1',
    authorId: 'user-1',
    authorName: 'Dr. Youssef Alami',
    date: '2026-09-20T10:15:00',
    toothNumber: 16,
    category: 'soin',
    subjective: 'Patiente ressent une légère sensibilité au froid sur secteur 1.',
    objective: 'Examen visuel et radiographique : carie occluso-distale 16 confirmée. Sondage parodontal satisfaisant à 3mm en vestibulaire.',
    assessment: 'Carie dentinaire active 16 (ICDAS 3).',
    plan: 'Prévu : Curetage carieux + obturation composite stratifiée lors de la prochaine séance. Prescrit : Bain de bouche sans alcool.',
    isLocked: true,
    lockedAt: '2026-09-20T10:20:00',
    lockedBy: 'Dr. Youssef Alami',
  },
  {
    id: 'note-2',
    patientId: 'pat-1',
    clinicId: 'clinic-1',
    authorId: 'user-2',
    authorName: 'Dr. Salma Berrada',
    date: '2026-09-18T16:00:00',
    category: 'consultation',
    subjective: 'Visite de contrôle parodontal.',
    objective: 'Gingivite régressive, indice de saignement réduit de 39% à 18%. Poches résiduelles sur 16.',
    assessment: 'Stabilisation parodontale en cours.',
    plan: 'Poursuite de l’hygiène avec brossettes interdentaires 0.6mm.',
    isLocked: true,
    lockedAt: '2026-09-18T16:10:00',
    lockedBy: 'Dr. Salma Berrada',
  },
];

const INITIAL_DOCUMENTS: DentalDocument[] = [
  {
    id: 'doc-1',
    patientId: 'pat-1',
    clinicId: 'clinic-1',
    title: 'Radiographie Panoramique Orthopantomogramme',
    category: 'panoramic_xray',
    uploadedAt: '2026-09-10',
    uploadedBy: 'Dr. Youssef Alami',
    fileSize: '4.2 MB',
    fileUrl: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=1200',
    notes: 'Examen global : édentement 46, structure osseuse favorable à la pose implantaire.',
  },
  {
    id: 'doc-2',
    patientId: 'pat-1',
    clinicId: 'clinic-1',
    title: 'Cliché Rétro-alvéolaire Dent 16',
    category: 'periapical_xray',
    toothNumber: 16,
    uploadedAt: '2026-09-20',
    uploadedBy: 'Dr. Youssef Alami',
    fileSize: '1.8 MB',
    fileUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=800',
    notes: 'Contrôle profondeur carieuse pré-restauration.',
  },
  {
    id: 'doc-3',
    patientId: 'pat-1',
    clinicId: 'clinic-1',
    title: 'Consentement Éclairé Chirurgie Implantaire 46',
    category: 'consent_form',
    uploadedAt: '2026-09-20',
    uploadedBy: 'Kenza Bennani',
    fileSize: '620 KB',
    fileUrl: '#',
    notes: 'Document signé par la patiente et versé au dossier médico-légal.',
  },
];

const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-1',
    organizationId: 'org-1',
    clinicId: 'clinic-1',
    userId: 'user-1',
    userName: 'Dr. Youssef Alami',
    action: 'tooth_condition.created',
    entityType: 'odontogram',
    entityId: 'c-1',
    description: 'Diagnostiqué carie occluso-distale sur la dent 16 pour Amina Tazi',
    timestamp: '2026-09-20T10:18:22',
  },
  {
    id: 'aud-2',
    organizationId: 'org-1',
    clinicId: 'clinic-1',
    userId: 'user-2',
    userName: 'Dr. Salma Berrada',
    action: 'periodontal_exam.recorded',
    entityType: 'periodontal',
    entityId: 'perio-1',
    description: 'Enregistré bilan parodontal complet (96 sites, 18% BOP) pour Amina Tazi',
    timestamp: '2026-09-20T10:35:10',
  },
  {
    id: 'aud-3',
    organizationId: 'org-1',
    clinicId: 'clinic-1',
    userId: 'user-1',
    userName: 'Dr. Youssef Alami',
    action: 'treatment_plan.accepted',
    entityType: 'treatment_plan',
    entityId: 'tp-1',
    description: 'Devis global de 11 210 MAD accepté pour Amina Tazi',
    timestamp: '2026-09-20T11:00:00',
  },
  {
    id: 'aud-4',
    organizationId: 'org-1',
    clinicId: 'clinic-1',
    userId: 'user-3',
    userName: 'Kenza Bennani',
    action: 'payment.recorded',
    entityType: 'payment',
    entityId: 'pay-1',
    description: 'Encaissé 1 600 MAD (Carte bancaire) pour Amina Tazi',
    timestamp: '2026-09-20T11:15:45',
  },
];

@Injectable({
  providedIn: 'root',
})
export class DentalDataService {
  readonly patients = signal<Patient[]>(INITIAL_PATIENTS);
  readonly toothConditions = signal<ToothCondition[]>(INITIAL_TOOTH_CONDITIONS);
  readonly periodontalExams = signal<PeriodontalExamination[]>(INITIAL_PERIODONTAL_EXAMS);
  readonly procedures = signal<DentalProcedure[]>(INITIAL_PROCEDURES);
  readonly treatmentPlans = signal<TreatmentPlan[]>(INITIAL_TREATMENT_PLANS);
  readonly appointments = signal<Appointment[]>(INITIAL_APPOINTMENTS);
  readonly invoices = signal<Invoice[]>(INITIAL_INVOICES);
  readonly payments = signal<PaymentRecord[]>(INITIAL_PAYMENTS);
  readonly clinicalNotes = signal<ClinicalNote[]>(INITIAL_CLINICAL_NOTES);
  readonly documents = signal<DentalDocument[]>(INITIAL_DOCUMENTS);
  readonly auditLogs = signal<AuditLog[]>(INITIAL_AUDIT_LOGS);
  readonly subscriptionPlans = signal<SubscriptionPlan[]>(INITIAL_SUBSCRIPTION_PLANS);

  // Active tooth numbering system preference: 'FDI' | 'UNIVERSAL' | 'PALMER'
  readonly numberingSystem = signal<ToothNumberingSystem>('FDI');

  // Currently selected patient in clinical workspace
  readonly activePatientId = signal<string>('pat-1');

  readonly activePatient = computed(() => {
    return this.patients().find((p) => p.id === this.activePatientId()) || this.patients()[0];
  });

  // Odontogram conditions for active patient
  readonly activePatientConditions = computed(() => {
    return this.toothConditions().filter((c) => c.patientId === this.activePatientId());
  });

  // Periodontal exams for active patient (sorted newest first)
  readonly activePatientPerioExams = computed(() => {
    return this.periodontalExams()
      .filter((e) => e.patientId === this.activePatientId())
      .sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime());
  });

  // Treatment plans for active patient
  readonly activePatientTreatmentPlans = computed(() => {
    return this.treatmentPlans().filter((tp) => tp.patientId === this.activePatientId());
  });

  // Appointments for active patient
  readonly activePatientAppointments = computed(() => {
    return this.appointments().filter((a) => a.patientId === this.activePatientId());
  });

  // Invoices for active patient
  readonly activePatientInvoices = computed(() => {
    return this.invoices().filter((inv) => inv.patientId === this.activePatientId());
  });

  // Clinical notes for active patient
  readonly activePatientNotes = computed(() => {
    return this.clinicalNotes()
      .filter((n) => n.patientId === this.activePatientId())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  // Documents for active patient
  readonly activePatientDocuments = computed(() => {
    return this.documents().filter((d) => d.patientId === this.activePatientId());
  });

  // Today's appointments
  readonly todayAppointments = computed(() => {
    return this.appointments().filter((a) => a.startTime.startsWith(TODAY));
  });

  // Waiting room / Live Clinic Flow (Categorized)
  readonly liveFlowWaiting = computed(() => {
    return this.todayAppointments().filter((a) => a.status === 'arrived');
  });

  readonly liveFlowInTreatment = computed(() => {
    return this.todayAppointments().filter((a) => a.status === 'in_treatment');
  });

  readonly liveFlowUpcoming = computed(() => {
    return this.todayAppointments().filter((a) => a.status === 'booked' || a.status === 'confirmed');
  });

  readonly liveFlowCompleted = computed(() => {
    return this.todayAppointments().filter((a) => a.status === 'completed');
  });

  // Quick patient search
  searchPatients(query: string): Patient[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.patients();
    return this.patients().filter((p) => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      const reverseName = `${p.lastName} ${p.firstName}`.toLowerCase();
      return (
        fullName.includes(q) ||
        reverseName.includes(q) ||
        p.patientNumber.toLowerCase().includes(q) ||
        p.cin.toLowerCase().includes(q) ||
        p.phone.includes(q)
      );
    });
  }

  selectPatient(patientId: string): void {
    const patient = this.patients().find((p) => p.id === patientId);
    if (patient) {
      this.activePatientId.set(patientId);
    }
  }

  addPatient(patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'balanceDue'>): Patient {
    const newId = `pat-${Date.now()}`;
    const newPatient: Patient = {
      ...patient,
      id: newId,
      balanceDue: 0,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    this.patients.update((list) => [newPatient, ...list]);
    this.logAudit({
      action: 'patient.created',
      entityType: 'patient',
      entityId: newId,
      description: `Création du dossier patient : ${newPatient.firstName} ${newPatient.lastName} (${newPatient.patientNumber})`,
    });
    this.selectPatient(newId);
    return newPatient;
  }

  updatePatient(patient: Patient): void {
    this.patients.update((list) => list.map((p) => (p.id === patient.id ? { ...patient, updatedAt: new Date().toISOString().split('T')[0] } : p)));
    this.logAudit({
      action: 'patient.updated',
      entityType: 'patient',
      entityId: patient.id,
      description: `Mise à jour du dossier de ${patient.firstName} ${patient.lastName}`,
    });
  }

  // Dental condition updates (Odontogram persistence)
  addOrUpdateToothCondition(condition: Omit<ToothCondition, 'id'>): ToothCondition {
    const existingIndex = this.toothConditions().findIndex(
      (c) => c.patientId === condition.patientId && c.toothNumber === condition.toothNumber && c.condition === condition.condition
    );
    let result: ToothCondition;

    if (existingIndex >= 0) {
      const existing = this.toothConditions()[existingIndex];
      result = { ...existing, ...condition };
      this.toothConditions.update((list) => {
        const copy = [...list];
        copy[existingIndex] = result;
        return copy;
      });
      this.logAudit({
        action: 'odontogram.condition_updated',
        entityType: 'odontogram',
        entityId: result.id,
        description: `Mise à jour état dent ${condition.toothNumber} (${condition.condition})`,
      });
    } else {
      result = { ...condition, id: `c-${Date.now()}` };
      this.toothConditions.update((list) => [...list, result]);
      this.logAudit({
        action: 'odontogram.condition_added',
        entityType: 'odontogram',
        entityId: result.id,
        description: `Ajout état dent ${condition.toothNumber} (${condition.condition})`,
      });
    }
    return result;
  }

  removeToothCondition(conditionId: string): void {
    const cond = this.toothConditions().find((c) => c.id === conditionId);
    if (cond) {
      this.toothConditions.update((list) => list.filter((c) => c.id !== conditionId));
      this.logAudit({
        action: 'odontogram.condition_removed',
        entityType: 'odontogram',
        entityId: conditionId,
        description: `Suppression état dent ${cond.toothNumber} (${cond.condition})`,
      });
    }
  }

  // Periodontal Exam persistence
  addPeriodontalExam(exam: Omit<PeriodontalExamination, 'id' | 'createdAt'>): PeriodontalExamination {
    const newId = `perio-${Date.now()}`;
    const newExam: PeriodontalExamination = {
      ...exam,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    this.periodontalExams.update((list) => [newExam, ...list]);
    this.logAudit({
      action: 'periodontal.exam_created',
      entityType: 'periodontal',
      entityId: newId,
      description: `Enregistrement d'un bilan parodontal (${newExam.summary.bopPercentage}% BOP, ${newExam.summary.diagnosis})`,
    });
    return newExam;
  }

  // Appointment status progression
  updateAppointmentStatus(appointmentId: string, status: Appointment['status']): void {
    const now = new Date().toISOString();
    this.appointments.update((list) =>
      list.map((a) => {
        if (a.id !== appointmentId) return a;
        const updated = { ...a, status };
        if (status === 'arrived' && !a.arrivedAt) updated.arrivedAt = now;
        if (status === 'in_treatment' && !a.inTreatmentAt) updated.inTreatmentAt = now;
        if (status === 'completed' && !a.completedAt) updated.completedAt = now;
        return updated;
      })
    );
    this.logAudit({
      action: 'appointment.status_updated',
      entityType: 'appointment',
      entityId: appointmentId,
      description: `Rendez-vous passé au statut : ${status}`,
    });
  }

  addAppointment(appointment: Omit<Appointment, 'id'>): Appointment {
    const newId = `apt-${Date.now()}`;
    const newApt: Appointment = { ...appointment, id: newId };
    this.appointments.update((list) => [...list, newApt]);
    this.logAudit({
      action: 'appointment.created',
      entityType: 'appointment',
      entityId: newId,
      description: `Planification rendez-vous pour ${newApt.patientName} (${newApt.appointmentType})`,
    });
    return newApt;
  }

  // Clinical note management (SOAP)
  addClinicalNote(note: Omit<ClinicalNote, 'id'>): ClinicalNote {
    const newId = `note-${Date.now()}`;
    const newNote: ClinicalNote = { ...note, id: newId };
    this.clinicalNotes.update((list) => [newNote, ...list]);
    this.logAudit({
      action: 'clinical_note.created',
      entityType: 'clinical_note',
      entityId: newId,
      description: `Ajout note clinique SOAP (${newNote.category})`,
    });
    return newNote;
  }

  lockClinicalNote(noteId: string, lockedBy: string): void {
    const now = new Date().toISOString();
    this.clinicalNotes.update((list) =>
      list.map((n) => (n.id === noteId ? { ...n, isLocked: true, lockedAt: now, lockedBy } : n))
    );
    this.logAudit({
      action: 'clinical_note.finalized',
      entityType: 'clinical_note',
      entityId: noteId,
      description: `Verrouillage médico-légal de la note clinique par ${lockedBy}`,
    });
  }

  // Treatment plan
  addTreatmentPlan(plan: Omit<TreatmentPlan, 'id' | 'createdAt'>): TreatmentPlan {
    const newId = `tp-${Date.now()}`;
    const newPlan: TreatmentPlan = {
      ...plan,
      id: newId,
      createdAt: new Date().toISOString().split('T')[0],
      items: plan.items.map((item) => ({ ...item, planId: newId })),
    };
    this.treatmentPlans.update((list) => [newPlan, ...list]);
    this.logAudit({
      action: 'treatment_plan.created',
      entityType: 'treatment_plan',
      entityId: newId,
      description: `Création du plan de traitement : ${newPlan.title} (${newPlan.total} MAD)`,
    });
    return newPlan;
  }

  updateTreatmentPlanStatus(planId: string, status: TreatmentPlan['status']): void {
    this.treatmentPlans.update((list) =>
      list.map((tp) => (tp.id === planId ? { ...tp, status } : tp))
    );
    this.logAudit({
      action: 'treatment_plan.status_updated',
      entityType: 'treatment_plan',
      entityId: planId,
      description: `Plan de traitement passé au statut : ${status}`,
    });
  }

  // Invoicing & Payment tracking
  createInvoice(invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'paidAmount' | 'balanceDue' | 'status'>): Invoice {
    const newId = `inv-${Date.now()}`;
    const num = `FAC-${new Date().getFullYear()}-${String(this.invoices().length + 1).padStart(4, '0')}`;
    const newInvoice: Invoice = {
      ...invoice,
      id: newId,
      invoiceNumber: num,
      paidAmount: 0,
      balanceDue: invoice.total,
      status: 'unpaid',
    };
    this.invoices.update((list) => [newInvoice, ...list]);
    this.recalculatePatientBalance(invoice.patientId);
    this.logAudit({
      action: 'invoice.created',
      entityType: 'invoice',
      entityId: newId,
      description: `Émission facture ${num} d'un montant de ${newInvoice.total} MAD`,
    });
    return newInvoice;
  }

  recordPayment(payment: Omit<PaymentRecord, 'id' | 'receiptNumber'>): PaymentRecord {
    const newId = `pay-${Date.now()}`;
    const receiptNum = `REC-${new Date().getFullYear()}-${String(this.payments().length + 1).padStart(4, '0')}`;
    const newPayment: PaymentRecord = {
      ...payment,
      id: newId,
      receiptNumber: receiptNum,
    };
    this.payments.update((list) => [newPayment, ...list]);

    // If attached to an invoice, update invoice paid amount
    if (payment.invoiceId) {
      this.invoices.update((list) =>
        list.map((inv) => {
          if (inv.id !== payment.invoiceId) return inv;
          const newPaid = inv.paidAmount + payment.amount;
          const newBalance = Math.max(0, inv.total - newPaid);
          const newStatus = newBalance === 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : 'unpaid';
          return { ...inv, paidAmount: newPaid, balanceDue: newBalance, status: newStatus };
        })
      );
    }

    this.recalculatePatientBalance(payment.patientId);
    this.logAudit({
      action: 'payment.recorded',
      entityType: 'payment',
      entityId: newId,
      description: `Encaissement de ${newPayment.amount} MAD (${newPayment.method}) - Reçu ${receiptNum}`,
    });
    return newPayment;
  }

  private recalculatePatientBalance(patientId: string): void {
    const patientInvoices = this.invoices().filter((inv) => inv.patientId === patientId);
    const totalDue = patientInvoices.reduce((acc, curr) => acc + curr.balanceDue, 0);
    this.patients.update((list) =>
      list.map((p) => (p.id === patientId ? { ...p, balanceDue: totalDue } : p))
    );
  }

  private logAudit(entry: { action: string; entityType: AuditLog['entityType']; entityId: string; description: string }): void {
    const log: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      organizationId: 'org-1',
      userId: 'user-1',
      userName: 'Dr. Youssef Alami',
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.auditLogs.update((list) => [log, ...list]);
  }
}
