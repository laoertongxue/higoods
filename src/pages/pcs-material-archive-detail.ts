// @page-pattern: detail

import {
  getMaterialArchiveById,
  listMaterialSkuRecordsByMaterialId,
  updateMaterialUnitConversions,
} from '../data/pcs-material-archive-repository.ts'
import type { MaterialArchiveKind, MaterialArchiveRecord, MaterialUnitConversion } from '../data/pcs-material-archive-types.ts'
import { getTechPackReviewerById } from '../data/pcs-tech-pack-reviewer-directory.ts'
import { escapeHtml } from '../utils.ts'
import { currentUser } from './tech-pack/context.ts'
import {
  handlePcsMaterialArchiveEvent,
  handlePcsMaterialArchiveInput,
  isPcsMaterialArchiveDialogOpen,
  renderPcsMaterialArchiveDetailPage as renderBaseMaterialArchiveDetailPage,
  resetPcsMaterialArchiveState,
} from './pcs-material-archives.ts'

interface UnitConversionDraftRow {
  fromUnit: string
  toUnit: string
  factor: string
}

const unitConversionState: {
  open: boolean
  materialId: string
  rows: UnitConversionDraftRow[]
  notice: string
} = {
  open: false,
  materialId: '',
  rows: [],
  notice: '',
}

function getAllowedUnits(material: MaterialArchiveRecord): string[] {
  return [...new Set([material.mainUnit, ...material.auxiliaryUnits, material.pricingUnit].filter(Boolean))]
}

function canCurrentUserMaintainUnitConversions(): boolean {
  return Boolean(getTechPackReviewerById(currentUser.id)?.roles.includes('买手'))
}

function renderUnitSelect(field: string, value: string, index: number, units: string[]): string {
  return `
    <select data-pcs-material-unit-field="${escapeHtml(field)}" data-conversion-index="${index}" data-skip-page-rerender="true" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400">
      <option value="">请选择</option>
      ${units.map((unit) => `<option value="${escapeHtml(unit)}" ${unit === value ? 'selected' : ''}>${escapeHtml(unit)}</option>`).join('')}
    </select>
  `
}

function renderUnitConversionRows(material: MaterialArchiveRecord): string {
  const units = getAllowedUnits(material)
  return `
    <div class="space-y-3" data-pcs-material-unit-conversion-list>
      ${unitConversionState.rows.length > 0
        ? unitConversionState.rows.map((row, index) => `
            <div class="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr,1fr,1fr,auto]">
              <label class="space-y-2"><span class="text-sm font-medium text-slate-700">来源单位</span>${renderUnitSelect('fromUnit', row.fromUnit, index, units)}</label>
              <label class="space-y-2"><span class="text-sm font-medium text-slate-700">目标单位</span>${renderUnitSelect('toUnit', row.toUnit, index, units)}</label>
              <label class="space-y-2"><span class="text-sm font-medium text-slate-700">换算系数</span><input type="number" min="0.0001" step="0.0001" value="${escapeHtml(row.factor)}" placeholder="请输入" data-pcs-material-unit-field="factor" data-conversion-index="${index}" data-skip-page-rerender="true" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400" /></label>
              <div class="flex items-end"><button type="button" class="inline-flex h-10 items-center rounded-md border border-rose-200 bg-white px-3 text-sm text-rose-600 hover:bg-rose-50" data-pcs-material-archive-action="delete-unit-conversion" data-conversion-index="${index}" data-skip-page-rerender="true">删除</button></div>
            </div>
          `).join('')
        : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">暂无单位换算关系。</div>'}
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-material-archive-action="add-unit-conversion" data-skip-page-rerender="true">新增换算关系</button>
    </div>
  `
}

function renderUnitConversionDrawer(): string {
  if (!canCurrentUserMaintainUnitConversions() || !unitConversionState.open || !unitConversionState.materialId) return ''
  const material = getMaterialArchiveById(unitConversionState.materialId)
  if (!material) return ''
  return `
    <div class="fixed inset-0 z-40 flex justify-end">
      <button type="button" class="absolute inset-0 bg-slate-900/30" aria-label="关闭" data-pcs-material-archive-action="close-unit-conversions"></button>
      <section class="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-xl">
        <div class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div><h2 class="text-lg font-semibold text-slate-900">单位换算</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(material.materialCode)} · 可选单位：${escapeHtml(getAllowedUnits(material).join('、'))}</p></div>
          <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" data-pcs-material-archive-action="close-unit-conversions">×</button>
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-5">
          ${unitConversionState.notice ? `<div class="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">${escapeHtml(unitConversionState.notice)}</div>` : ''}
          ${renderUnitConversionRows(material)}
        </div>
        <div class="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-material-archive-action="close-unit-conversions">取消</button>
          <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-material-archive-action="submit-unit-conversions">保存</button>
        </div>
      </section>
    </div>
  `
}

function refreshUnitConversionRows(): void {
  if (typeof document === 'undefined') return
  const material = getMaterialArchiveById(unitConversionState.materialId)
  const host = document.querySelector<HTMLElement>('[data-pcs-material-unit-conversion-list]')
  if (material && host) host.outerHTML = renderUnitConversionRows(material)
}

function openUnitConversionEditor(materialId: string): boolean {
  if (!canCurrentUserMaintainUnitConversions()) return false
  const material = getMaterialArchiveById(materialId)
  if (!material) return false
  unitConversionState.open = true
  unitConversionState.materialId = materialId
  unitConversionState.notice = ''
  unitConversionState.rows = (material.unitConversions || []).map((item) => ({
    fromUnit: item.fromUnit,
    toUnit: item.toUnit,
    factor: String(item.factor),
  }))
  if (unitConversionState.rows.length === 0) {
    unitConversionState.rows.push({ fromUnit: '', toUnit: '', factor: '' })
  }
  return true
}

function closeUnitConversionEditor(): void {
  unitConversionState.open = false
  unitConversionState.materialId = ''
  unitConversionState.rows = []
  unitConversionState.notice = ''
}

function submitUnitConversions(): void {
  if (!canCurrentUserMaintainUnitConversions()) {
    unitConversionState.notice = '只有买手可以维护单位换算。'
    return
  }
  const conversions: MaterialUnitConversion[] = unitConversionState.rows.map((row) => ({
    fromUnit: row.fromUnit,
    toUnit: row.toUnit,
    factor: Number.parseFloat(row.factor),
  }))
  try {
    updateMaterialUnitConversions(unitConversionState.materialId, conversions, currentUser)
    closeUnitConversionEditor()
  } catch (error) {
    unitConversionState.notice = error instanceof Error ? error.message : '保存单位换算失败。'
  }
}

function renderEntryButton(materialId: string): string {
  return `<button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-material-archive-action="open-unit-conversions" data-material-id="${escapeHtml(materialId)}">维护单位换算</button>`
}

function upgradeStandardPricePrecision(html: string, materialId: string): string {
  const skuRecords = listMaterialSkuRecordsByMaterialId(materialId)
  const standardPrices = skuRecords.map((item) => item.costPrice)
  const detailPrices = skuRecords.flatMap((item) => [item.costPrice, item.costPrice + item.freightCost])
  let detailPriceIndex = 0
  let nextHtml = html.replace(
    /(<td class="px-4 py-3 text-sm text-slate-700">)¥-?\d+(?:\.\d+)?(<\/td>)/g,
    (_match, prefix: string, suffix: string) => `${prefix}¥${(detailPrices[detailPriceIndex++] || 0).toFixed(4)}${suffix}`,
  )
  if (standardPrices.length > 0) {
    const min = Math.min(...standardPrices)
    const max = Math.max(...standardPrices)
    const range = min === max ? `¥${min.toFixed(4)}` : `¥${min.toFixed(4)} ~ ¥${max.toFixed(4)}`
    nextHtml = nextHtml.replace(
      /(<div class="text-xs text-slate-500">SKU 成本区间<\/div><div class="mt-1 text-sm text-slate-700">)[^<]+/,
      `$1${range}`,
    )
  }
  return nextHtml
}

export function resetPcsMaterialArchiveDetailState(): void {
  resetPcsMaterialArchiveState()
  closeUnitConversionEditor()
}

export function renderPcsMaterialArchiveDetailPage(kind: MaterialArchiveKind, materialId: string): string {
  let html = upgradeStandardPricePrecision(renderBaseMaterialArchiveDetailPage(kind, materialId), materialId)
  if (canCurrentUserMaintainUnitConversions()) {
    html = html.replace(
      /(<button[^>]*data-pcs-material-archive-action="open-log"[^>]*>)/,
      `${renderEntryButton(materialId)}$1`,
    )
  }
  const drawer = renderUnitConversionDrawer()
  return drawer ? html.replace(/\s*<\/div>\s*$/, `${drawer}</div>`) : html
}

export function handlePcsMaterialArchiveDetailInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-material-unit-field]')
  if (!fieldNode) return handlePcsMaterialArchiveInput(target)
  if (!canCurrentUserMaintainUnitConversions()) return false
  const index = Number.parseInt(fieldNode.dataset.conversionIndex || '', 10)
  const row = unitConversionState.rows[index]
  if (!row) return false
  const value = (target as HTMLInputElement | HTMLSelectElement).value
  const field = fieldNode.dataset.pcsMaterialUnitField
  if (field === 'fromUnit') row.fromUnit = value
  else if (field === 'toUnit') row.toUnit = value
  else if (field === 'factor') row.factor = value
  else return false
  return true
}

export function handlePcsMaterialArchiveDetailEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-material-archive-action]')
  const action = actionNode?.dataset.pcsMaterialArchiveAction
  if (!actionNode || !action) return handlePcsMaterialArchiveEvent(target)
  if (action === 'open-unit-conversions') return openUnitConversionEditor(actionNode.dataset.materialId || '')
  if (action === 'close-unit-conversions') {
    closeUnitConversionEditor()
    return true
  }
  if (action === 'add-unit-conversion') {
    if (!canCurrentUserMaintainUnitConversions()) return false
    unitConversionState.rows.push({ fromUnit: '', toUnit: '', factor: '' })
    refreshUnitConversionRows()
    return true
  }
  if (action === 'delete-unit-conversion') {
    if (!canCurrentUserMaintainUnitConversions()) return false
    const index = Number.parseInt(actionNode.dataset.conversionIndex || '', 10)
    if (!Number.isInteger(index) || !unitConversionState.rows[index]) return false
    unitConversionState.rows.splice(index, 1)
    refreshUnitConversionRows()
    return true
  }
  if (action === 'submit-unit-conversions') {
    if (!canCurrentUserMaintainUnitConversions()) return false
    submitUnitConversions()
    return true
  }
  if (action === 'close-drawers') closeUnitConversionEditor()
  return handlePcsMaterialArchiveEvent(target)
}

export function isPcsMaterialArchiveDetailDialogOpen(): boolean {
  return unitConversionState.open || isPcsMaterialArchiveDialogOpen()
}
