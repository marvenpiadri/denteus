export interface AuditLog {
  id: string;
  organizationId: string;
  clinicId?: string;
  userId: string;
  userName: string;
  action: string;
  entityType: 'patient' | 'odontogram' | 'periodontal' | 'treatment_plan' | 'appointment' | 'invoice' | 'payment' | 'clinical_note';
  entityId: string;
  description: string;
  timestamp: string;
  ipAddress?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  badge?: string;
  description: string;
  monthlyFeeMAD: number;
  yearlyFeeMAD: number;
  monthlyFeeEUR: number;
  yearlyFeeEUR: number;
  maxChairs: number;
  maxDoctors: number;
  maxStorageGb: number;
  features: string[];
  isPopular?: boolean;
}
