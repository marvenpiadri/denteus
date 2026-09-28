import { Injectable, computed, signal } from '@angular/core';

export type AppLocale = 'fr' | 'en' | 'ar';

export interface Dictionary {
  // Navigation & Common
  appTitle: string;
  dashboard: string;
  agenda: string;
  waitingRoom: string;
  patients: string;
  clinical: string;
  treatments: string;
  billing: string;
  procedures: string;
  reports: string;
  clinicSettings: string;
  subscription: string;
  auditTrail: string;
  searchPlaceholder: string;
  quickSearchHint: string;
  newPatient: string;
  newAppointment: string;
  save: string;
  cancel: string;
  edit: string;
  delete: string;
  confirm: string;
  close: string;
  actions: string;
  status: string;
  date: string;
  time: string;
  doctor: string;
  chair: string;
  notes: string;
  currency: string;
  filter: string;
  export: string;
  today: string;
  viewAll: string;
  overview: string;
  noData: string;

  // Odontogram & Dental
  odontogram: string;
  periodontal: string;
  clinicalNotes: string;
  documentsAndImaging: string;
  patientTimeline: string;
  currentStatus: string;
  treatmentPlan: string;
  tooth: string;
  surfaces: string;
  caries: string;
  restoration: string;
  endodontics: string;
  crown: string;
  implant: string;
  extraction: string;
  healthy: string;
  missingTooth: string;
  diagnosed: string;
  planned: string;
  inProgress: string;
  completed: string;
  numberingSystem: string;

  // Periodontal
  probingDepth: string;
  gingivalMargin: string;
  bleedingOnProbing: string;
  suppuration: string;
  furcation: string;
  mobility: string;
  plaqueIndex: string;
  clinicalAttachmentLoss: string;
  periodontalExams: string;
  newPeriodontalExam: string;
  historyComparison: string;

  // Appointments & Waiting room
  booked: string;
  confirmed: string;
  arrived: string;
  inTreatment: string;
  cancelled: string;
  noShow: string;
  waitingTime: string;
  chairsOverview: string;

  // Billing & Subscriptions
  invoices: string;
  payments: string;
  newInvoice: string;
  recordPayment: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  unpaid: string;
  partiallyPaid: string;
  paid: string;
  cash: string;
  card: string;
  cheque: string;
  bankTransfer: string;
  insurance: string;
  monthly: string;
  yearly: string;
  plans: string;
}

const FR_TRANSLATIONS: Dictionary = {
  appTitle: 'Denteus',
  dashboard: 'Tableau de bord',
  agenda: 'Agenda & Rendez-vous',
  waitingRoom: "Salle d'attente",
  patients: 'Dossiers Patients',
  clinical: 'Espace Clinique',
  treatments: 'Plans de traitement',
  billing: 'Facturation & Règlements',
  procedures: 'Catalogue des Actes',
  reports: 'Rapports & Statistiques',
  clinicSettings: 'Clinique & Équipe',
  subscription: 'Abonnement SaaS',
  auditTrail: 'Journal d’Audit',
  searchPlaceholder: 'Rechercher un patient (Nom, Tél, CIN, N° dossier)...',
  quickSearchHint: 'Appuyez sur / pour rechercher',
  newPatient: 'Nouveau patient',
  newAppointment: 'Nouveau rendez-vous',
  save: 'Enregistrer',
  cancel: 'Annuler',
  edit: 'Modifier',
  delete: 'Supprimer',
  confirm: 'Confirmer',
  close: 'Fermer',
  actions: 'Actions',
  status: 'Statut',
  date: 'Date',
  time: 'Heure',
  doctor: 'Praticien',
  chair: 'Fauteuil',
  notes: 'Observations',
  currency: 'MAD',
  filter: 'Filtrer',
  export: 'Exporter',
  today: "Aujourd'hui",
  viewAll: 'Voir tout',
  overview: "Vue d'ensemble",
  noData: 'Aucune donnée enregistrée',

  odontogram: 'Odontogramme',
  periodontal: 'Bilan Parodontal',
  clinicalNotes: 'Notes Cliniques (SOAP)',
  documentsAndImaging: 'Radiographies & Documents',
  patientTimeline: 'Chronologie des soins',
  currentStatus: 'Statut actuel',
  treatmentPlan: 'Plan de traitement',
  tooth: 'Dent',
  surfaces: 'Surfaces',
  caries: 'Carie',
  restoration: 'Obturation composite',
  endodontics: 'Traitement endodontique',
  crown: 'Couronne prothétique',
  implant: 'Implant dentaire',
  extraction: 'Extraction',
  healthy: 'Dent saine',
  missingTooth: 'Dent absente',
  diagnosed: 'Diagnostiqué',
  planned: 'Planifié',
  inProgress: 'En cours',
  completed: 'Réalisé',
  numberingSystem: 'Numérotation',

  probingDepth: 'Profondeur de poche (PD)',
  gingivalMargin: 'Marge gingivale (GM)',
  bleedingOnProbing: 'Saignement au sondage (BOP)',
  suppuration: 'Suppuration',
  furcation: 'Atteinte de furcation',
  mobility: 'Mobilité dentaire',
  plaqueIndex: "Indice de plaque d'O'Leary",
  clinicalAttachmentLoss: "Perte d'attache (CAL)",
  periodontalExams: 'Examens parodontaux',
  newPeriodontalExam: 'Nouvel examen de parodontie',
  historyComparison: 'Comparaison historique',

  booked: 'Planifié',
  confirmed: 'Confirmé',
  arrived: 'En salle d’attente',
  inTreatment: 'Au fauteuil',
  cancelled: 'Annulé',
  noShow: 'Non venu',
  waitingTime: 'Attente',
  chairsOverview: 'Occupation des fauteuils',

  invoices: 'Factures & Devis',
  payments: 'Règlements reçus',
  newInvoice: 'Créer une facture',
  recordPayment: 'Encaisser un règlement',
  totalAmount: 'Montant total',
  paidAmount: 'Montant réglé',
  balanceDue: 'Reste à payer',
  unpaid: 'Non réglé',
  partiallyPaid: 'Partiellement réglé',
  paid: 'Réglé',
  cash: 'Espèces',
  card: 'Carte bancaire',
  cheque: 'Chèque',
  bankTransfer: 'Virement bancaire',
  insurance: 'Prise en charge mutuelle',
  monthly: 'Mensuel',
  yearly: 'Annuel (2 mois offerts)',
  plans: 'Formules d’abonnement',
};

const EN_TRANSLATIONS: Dictionary = {
  appTitle: 'Denteus',
  dashboard: 'Dashboard',
  agenda: 'Calendar & Appointments',
  waitingRoom: 'Waiting Room',
  patients: 'Patient Records',
  clinical: 'Clinical Workspace',
  treatments: 'Treatment Plans',
  billing: 'Billing & Payments',
  procedures: 'Fee Schedule & Procedures',
  reports: 'Reports & Analytics',
  clinicSettings: 'Clinic & Team',
  subscription: 'SaaS Subscription',
  auditTrail: 'Audit Trail',
  searchPlaceholder: 'Search patient (Name, Phone, ID, File #)...',
  quickSearchHint: 'Press / to search',
  newPatient: 'New patient',
  newAppointment: 'New appointment',
  save: 'Save',
  cancel: 'Cancel',
  edit: 'Edit',
  delete: 'Delete',
  confirm: 'Confirm',
  close: 'Close',
  actions: 'Actions',
  status: 'Status',
  date: 'Date',
  time: 'Time',
  doctor: 'Provider',
  chair: 'Operatory / Chair',
  notes: 'Notes',
  currency: 'MAD',
  filter: 'Filter',
  export: 'Export',
  today: 'Today',
  viewAll: 'View all',
  overview: 'Overview',
  noData: 'No records found',

  odontogram: 'Odontogram',
  periodontal: 'Periodontal Chart',
  clinicalNotes: 'Clinical Notes (SOAP)',
  documentsAndImaging: 'X-Rays & Documents',
  patientTimeline: 'Clinical Timeline',
  currentStatus: 'Existing Condition',
  treatmentPlan: 'Treatment Plan',
  tooth: 'Tooth',
  surfaces: 'Surfaces',
  caries: 'Caries',
  restoration: 'Composite restoration',
  endodontics: 'Root canal therapy',
  crown: 'Prosthetic crown',
  implant: 'Dental implant',
  extraction: 'Extraction',
  healthy: 'Healthy tooth',
  missingTooth: 'Missing tooth',
  diagnosed: 'Diagnosed',
  planned: 'Planned',
  inProgress: 'In progress',
  completed: 'Completed',
  numberingSystem: 'Numbering System',

  probingDepth: 'Probing Depth (PD)',
  gingivalMargin: 'Gingival Margin (GM)',
  bleedingOnProbing: 'Bleeding on Probing (BOP)',
  suppuration: 'Suppuration',
  furcation: 'Furcation involvement',
  mobility: 'Tooth mobility',
  plaqueIndex: "O'Leary Plaque Index",
  clinicalAttachmentLoss: 'Clinical Attachment Loss (CAL)',
  periodontalExams: 'Periodontal Examinations',
  newPeriodontalExam: 'New Periodontal Exam',
  historyComparison: 'Historical Comparison',

  booked: 'Booked',
  confirmed: 'Confirmed',
  arrived: 'Waiting room',
  inTreatment: 'In chair',
  cancelled: 'Cancelled',
  noShow: 'No-show',
  waitingTime: 'Wait time',
  chairsOverview: 'Operatory utilization',

  invoices: 'Invoices & Estimates',
  payments: 'Collected Payments',
  newInvoice: 'New Invoice',
  recordPayment: 'Record Payment',
  totalAmount: 'Total amount',
  paidAmount: 'Paid amount',
  balanceDue: 'Balance due',
  unpaid: 'Unpaid',
  partiallyPaid: 'Partially paid',
  paid: 'Paid',
  cash: 'Cash',
  card: 'Credit card',
  cheque: 'Check',
  bankTransfer: 'Wire transfer',
  insurance: 'Insurance / Third-party',
  monthly: 'Monthly',
  yearly: 'Yearly (2 months free)',
  plans: 'Subscription plans',
};

const AR_TRANSLATIONS: Dictionary = {
  appTitle: 'دنتيوس',
  dashboard: 'لوحة التحكم',
  agenda: 'جدول المواعيد',
  waitingRoom: 'قاعة الانتظار',
  patients: 'ملفات المرضى',
  clinical: 'القسم الطبي السريري',
  treatments: 'خطط العلاج',
  billing: 'الفواتير والمدفوعات',
  procedures: 'دليل العلاجات والأسعار',
  reports: 'التقارير والإحصائيات',
  clinicSettings: 'العيادة والفريق',
  subscription: 'اشتراك المنصة',
  auditTrail: 'سجل العمليات والتدقيق',
  searchPlaceholder: 'بحث عن مريض (الاسم، الهاتف، بطاقة التعريف، رقم الملف)...',
  quickSearchHint: 'اضغط / للبحث السريع',
  newPatient: 'مريض جديد',
  newAppointment: 'موعد جديد',
  save: 'حفظ',
  cancel: 'إلغاء',
  edit: 'تعديل',
  delete: 'حذف',
  confirm: 'تأكيد',
  close: 'إغلاق',
  actions: 'إجراءات',
  status: 'الحالة',
  date: 'التاريخ',
  time: 'الوقت',
  doctor: 'الطبيب',
  chair: 'كرسي العلاج',
  notes: 'ملاحظات',
  currency: 'درهم',
  filter: 'تصفية',
  export: 'تصدير',
  today: 'اليوم',
  viewAll: 'عرض الكل',
  overview: 'نظرة عامة',
  noData: 'لا توجد بيانات مسجلة',

  odontogram: 'مخطط الأسنان السريري',
  periodontal: 'مخطط أمراض اللثة',
  clinicalNotes: 'الملاحظات الطبية (SOAP)',
  documentsAndImaging: 'الأشعة والمستندات',
  patientTimeline: 'تسلسل الرعاية الطبية',
  currentStatus: 'الوضع الحالي',
  treatmentPlan: 'خطة العلاج',
  tooth: 'السن',
  surfaces: 'الأسطح',
  caries: 'تسوس',
  restoration: 'حشوة تجميلية',
  endodontics: 'علاج الجذور والعصب',
  crown: 'تاج سني',
  implant: 'زراعة الأسنان',
  extraction: 'خلع',
  healthy: 'سن سليم',
  missingTooth: 'سن مفقود',
  diagnosed: 'تم التشخيص',
  planned: 'مخطط',
  inProgress: 'قيد التنفيذ',
  completed: 'تم الإنجاز',
  numberingSystem: 'نظام الترقيم',

  probingDepth: 'عمق الجيب اللثوي',
  gingivalMargin: 'مستوى حافة اللثة',
  bleedingOnProbing: 'النزف عند الفحص',
  suppuration: 'تقيح اللثة',
  furcation: 'إصابة تفرع الجذور',
  mobility: 'حركة السن',
  plaqueIndex: 'مؤشر اللويحة السنية',
  clinicalAttachmentLoss: 'فقدان الارتباط اللثوي',
  periodontalExams: 'فحوصات اللثة السريرية',
  newPeriodontalExam: 'فحص لثة جديد',
  historyComparison: 'مقارنة تاريخية',

  booked: 'مجدول',
  confirmed: 'مؤكد',
  arrived: 'في قاعة الانتظار',
  inTreatment: 'على كرسي العلاج',
  cancelled: 'ملغى',
  noShow: 'لم يحضر',
  waitingTime: 'مدة الانتظار',
  chairsOverview: 'استخدام الكراسي',

  invoices: 'الفواتير والتقديرات',
  payments: 'المداخيل والمدفوعات',
  newInvoice: 'إنشاء فاتورة',
  recordPayment: 'تسجيل دفعة',
  totalAmount: 'المبلغ الإجمالي',
  paidAmount: 'المبلغ المدفوع',
  balanceDue: 'المتبقي للأداء',
  unpaid: 'غير مؤدى',
  partiallyPaid: 'مؤدى جزئياً',
  paid: 'تم الأداء بالكامل',
  cash: 'نقداً',
  card: 'بطاقة بنكية',
  cheque: 'شيك',
  bankTransfer: 'تحويل بنكي',
  insurance: 'تغطية تأمينية',
  monthly: 'شهري',
  yearly: 'سنوي (شهران مجاناً)',
  plans: 'باقات الاشتراك',
};

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  readonly currentLocale = signal<AppLocale>('fr');

  readonly dict = computed<Dictionary>(() => {
    switch (this.currentLocale()) {
      case 'en':
        return EN_TRANSLATIONS;
      case 'ar':
        return AR_TRANSLATIONS;
      case 'fr':
      default:
        return FR_TRANSLATIONS;
    }
  });

  readonly isRtl = computed(() => this.currentLocale() === 'ar');

  setLocale(locale: AppLocale): void {
    this.currentLocale.set(locale);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    }
  }

  formatCurrency(amount: number, currency = 'MAD'): string {
    const formatted = new Intl.NumberFormat(
      this.currentLocale() === 'en' ? 'en-US' : this.currentLocale() === 'ar' ? 'ar-MA' : 'fr-FR',
      { maximumFractionDigits: 0 }
    ).format(amount);
    return `${formatted} ${currency}`;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat(
      this.currentLocale() === 'en' ? 'en-US' : this.currentLocale() === 'ar' ? 'ar-MA' : 'fr-FR',
      { dateStyle: 'medium' }
    ).format(date);
  }

  formatTime(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat(
      this.currentLocale() === 'en' ? 'en-US' : this.currentLocale() === 'ar' ? 'ar-MA' : 'fr-FR',
      { timeStyle: 'short' }
    ).format(date);
  }
}
