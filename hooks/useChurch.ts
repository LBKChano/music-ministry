// hooks/useChurch.ts
// Re-exports useChurch from ChurchContext for backwards compatibility.
// All state and logic lives in contexts/ChurchContext.tsx.
export { useChurch } from '@/contexts/ChurchContext';
export type { RecurringServiceWithRoles, ChurchMemberWithRoles, FillInRequestWithMemberInfo } from '@/contexts/ChurchContext';
