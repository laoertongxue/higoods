import { renderBadge } from '../../../components/ui/badge.ts'

import {
  materialPrepStatusLabelMap,
  materialPrepRecordStatusLabelMap,
  materialPrepWorkbenchTabs,
  pickupStatusLabelMap,
  classifyPrepLineType,
} from '../../../data/fcs/cutting/production-material-prep.ts'

import type {
  MaterialPrepOrderStatus,
  MaterialPrepRecordStatus,
  MaterialPrepCategory,
  MaterialPrepOrderProjection,
  MaterialPrepLine,
  MaterialPrepRecord,
  PickupRecord,
  PrepRejectRecord,
} from '../../../data/fcs/cutting/production-material-prep.ts'

import type { BadgeVariant } from '../../../components/ui/types.ts'

import { escapeHtml } from '../../../utils.ts'
import { renderProductionObjectCodeButton } from '../../../data/fcs/production-order-identity.ts'

export {
  materialPrepStatusLabelMap,
  materialPrepRecordStatusLabelMap,
  materialPrepWorkbenchTabs,
  pickupStatusLabelMap,
  classifyPrepLineType,
  escapeHtml,
  renderBadge,
  renderProductionObjectCodeButton,
}

export type {
  MaterialPrepOrderStatus,
  MaterialPrepRecordStatus,
  MaterialPrepCategory,
  MaterialPrepOrderProjection,
  MaterialPrepLine,
  MaterialPrepRecord,
  PickupRecord,
  PrepRejectRecord,
}

const recordStatusVariantMap: Record<MaterialPrepRecordStatus, BadgeVariant> = {
  DRAFT: 'neutral',
  PICKED: 'info',
  STAGED: 'warning',
  CONFIRMED: 'success',
  REJECTED: 'danger',
}

export function renderPrepRecordStatusBadge(status: MaterialPrepRecordStatus): string {
  const label = materialPrepRecordStatusLabelMap[status]
  const variant = recordStatusVariantMap[status]
  return renderBadge(label, variant)
}

export function formatQty(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  return value.toLocaleString('zh-CN')
}

export function renderMaterialPrepOrderCodeButton(projection: MaterialPrepOrderProjection): string {
  return renderProductionObjectCodeButton({
    objectType: 'MATERIAL_PREP_ORDER',
    objectId: projection.order.prepOrderNo,
    relatedProductionOrderNo: projection.order.productionOrderNo,
    defaultTab: 'materials',
    highlightKey: `MATERIAL_PREP_ORDER:${projection.order.prepOrderNo}`,
  })
}

export function renderMaterialPickupRecordCodeButton(pickup: PickupRecord, relatedProductionOrderNo: string): string {
  return renderProductionObjectCodeButton({
    objectType: 'MATERIAL_PICKUP_RECORD',
    objectId: pickup.pickupRecordId,
    relatedProductionOrderNo,
    defaultTab: 'materials',
    highlightKey: `MATERIAL_PICKUP_RECORD:${pickup.pickupRecordId}`,
  })
}
