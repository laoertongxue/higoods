export type DispatchFulfillmentRole = 'PRODUCTION_PLANNER' | 'TENDER_AWARDER' | 'FOLLOW_UP' | 'SETTLEMENT' | 'FACTORY_FRONTLINE'

export function canConfirmDispatchPrice(role: DispatchFulfillmentRole): boolean {
  return role === 'PRODUCTION_PLANNER' || role === 'TENDER_AWARDER'
}

export function canManageContractEvidence(role: DispatchFulfillmentRole): boolean {
  return role === 'PRODUCTION_PLANNER' || role === 'FOLLOW_UP'
}

export function canEditFrozenAssignmentPrice(): false {
  return false
}

export function assertFactoryFrontlineReadOnly(role: DispatchFulfillmentRole): void {
  if (role === 'FACTORY_FRONTLINE' && (canConfirmDispatchPrice(role) || canManageContractEvidence(role))) {
    throw new Error('工厂一线端不得编辑合同、回货规则或已冻结派单价')
  }
}
