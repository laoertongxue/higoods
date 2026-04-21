export type FcsActionRole =
  | 'FACTORY'
  | 'RECEIVER'
  | 'PLATFORM'
  | 'QC'
  | 'CUTTING_LEAD'
  | 'CUTTING_OPERATOR'
  | 'WAREHOUSE_OPERATOR'
  | 'VIEWER'

export type FcsActionCode =
  | 'CREATE_HANDOVER_RECORD'
  | 'RECEIVER_WRITEBACK'
  | 'RAISE_QUANTITY_OBJECTION'
  | 'ACCEPT_DIFF'
  | 'REVIEW_REPLENISHMENT'
  | 'APPLY_REPLENISHMENT'
  | 'CONFIRM_PICKUP'
  | 'REJECT_PICKUP'
  | 'EXCEPTION_PICKUP'
  | 'CONFIGURE_FABRIC_MATERIAL'
  | 'REVIEW_PRINTING_TRANSFER'
  | 'REVIEW_DYEING_TRANSFER'

export const ACTION_PERMISSION_DENIED_TEXT = '无操作权限'

const ACTION_ROLE_MAP: Record<FcsActionCode, FcsActionRole[]> = {
  CREATE_HANDOVER_RECORD: ['FACTORY', 'PLATFORM'],
  RECEIVER_WRITEBACK: ['RECEIVER', 'PLATFORM'],
  RAISE_QUANTITY_OBJECTION: ['FACTORY', 'PLATFORM'],
  ACCEPT_DIFF: ['FACTORY', 'PLATFORM'],
  REVIEW_REPLENISHMENT: ['CUTTING_LEAD', 'PLATFORM'],
  APPLY_REPLENISHMENT: ['CUTTING_LEAD', 'PLATFORM'],
  CONFIRM_PICKUP: ['CUTTING_OPERATOR', 'PLATFORM'],
  REJECT_PICKUP: ['CUTTING_OPERATOR', 'PLATFORM'],
  EXCEPTION_PICKUP: ['CUTTING_OPERATOR', 'PLATFORM'],
  CONFIGURE_FABRIC_MATERIAL: ['WAREHOUSE_OPERATOR', 'CUTTING_LEAD', 'PLATFORM'],
  REVIEW_PRINTING_TRANSFER: ['WAREHOUSE_OPERATOR', 'PLATFORM'],
  REVIEW_DYEING_TRANSFER: ['WAREHOUSE_OPERATOR', 'PLATFORM'],
}

function isRole(value: string | null): value is FcsActionRole {
  return Boolean(
    value &&
      ['FACTORY', 'RECEIVER', 'PLATFORM', 'QC', 'CUTTING_LEAD', 'CUTTING_OPERATOR', 'WAREHOUSE_OPERATOR', 'VIEWER'].includes(
        value,
      ),
  )
}

export function resolveFcsDemoRole(defaultRole: FcsActionRole = 'PLATFORM'): FcsActionRole {
  if (typeof window === 'undefined') return defaultRole

  const params = new URLSearchParams(window.location.search)
  const searchRole = params.get('demoRole')
  if (isRole(searchRole)) return searchRole

  const attrRole = document.body?.dataset.demoRole || null
  if (isRole(attrRole)) return attrRole

  return defaultRole
}

export function canRunFcsAction(action: FcsActionCode, role: FcsActionRole): boolean {
  return ACTION_ROLE_MAP[action]?.includes(role) ?? false
}

export function canCreateHandoverRecord(role: FcsActionRole): boolean {
  return canRunFcsAction('CREATE_HANDOVER_RECORD', role)
}

export function canReceiverWritebackAction(role: FcsActionRole): boolean {
  return canRunFcsAction('RECEIVER_WRITEBACK', role)
}

export function canRaiseQuantityObjection(role: FcsActionRole): boolean {
  return canRunFcsAction('RAISE_QUANTITY_OBJECTION', role)
}

export function canAcceptDiffAction(role: FcsActionRole): boolean {
  return canRunFcsAction('ACCEPT_DIFF', role)
}

export function canReviewReplenishment(role: FcsActionRole): boolean {
  return canRunFcsAction('REVIEW_REPLENISHMENT', role)
}

export function canConfigureFabricMaterial(role: FcsActionRole): boolean {
  return canRunFcsAction('CONFIGURE_FABRIC_MATERIAL', role)
}
