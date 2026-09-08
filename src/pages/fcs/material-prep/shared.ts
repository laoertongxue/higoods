import { appendManualPrepRecord } from '../../../data/fcs/cutting/production-material-prep.ts'
import { renderBadge } from '../../../components/ui/badge.ts'

import {
  materialPrepStatusLabelMap,
  materialPrepRecordStatusLabelMap,
  materialPrepWorkbenchTabs,
  pickupStatusLabelMap,
  classifyPrepLineType,
  getMaterialPrepRecordUnitSummaries,
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

export function formatMaterialPrepStockByUnit(lines: Pick<MaterialPrepLine, 'availableStockQty' | 'unit'>[]): string {
  const totals = new Map<string, number>()
  for (const line of lines) {
    const unit = line.unit?.trim() || '单位待确认'
    totals.set(unit, (totals.get(unit) || 0) + Number(line.availableStockQty || 0))
  }
  return [...totals].map(([unit, quantity]) => formatUnitQty(quantity, unit)).join('；') || '0'
}

export function formatMaterialPrepRecordByUnit(record: MaterialPrepRecord): string {
  const summaries = record.unitSummaries?.length
    ? record.unitSummaries
    : getMaterialPrepRecordUnitSummaries(record)
  return summaries
    .map((summary) => `${summary.rollCount} 卷件 / ${formatUnitQty(summary.preparedQty, summary.unit)}`)
    .join('；') || '暂无数量'
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
  record: { prepRecordId: string; recordNo?: string | number; batchNo?: string },
  relatedProductionOrderNo: string,
  options: MaterialObjectCodeButtonOptions = {},
): string {
  return renderProductionObjectCodeButton({
    objectType: 'MATERIAL_PREP_RECORD',
    objectId: record.prepRecordId,
    label: options.label ?? String(record.recordNo ?? record.batchNo ?? record.prepRecordId),
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

// 五个既有配料表单共用读取；保存失败保留当前输入。
export function saveMaterialPrepForm(button: HTMLElement, prepOrderId: string): boolean {
  const form = button.closest<HTMLElement>('[data-fcs-prep-form]')
  if (!form) return false
  try {
    const value = (selector: string) => form.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value ?? ''
    const items = Array.from(form.querySelectorAll<HTMLElement>('[data-prep-line-id]')).map((row) => ({
      prepLineId: row.dataset.prepLineId || '',
      preparedQty: Number(row.querySelector<HTMLInputElement>('[data-fcs-prep-line-qty]')?.value ?? 0),
      rollCount: Number(row.querySelector<HTMLInputElement>('[data-fcs-prep-line-count]')?.value ?? 0),
    }))
    if (items.some((item) => !Number.isFinite(item.preparedQty) || item.preparedQty < 0 || !Number.isInteger(item.rollCount) || item.rollCount < 0)) throw new Error('请填写有效的配料数量和非负整数卷数或件数。')
    const selected = items.filter((item) => item.preparedQty > 0)
    if (!selected.length) throw new Error('请至少填写一行大于0的本次配料数量。')
    if (!value('[data-fcs-prep-time]').trim()) throw new Error('请填写本次配料时间。')
    appendManualPrepRecord({ prepOrderId, ...selected[0], items: selected, appendToRecordId: button.dataset.appendPrepRecordId,
      operatorName: value('[data-fcs-prep-operator]'), preparedAt: value('[data-fcs-prep-time]'),
      remark: value('[data-fcs-prep-remark]'), warehouseArea: '', locationCode: '',
    })
    return true
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '配料未保存，请检查输入后重试。')
    return false
  }
}

export function getMaterialPrepFormTime(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function askMaterialPrepOperator(action: string): string | null {
  const name = window.prompt(`请输入本次${action}人姓名：`, '')
  if (name === null) return null
  if (!name.trim()) { window.alert('请填写实际操作人姓名。'); return null }
  return name.trim()
}
