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

export {
  materialPrepStatusLabelMap,
  materialPrepRecordStatusLabelMap,
  materialPrepWorkbenchTabs,
  pickupStatusLabelMap,
  classifyPrepLineType,
  escapeHtml,
  renderBadge,
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
