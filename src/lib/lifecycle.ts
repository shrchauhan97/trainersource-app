export const reasonOptions = [
  'abuse', 'fraud', 'compliance', 'churn', 'test-data', 'other',
] as const;

export type ReasonCategory = (typeof reasonOptions)[number];

export function isRemovableReason(value: string): value is ReasonCategory {
  return (reasonOptions as readonly string[]).includes(value);
}

export type LifecycleEntity = 'customer' | 'trainer' | 'access_code';

export interface LifecycleEventInput {
  entityType: LifecycleEntity;
  entityId: string;
  fromStatus: string | null;
  toStatus: string;
  actorAdminId: string;
  reasonCategory: ReasonCategory;
  reasonNote?: string;
  metadata?: Record<string, unknown>;
}
