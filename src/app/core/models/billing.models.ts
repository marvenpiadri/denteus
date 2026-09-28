export type PaymentMethodType = 'cash' | 'card' | 'cheque' | 'transfer' | 'insurance';

export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';

export interface InvoiceItem {
  id: string;
  procedureCode: string;
  description: string;
  toothNumber?: number;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PaymentRecord {
  id: string;
  invoiceId?: string;
  patientId: string;
  clinicId: string;
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethodType;
  referenceNumber?: string;
  notes?: string;
  recordedBy: string;
}

export interface Invoice {
  id: string;
  organizationId: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  patientNumber: string;
  doctorId: string;
  doctorName: string;
  invoiceNumber: string; // e.g. "FAC-2026-0048"
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  status: InvoiceStatus;
  notes?: string;
}
