import { Router, Request, Response } from 'express';

export const apiRouter = Router();

// In-memory data store for server-side REST API with tenant isolation
interface DbPatient {
  id: string;
  organizationId: string;
  clinicIds: string[];
  patientNumber: string;
  firstName: string;
  lastName: string;
  cin: string;
  birthDate: string;
  gender: 'M' | 'F';
  phone: string;
  email: string;
  address: string;
  city: string;
  balanceDue: number;
}

const DB_PATIENTS: DbPatient[] = [
  { id: 'pat-1', organizationId: 'org-1', clinicIds: ['clinic-1'], patientNumber: 'DEN-2026-0042', firstName: 'Amina', lastName: 'Tazi', cin: 'BK489123', birthDate: '1988-04-12', gender: 'F', phone: '+212 661 88 99 00', email: 'amina.tazi@gmail.com', address: '14 Bd Zerktouni', city: 'Casablanca', balanceDue: 2400 },
  { id: 'pat-2', organizationId: 'org-1', clinicIds: ['clinic-1', 'clinic-2'], patientNumber: 'DEN-2026-0089', firstName: 'Karim', lastName: 'Benjelloun', cin: 'A745910', birthDate: '1975-11-28', gender: 'M', phone: '+212 663 44 55 66', email: 'k.benjelloun@finance.ma', address: '8 Rue Abou Inan', city: 'Rabat', balanceDue: 0 },
  { id: 'pat-3', organizationId: 'org-1', clinicIds: ['clinic-1'], patientNumber: 'DEN-2026-0114', firstName: 'Leila', lastName: 'Chraibi', cin: 'BE892301', birthDate: '1995-07-03', gender: 'F', phone: '+212 665 12 34 56', email: 'leila.chraibi@outlook.com', address: '27 Rue d’Ifrane', city: 'Casablanca', balanceDue: 850 },
  { id: 'pat-4', organizationId: 'org-1', clinicIds: ['clinic-1'], patientNumber: 'DEN-2026-0165', firstName: 'Mehdi', lastName: 'Idrissi', cin: 'BK339012', birthDate: '1982-02-19', gender: 'M', phone: '+212 667 98 76 54', email: 'mehdi.idrissi@tech.ma', address: '102 Rue de Normandie', city: 'Casablanca', balanceDue: 5200 },
  { id: 'pat-5', organizationId: 'org-1', clinicIds: ['clinic-1'], patientNumber: 'DEN-2026-0201', firstName: 'Fatima Zahra', lastName: 'Filali', cin: 'CD540981', birthDate: '1968-09-14', gender: 'F', phone: '+212 660 33 22 11', email: 'fz.filali@gmail.com', address: '5 Résidence Anfa Plage', city: 'Casablanca', balanceDue: 0 },
];

// Health check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Denteus Dental Practice Management API',
    version: '1.0.0',
    locale: 'fr',
    timestamp: new Date().toISOString(),
  });
});

// Patients API
apiRouter.get('/patients', (req: Request, res: Response) => {
  const orgId = (req.query['orgId'] as string) || 'org-1';
  const query = (req.query['q'] as string)?.toLowerCase() || '';

  let list = DB_PATIENTS.filter((p) => p.organizationId === orgId);
  if (query) {
    list = list.filter(
      (p) =>
        p.firstName.toLowerCase().includes(query) ||
        p.lastName.toLowerCase().includes(query) ||
        p.patientNumber.toLowerCase().includes(query) ||
        p.cin.toLowerCase().includes(query) ||
        p.phone.includes(query)
    );
  }
  res.json({ data: list, count: list.length });
});

apiRouter.get('/patients/:id', (req: Request, res: Response) => {
  const patient = DB_PATIENTS.find((p) => p.id === req.params['id']);
  if (!patient) {
    return res.status(404).json({
      error: { code: 'PATIENT_NOT_FOUND', message: 'Dossier patient introuvable.' },
    });
  }
  return res.json({ data: patient });
});

apiRouter.post('/patients', (req: Request, res: Response) => {
  const body = req.body;
  if (!body.firstName || !body.lastName) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Nom et prénom obligatoires.' },
    });
  }
  const newPatient: DbPatient = {
    id: `pat-${Date.now()}`,
    organizationId: body.organizationId || 'org-1',
    clinicIds: body.clinicIds || ['clinic-1'],
    patientNumber: `DEN-2026-${String(DB_PATIENTS.length + 1).padStart(4, '0')}`,
    firstName: body.firstName,
    lastName: body.lastName,
    cin: body.cin || '',
    birthDate: body.birthDate || '1990-01-01',
    gender: body.gender || 'M',
    phone: body.phone || '',
    email: body.email || '',
    address: body.address || '',
    city: body.city || 'Casablanca',
    balanceDue: 0,
  };
  DB_PATIENTS.unshift(newPatient);
  return res.status(201).json({ data: newPatient });
});

// Analytics & Reports API
apiRouter.get('/reports/overview', (req: Request, res: Response) => {
  res.json({
    data: {
      activePatientsCount: 148,
      appointmentsTodayCount: 5,
      monthlyRevenueMAD: 48500,
      monthlyCollectedMAD: 38900,
      outstandingBalanceMAD: 9600,
      treatmentAcceptanceRate: 84.5,
      chairUtilizationRate: 78.2,
      recallsDueThisMonth: 12,
    },
  });
});
