import type { PickupOrderGroup } from './pickup-management-projection.ts'

export interface PickupOrderCard {
  cardKey: string
  productionOrderId: string
  groups: PickupOrderGroup[]
  primaryGroup: PickupOrderGroup
}

export function buildPickupOrderCards(groups: PickupOrderGroup[]): PickupOrderCard[] {
  const cards = new Map<string, PickupOrderCard>()
  groups.forEach((group) => {
    const existing = cards.get(group.productionOrderId)
    if (existing) {
      existing.groups.push(group)
      if (existing.primaryGroup.supplementOrderNo && !group.supplementOrderNo) existing.primaryGroup = group
      return
    }
    cards.set(group.productionOrderId, {
      cardKey: `${group.listKind}:${group.productionOrderId}`,
      productionOrderId: group.productionOrderId,
      groups: [group],
      primaryGroup: group,
    })
  })
  return Array.from(cards.values()).map((card) => ({
    ...card,
    groups: [...card.groups].sort((left, right) => {
      if (Boolean(left.supplementOrderNo) !== Boolean(right.supplementOrderNo)) return left.supplementOrderNo ? 1 : -1
      return (left.supplementSequenceNo ?? 0) - (right.supplementSequenceNo ?? 0)
    }),
  }))
}
