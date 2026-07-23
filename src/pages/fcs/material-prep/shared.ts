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

function formatUnitQty(value: number, unit: string): string {
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`
}

export function formatMaterialPrepUnitMetric(
  projection: MaterialPrepOrderProjection,
  metric: 'requiredQty' | 'confirmedPrepQty' | 'grossPickedQty' | 'returnedQty' | 'effectivePickedQty' | 'availableToPickupQty' | 'shortageQty',
): string {
  const positive = projection.unitSummaries.filter((summary) => summary[metric] > 0)
  const summaries = positive.length ? positive : projection.unitSummaries.slice(0, 1)
  return summaries.length
    ? summaries.map((summary) => formatUnitQty(summary[metric], summary.unit)).join('；')
    : '0'
}

export function formatMaterialPrepProgressByUnit(projection: MaterialPrepOrderProjection): string {
  return projection.unitSummaries
    .filter((summary) => summary.requiredQty > 0)
    .map((summary) =>
      `${summary.unit}：已配 ${formatUnitQty(summary.confirmedPrepQty, summary.unit)} / 需求 ${formatUnitQty(summary.requiredQty, summary.unit)}`
    )
    .join('；') || '暂无需求'
}

export function formatMaterialPrepPickupByUnit(projection: MaterialPrepOrderProjection): string {
  return projection.unitSummaries
    .filter((summary) =>
      summary.grossPickedQty > 0 ||
      summary.returnedQty > 0 ||
      summary.availableToPickupQty > 0
    )
    .map((summary) =>
      `${summary.unit}：已领 ${formatUnitQty(summary.grossPickedQty, summary.unit)}，已退 ${formatUnitQty(summary.returnedQty, summary.unit)}，可领 ${formatUnitQty(summary.availableToPickupQty, summary.unit)}`
    )
    .join('；') || '暂无可领'
}

interface MaterialObjectCodeButtonOptions {
  label?: string
  className?: string
}

export function renderMaterialPrepOrderCodeButton(
  projection: MaterialPrepOrderProjection,
  options: MaterialObjectCodeButtonOptions = {},
): string {
  return renderProductionObjectCodeButton({
    objectType: 'MATERIAL_PREP_ORDER',
    objectId: projection.order.prepOrderNo,
    label: options.label,
    relatedProductionOrderNo: projection.order.productionOrderNo,
    defaultTab: 'materials',
    highlightKey: `MATERIAL_PREP_ORDER:${projection.order.prepOrderNo}`,
    className: options.className,
  })
}

export function renderMaterialPrepRecordCodeButton(
  record: Pick<MaterialPrepRecord, 'prepRecordId'> & Partial<Pick<MaterialPrepRecord, 'recordNo'>>,
  relatedProductionOrderNo: string,
  options: MaterialObjectCodeButtonOptions = {},
): string {
  return renderProductionObjectCodeButton({
    objectType: 'MATERIAL_PREP_RECORD',
    objectId: record.prepRecordId,
    label: options.label ?? record.recordNo ?? record.prepRecordId,
    relatedProductionOrderNo,
    defaultTab: 'materials',
    highlightKey: `MATERIAL_PREP_RECORD:${record.prepRecordId}`,
    className: options.className,
  })
}

export function renderMaterialPickupRecordCodeButton(
  pickup: PickupRecord,
  relatedProductionOrderNo: string,
  options: MaterialObjectCodeButtonOptions = {},
): string {
  return renderProductionObjectCodeButton({
    objectType: 'MATERIAL_PICKUP_RECORD',
    objectId: pickup.pickupRecordId,
    label: options.label,
    relatedProductionOrderNo,
    defaultTab: 'materials',
    highlightKey: `MATERIAL_PICKUP_RECORD:${pickup.pickupRecordId}`,
    className: options.className,
  })
}
