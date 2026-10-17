export const recallStatuses = ['DUE', 'CONTACTED', 'SCHEDULED', 'COMPLETED', 'DECLINED', 'INACTIVE'] as const;
export type RecallStatus = typeof recallStatuses[number];

const transitions: Record<RecallStatus, readonly RecallStatus[]> = {
  DUE: ['CONTACTED', 'SCHEDULED', 'COMPLETED', 'DECLINED', 'INACTIVE'],
  CONTACTED: ['DUE', 'SCHEDULED', 'COMPLETED', 'DECLINED', 'INACTIVE'],
  SCHEDULED: ['DUE', 'CONTACTED', 'COMPLETED', 'INACTIVE'],
  COMPLETED: ['INACTIVE'],
  DECLINED: ['DUE', 'INACTIVE'],
  INACTIVE: ['DUE'],
};

export function canTransitionRecallStatus(from: RecallStatus, to: RecallStatus): boolean {
  return from !== to && transitions[from].includes(to);
}

export function statusAfterRecallContact(from: RecallStatus, outcome: string): RecallStatus | null {
  if (from !== 'DUE' && from !== 'CONTACTED') return null;
  if (outcome === 'BOOKED') return 'SCHEDULED';
  if (outcome === 'DECLINED') return 'DECLINED';
  return 'CONTACTED';
}
