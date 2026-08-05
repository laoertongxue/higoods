export type UnifiedDispatchStatus =
  | 'UNASSIGNED'
  | 'BIDDING'
  | 'ASSIGNED'
  | 'IN_PRODUCTION'
  | 'PARTIAL_RETURN'
  | 'COMPLETED'
  | 'CANCELLED'

export const UNIFIED_DISPATCH_STATUS_LABELS: Record<UnifiedDispatchStatus, string> = {
  UNASSIGNED: '待分配',
  BIDDING: '竞价中',
  ASSIGNED: '已分配',
  IN_PRODUCTION: '生产中',
  PARTIAL_RETURN: '部分回货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

export function projectUnifiedDispatchStatus(input: {
  assignmentStatus?: string
  confirmedReturnedQty?: number
  assignedQty?: number
  cancelled?: boolean
}): UnifiedDispatchStatus {
  if (input.cancelled) return 'CANCELLED'
  if (input.assignmentStatus === 'BIDDING') return 'BIDDING'
  if (!input.assignmentStatus || input.assignmentStatus === 'UNASSIGNED') return 'UNASSIGNED'
  const returned = input.confirmedReturnedQty || 0
  const assigned = input.assignedQty || 0
  if (assigned > 0 && returned >= assigned) return 'COMPLETED'
  if (returned > 0) return 'PARTIAL_RETURN'
  if (input.assignmentStatus === 'ASSIGNED' || input.assignmentStatus === 'AWARDED') return 'ASSIGNED'
  return 'IN_PRODUCTION'
}
