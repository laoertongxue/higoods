// @page-pattern: list

import { escapeHtml } from '../../../utils.ts'
import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import { getCanonicalCuttingMeta } from './meta.ts'
import { renderCompactKpiCard, renderCompactKpiGroup } from './layout.helpers.ts'
import {
  buildBindingProcessOrders as buildProjectedBindingProcessOrders,
  getBindingDetailAvailableProcessQty,
  getBindingProcessOrderById,
  type BindingProcessActionCode,
  type BindingStripRequirementSummary,
} from './binding-strip-orders.ts'
import { executeBindingProcessActionWithWarehouse } from '../../../data/fcs/binding-process-warehouse-linkage-service.ts'
import type {
  BindingProcessDifferenceStatus,
  BindingProcessHandoverStatus,
  BindingProcessInboundStatus,
  BindingProcessOrder,
  BindingProcessPrintStatus,
  BindingProcessStatus,
  BindingStripCuttingRecord,
  BindingStripWorkOrderDetail,
} from './special-processes-model.ts'

const numberFormatter = new Intl.NumberFormat('zh-CN')
const BINDING_ACTION_MODAL_ID = 'cutting-binding-action-modal'

interface BindingListFilters {
  keyword: string
  status: BindingProcessStatus | '全部'
  printStatus: BindingProcessPrintStatus | '全部'
  materialKeyword: string
  differenceStatus: BindingProcessDifferenceStatus | '全部'
}

const bindingListFilters: BindingListFilters = {
  keyword: '',
  status: '全部',
  printStatus: '全部',
  materialKeyword: '',
  differenceStatus: '全部',
}
let bindingListPage = 1
let bindingListPageSize = 20

const statusToneMap: Record<BindingProcessStatus, string> = {
  待加工: 'border-slate-200 bg-slate-50 text-slate-700',
  加工中: 'border-blue-200 bg-blue-50 text-blue-700',
  已完成: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  已取消: 'border-zinc-200 bg-zinc-50 text-zinc-700',
}

const printToneMap: Record<BindingProcessPrintStatus, string> = {
  未生成: 'border-slate-200 bg-slate-50 text-slate-700',
  待打印: 'border-amber-200 bg-amber-50 text-amber-700',
  已打印: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const inboundToneMap: Record<BindingProcessInboundStatus, string> = {
  未入仓: 'border-slate-200 bg-slate-50 text-slate-700',
  部分入仓: 'border-amber-200 bg-amber-50 text-amber-700',
  已入仓: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const handoverToneMap: Record<BindingProcessHandoverStatus, string> = {
  未装袋: 'border-slate-200 bg-slate-50 text-slate-700',
  已装袋待交出: 'border-blue-200 bg-blue-50 text-blue-700',
  已交出: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const differenceToneMap: Record<BindingProcessDifferenceStatus, string> = {
  无差异: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  有差异: 'border-rose-200 bg-rose-50 text-rose-700',
}

const sufficiencyToneMap: Record<BindingProcessOrder['sufficiencyStatus'], string> = {
  待记录: 'border-slate-200 bg-slate-50 text-slate-700',
  充足: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  捆条不足: 'border-rose-200 bg-rose-50 text-rose-700',
  有差异: 'border-amber-200 bg-amber-50 text-amber-700',
}

export function buildBindingProcessOrders(): BindingProcessOrder[] {
  return buildProjectedBindingProcessOrders()
}

function formatCount(value: number): string {
  return numberFormatter.format(Math.max(0, Number(value || 0)))
}

function formatLength(value: number, fallback = '0.00 m'): string {
  if (!Number.isFinite(Number(value))) return fallback
  return `${Number(value || 0).toFixed(2)} m`
}

function formatRecordedLength(value: number): string {
  return Number(value || 0) > 0 ? formatLength(value) : '待记录'
}

function estimateDisplayedRollCount(lengthM: number): number {
  if (Number(lengthM || 0) <= 0) return 0
  return Math.max(Math.ceil(Number(lengthM) / 120), 1)
}

function roundLength(value: number): number {
  return Number(Number(value || 0).toFixed(2))
}

function resolveCuttingMethodLength(
  item: Pick<BindingStripWorkOrderDetail | BindingStripCuttingRecord, 'cuttingMethod' | 'straightCutLength' | 'crossCutLength' | 'biasCutLength' | 'actualLength'>,
): number {
  if (item.cuttingMethod === '直切') return item.straightCutLength || item.actualLength || 0
  if (item.cuttingMethod === '横切') return item.crossCutLength || item.actualLength || 0
  return item.biasCutLength || item.actualLength || 0
}

function resolveRollLength(
  item: Pick<BindingStripWorkOrderDetail | BindingStripCuttingRecord, 'rollLength' | 'actualRollCount' | 'actualLength' | 'cuttingMethod' | 'straightCutLength' | 'crossCutLength' | 'biasCutLength'>,
): number {
  if (item.rollLength > 0) return item.rollLength
  const rollCount = item.actualRollCount || estimateDisplayedRollCount(item.actualLength || resolveCuttingMethodLength(item))
  if (!rollCount) return 0
  return roundLength((item.actualLength || resolveCuttingMethodLength(item)) / rollCount)
}

function resolveCalculatedCuttingLength(
  item: Pick<BindingStripWorkOrderDetail | BindingStripCuttingRecord, 'rollLength' | 'actualRollCount' | 'actualLength' | 'cuttingMethod' | 'straightCutLength' | 'crossCutLength' | 'biasCutLength'>,
): number {
  const rollLength = resolveRollLength(item)
  const rollCount = item.actualRollCount || estimateDisplayedRollCount(item.actualLength || resolveCuttingMethodLength(item))
  if (rollLength > 0 && rollCount > 0) return roundLength(rollLength * rollCount)
  return resolveCuttingMethodLength(item)
}

function formatRollLength(
  item: Pick<BindingStripWorkOrderDetail | BindingStripCuttingRecord, 'rollLength' | 'actualRollCount' | 'actualLength' | 'cuttingMethod' | 'straightCutLength' | 'crossCutLength' | 'biasCutLength'>,
): string {
  return `每卷长度：${formatRecordedLength(resolveRollLength(item))}`
}

function formatCuttingMethodLength(
  item: Pick<BindingStripWorkOrderDetail | BindingStripCuttingRecord, 'rollLength' | 'actualRollCount' | 'cuttingMethod' | 'straightCutLength' | 'crossCutLength' | 'biasCutLength' | 'actualLength'>,
): string {
  return `切割长度：${formatRecordedLength(resolveCalculatedCuttingLength(item))}`
}

function renderMinRequiredLengthNote(detail: BindingStripWorkOrderDetail): string {
  if (!detail.minRequiredLengthApplied) return ''
  return `
    <span class="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      原算 ${escapeHtml(formatLength(detail.rawRequiredLength))}，不足 4m 按 4m
    </span>
  `
}

function renderOrderMinRequiredLengthNote(row: BindingProcessOrder): string {
  const minDetails = row.bindingDetails.filter((detail) => detail.minRequiredLengthApplied)
  if (!minDetails.length) return ''
  const rawTotal = minDetails.reduce((sum, detail) => sum + detail.rawRequiredLength, 0)
  return `
    <div class="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
      ${formatCount(minDetails.length)} 个捆条规格原算 ${escapeHtml(formatLength(rawTotal))}，不足 4m 已按 4m 起算。
    </div>
  `
}

function renderBadge(label: string, className = 'border-slate-200 bg-slate-50 text-slate-700'): string {
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderMetricCard(label: string, value: string, hint: string): string {
  return `
    <article class="rounded-lg border bg-background px-3 py-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(value)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(hint)}</div>
    </article>
  `
}

function renderListFilters(): string {
  return `
    <section class="rounded-lg border bg-card px-4 py-3" data-testid="cutting-binding-list-filters">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold text-foreground">筛选条件</h2>
        <button type="button" class="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-skip-page-rerender="true" data-cutting-binding-action="refresh">刷新列表</button>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-1 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">加工单 / 来源单</span>
          <input class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="捆条单 / 裁片单 / 菲票" value="${escapeHtml(bindingListFilters.keyword)}" data-binding-list-filter-field="keyword" />
        </label>
        <label class="space-y-1 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">加工状态</span>
          <select class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" data-binding-list-filter-field="status">
            ${['全部', '待加工', '加工中', '已完成', '已取消'].map((item) => `<option value="${escapeHtml(item)}"${bindingListFilters.status === item ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">菲票状态</span>
          <select class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" data-binding-list-filter-field="printStatus">
            ${['全部', '未生成', '待打印', '已打印'].map((item) => `<option value="${escapeHtml(item)}"${bindingListFilters.printStatus === item ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">物料 / 宽度</span>
          <input class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="物料 SKU / 捆条宽度" value="${escapeHtml(bindingListFilters.materialKeyword)}" data-binding-list-filter-field="materialKeyword" />
        </label>
        <label class="space-y-1 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">差异状态</span>
          <select class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" data-binding-list-filter-field="differenceStatus">
            ${['全部', '无差异', '有差异'].map((item) => `<option value="${escapeHtml(item)}"${bindingListFilters.differenceStatus === item ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" class="inline-flex min-h-10 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-cutting-binding-action="apply-list-filters">查询</button>
        <button type="button" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50" data-cutting-binding-action="reset-list-filters">重置</button>
      </div>
    </section>
  `
}

function applyBindingListFiltersFromDom(): void {
  const keyword = document.querySelector<HTMLInputElement>('[data-binding-list-filter-field="keyword"]')?.value || ''
  const status = document.querySelector<HTMLSelectElement>('[data-binding-list-filter-field="status"]')?.value || '全部'
  const printStatus = document.querySelector<HTMLSelectElement>('[data-binding-list-filter-field="printStatus"]')?.value || '全部'
  const materialKeyword = document.querySelector<HTMLInputElement>('[data-binding-list-filter-field="materialKeyword"]')?.value || ''
  const differenceStatus = document.querySelector<HTMLSelectElement>('[data-binding-list-filter-field="differenceStatus"]')?.value || '全部'
  bindingListFilters.keyword = keyword.trim()
  bindingListFilters.status = status as BindingListFilters['status']
  bindingListFilters.printStatus = printStatus as BindingListFilters['printStatus']
  bindingListFilters.materialKeyword = materialKeyword.trim()
  bindingListFilters.differenceStatus = differenceStatus as BindingListFilters['differenceStatus']
  bindingListPage = 1
}

function resetBindingListFilters(): void {
  bindingListFilters.keyword = ''
  bindingListFilters.status = '全部'
  bindingListFilters.printStatus = '全部'
  bindingListFilters.materialKeyword = ''
  bindingListFilters.differenceStatus = '全部'
  bindingListPage = 1
}

function filterBindingProcessOrders(rows: BindingProcessOrder[]): BindingProcessOrder[] {
  const keyword = bindingListFilters.keyword.toLowerCase()
  const materialKeyword = bindingListFilters.materialKeyword.toLowerCase()
  return rows.filter((row) => {
    if (bindingListFilters.status !== '全部' && row.status !== bindingListFilters.status) return false
    if (bindingListFilters.printStatus !== '全部' && row.printStatus !== bindingListFilters.printStatus) return false
    if (bindingListFilters.differenceStatus !== '全部' && row.differenceStatus !== bindingListFilters.differenceStatus) return false
    if (keyword) {
      const text = [
        row.bindingOrderNo,
        row.sourceProductionOrderNo,
        row.sourceCutOrderNo,
        row.sourceMarkerPlanNo,
        row.spuCode,
        row.styleName,
        row.sourceFeiTicketNos.join(' '),
      ].join(' ').toLowerCase()
      if (!text.includes(keyword)) return false
    }
    if (materialKeyword) {
      const text = [
        row.materialIdentity.materialSku,
        row.materialIdentity.materialName,
        row.materialIdentity.materialAlias,
        row.materialIdentity.materialColor,
        row.bindingDetails.map((item) => `${item.bindingWidth}cm`).join(' '),
      ].join(' ').toLowerCase()
      if (!text.includes(materialKeyword)) return false
    }
    return true
  })
}

function renderListStats(rows: BindingProcessOrder[]): string {
  const processingCount = rows.filter((row) => row.status === '加工中').length
  const doneCount = rows.filter((row) => row.status === '已完成').length
  const printPendingCount = rows.filter((row) => row.printStatus === '待打印').length
  const inboundDoneCount = rows.filter((row) => row.inboundStatus === '已入仓').length
  const differenceCount = rows.filter((row) => row.differenceStatus !== '无差异').length

  return renderCompactKpiGroup(`
    ${renderCompactKpiCard('加工单', rows.length, '当前筛选范围', 'text-slate-900')}
    ${renderCompactKpiCard('加工中', processingCount, '现场进行中', 'text-blue-600')}
    ${renderCompactKpiCard('已完成', doneCount, '加工结束', 'text-emerald-600')}
    ${renderCompactKpiCard('待打印菲票', printPendingCount, '捆条菲票待打印', 'text-amber-600')}
    ${renderCompactKpiCard('已入仓', inboundDoneCount, '加工后已入裁床仓', 'text-emerald-600')}
    ${renderCompactKpiCard('存在差异', differenceCount, '数量差异记录', 'text-rose-600')}
  `)
}

function renderSourceSummary(row: BindingProcessOrder): string {
  return `
    <div class="space-y-1 text-xs text-muted-foreground">
      <p><span class="text-foreground">生产单：</span>${escapeHtml(row.sourceProductionOrderNo)}</p>
      <p><span class="text-foreground">裁片单：</span>${escapeHtml(row.sourceCutOrderNo)}</p>
      <p><span class="text-foreground">唛架方案：</span>${escapeHtml(row.sourceMarkerPlanNo || '待确认后生成')}</p>
      <p><span class="text-foreground">接收状态：</span>${escapeHtml(row.materialReceiveStatus)}</p>
      <p><span class="text-foreground">货架位置：</span>${escapeHtml(row.materialShelfLocation || '待接收后回写')}</p>
    </div>
  `
}

function renderPatternSummary(row: BindingProcessOrder): string {
  return `
    <div class="space-y-1 text-xs text-muted-foreground">
      <p class="font-medium text-foreground">${escapeHtml(row.patternIdentity.patternFileName)}</p>
      <p>${escapeHtml(row.patternIdentity.patternVersion)} / 门幅 ${escapeHtml(`${row.doorWidthCm} cm`)}</p>
      <p>纸样包：${escapeHtml(row.sourcePatternPackageName || '纸样包待补')}</p>
      <p class="line-clamp-2">部位：${escapeHtml(row.patternIdentity.piecePartNames.slice(0, 4).join('、') || '部位待补')}</p>
    </div>
  `
}

function renderDetailChips(row: BindingProcessOrder): string {
  return row.bindingDetails
    .map((detail) => `
      <span class="inline-flex flex-col gap-0.5 rounded-md border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
        <span>${escapeHtml(`${detail.bindingWidth} cm`)} / ${escapeHtml(detail.cuttingMethod)} / ${escapeHtml(formatLength(detail.plannedBindingLength))}</span>
        <span class="text-[11px]">单件 ${escapeHtml(formatLength(detail.unitBindingLength))} × ${formatCount(detail.plannedGarmentQty)} 件</span>
        ${detail.minRequiredLengthApplied ? `<span class="text-[11px] text-amber-700">原算 ${escapeHtml(formatLength(detail.rawRequiredLength))}，4m 起算</span>` : ''}
      </span>
    `)
    .join('')
}

function renderProcessSummary(row: BindingProcessOrder): string {
  return `
    <div class="space-y-1 text-xs text-muted-foreground">
      <p><span class="text-foreground">规格数：</span>${formatCount(row.bindingSpecificationCount)} 种</p>
      <p><span class="text-foreground">捆条需要长度：</span>${escapeHtml(formatLength(row.plannedTotalLength))}</p>
      <p><span class="text-foreground">需要布料长度：</span>${escapeHtml(formatLength(row.requiredMaterialLength))}</p>
      <p><span class="text-foreground">接收布料长度：</span>${escapeHtml(formatRecordedLength(row.receivedMaterialLength))}</p>
      <p><span class="text-foreground">实际完成总长度：</span>${escapeHtml(formatRecordedLength(row.actualTotalLength))}</p>
      <p><span class="text-foreground">实切卷数：</span>${row.actualRollCount ? `${formatCount(row.actualRollCount)} 卷` : '待记录'}</p>
      <div class="flex flex-wrap gap-1">${renderBadge(row.sufficiencyStatus, sufficiencyToneMap[row.sufficiencyStatus])}</div>
      ${row.shortageLength > 0 ? `<p class="text-rose-700">缺口：${escapeHtml(formatLength(row.shortageLength))}</p>` : ''}
      ${renderOrderMinRequiredLengthNote(row)}
      <div class="mt-1 flex max-w-[18rem] flex-wrap gap-1">${renderDetailChips(row)}</div>
    </div>
  `
}

function renderFlowSummary(row: BindingProcessOrder): string {
  return `
    <div class="space-y-1 text-xs text-muted-foreground">
      <p>菲票：${escapeHtml(row.sourceFeiTicketNos.join(' / ') || '待生成')}</p>
      <div class="flex flex-wrap gap-1">
        ${renderBadge(row.printStatus, printToneMap[row.printStatus])}
        ${renderBadge(row.inboundStatus, inboundToneMap[row.inboundStatus])}
        ${renderBadge(row.handoverStatus, handoverToneMap[row.handoverStatus])}
      </div>
      <p>库存查询维度：物料 + 捆条宽度</p>
    </div>
  `
}

function renderDifferenceSummary(row: BindingProcessOrder): string {
  if (!row.differenceRecords.length) return renderBadge('无差异', differenceToneMap['无差异'])
  return `
    <div class="space-y-1">
      ${renderBadge('有差异', differenceToneMap['有差异'])}
      <p class="text-xs text-muted-foreground">${escapeHtml(row.differenceRecords.map((item) => `${item.differenceType} ${formatLength(item.differenceLength)}`).join('；'))}</p>
    </div>
  `
}

function buildBindingFeiTicketListHref(row: BindingProcessOrder): string {
  const params = new URLSearchParams({
    printObjectType: 'BINDING_STRIP_ORDER',
    keyword: row.bindingOrderNo,
  })
  return `/fcs/craft/cutting/binding-fei-tickets?${params.toString()}`
}

function renderOrderActions(row: BindingProcessOrder): string {
  const detailHref = `/fcs/craft/cutting/special-processes/${encodeURIComponent(row.bindingOrderId)}`
  const printHref = buildBindingFeiTicketListHref(row)
  const remainingReceiveQty = roundLength(row.bindingDetails.reduce(
    (sum, detail) => sum + Math.max(detail.requiredLength - detail.receivedMaterialLength, 0),
    0,
  ))
  const remainingProcessQty = roundLength(row.bindingDetails.reduce(
    (sum, detail) => sum + getBindingDetailAvailableProcessQty(detail),
    0,
  ))
  const remainingHandoverQty = roundLength(Math.max(row.actualOutputQty - (row.handedOverQty || 0), 0))
  const actionButton = (action: string, label: string, enabled: boolean, primary = false) => `
    <button type="button"
      class="inline-flex min-h-8 items-center rounded-md border px-2.5 text-xs font-medium ${enabled
        ? primary
          ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'}"
      data-skip-page-rerender="true"
      data-cutting-binding-action="${action}"
      data-row-id="${escapeHtml(row.bindingOrderId)}"
      ${enabled ? '' : 'disabled'}>${label}</button>
  `
  return `
    <div class="flex min-w-[18rem] flex-wrap gap-1.5">
      <a href="${escapeHtml(detailHref)}" data-nav="${escapeHtml(detailHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">查看</a>
      ${actionButton('confirm-receive', '确认接收', row.status !== '已完成' && row.status !== '已取消' && remainingReceiveQty > 0, row.status === '待加工')}
      ${actionButton('process-report', '加工填报', row.status === '加工中' && remainingProcessQty > 0)}
      ${actionButton('submit-handover', '发起交出', (row.status === '加工中' || row.status === '已完成') && remainingHandoverQty > 0)}
      ${actionButton('complete-order', '完成加工单', row.status === '加工中' && row.actualOutputQty > 0)}
      <a href="${escapeHtml(printHref)}" data-nav="${escapeHtml(printHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">打印菲票</a>
    </div>
  `
}

const bindingListColumns: StandardListColumn<BindingProcessOrder>[] = [
  {
    key: 'workOrder',
    title: '加工单',
    width: 210,
    required: true,
    freezeable: true,
    render: (row) => `
      <div>
        <a href="/fcs/craft/cutting/special-processes/${encodeURIComponent(row.bindingOrderId)}" data-nav="/fcs/craft/cutting/special-processes/${encodeURIComponent(row.bindingOrderId)}" class="font-medium text-blue-600 hover:underline">${escapeHtml(row.bindingOrderNo)}</a>
        <div class="mt-2 flex flex-wrap gap-1.5">
          ${renderBadge(row.status, statusToneMap[row.status])}
          ${renderBadge(row.sufficiencyStatus, sufficiencyToneMap[row.sufficiencyStatus])}
          ${renderBadge(row.differenceStatus, differenceToneMap[row.differenceStatus])}
        </div>
      </div>`,
  },
  { key: 'source', title: '来源对象', width: 230, render: renderSourceSummary },
  {
    key: 'material',
    title: '物料',
    width: 230,
    required: true,
    render: (row) => `
      <div>
        ${renderMaterialIdentityBlock(
          {
            materialSku: row.materialIdentity.materialSku,
            materialLabel: row.materialIdentity.materialName,
            materialAlias: row.materialIdentity.materialAlias,
            materialImageUrl: row.materialIdentity.materialImageUrl,
          },
          { compact: true, imageSizeClass: 'h-9 w-9' },
        )}
        <p class="mt-1 text-xs text-muted-foreground">颜色：${escapeHtml(row.materialIdentity.materialColor)}</p>
      </div>
    `,
  },
  { key: 'pattern', title: '纸样', width: 230, render: renderPatternSummary },
  { key: 'details', title: '捆条明细', width: 310, render: renderProcessSummary },
  { key: 'flow', title: '菲票 / 入仓 / 交出', width: 240, render: renderFlowSummary },
  { key: 'difference', title: '差异', width: 180, render: renderDifferenceSummary },
  { key: 'actions', title: '操作', width: 210, required: true, actionColumn: true, render: renderOrderActions },
]

function bindingListPreferences(): StandardListColumnPreferences {
  return {
    order: bindingListColumns.filter((column) => !column.actionColumn).map((column) => column.key),
    visibleKeys: bindingListColumns.map((column) => column.key),
    frozenKeys: ['workOrder'],
    pageSize: bindingListPageSize,
  }
}

export function renderCraftCuttingSpecialProcessesPage(): string {
  const rows = filterBindingProcessOrders(buildBindingProcessOrders())
  const meta = getCanonicalCuttingMeta('/fcs/craft/cutting/special-processes', 'special-processes')
  const totalPages = Math.max(1, Math.ceil(rows.length / bindingListPageSize))
  bindingListPage = Math.min(Math.max(1, bindingListPage), totalPages)
  const fromIndex = (bindingListPage - 1) * bindingListPageSize
  const pageRows = rows.slice(fromIndex, fromIndex + bindingListPageSize)
  return renderStandardListPage({
    title: meta.pageTitle,
    feedbackHtml: `<p class="text-sm text-muted-foreground">${escapeHtml(meta.shortDescription || meta.pageSubtitle || '')}</p><p class="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">只展示我方内部加工对象；裁剪+车缝+烫包合并任务内的辅助工艺、特种工艺不生成我方加工单。</p>`,
    primaryActionsHtml: `<div class="flex flex-wrap gap-2"><a href="/fcs/craft/cutting/binding-fei-tickets" data-nav="/fcs/craft/cutting/binding-fei-tickets" class="inline-flex min-h-10 items-center rounded-md border bg-white px-3 text-sm font-medium">打印捆条菲票</a><a href="/fcs/craft/cutting/warehouse-management/wait-handover?inventoryType=binding" data-nav="/fcs/craft/cutting/warehouse-management/wait-handover?inventoryType=binding" class="inline-flex min-h-10 items-center rounded-md border bg-white px-3 text-sm font-medium">查捆条库存</a><button type="button" class="inline-flex min-h-10 items-center rounded-md border bg-white px-3 text-sm font-medium" data-skip-page-rerender="true" data-cutting-binding-action="refresh">刷新</button></div>`,
    filtersHtml: renderListFilters(),
    statsHtml: renderListStats(rows),
    listTitle: '捆条加工单',
    listActionsHtml: `<span class="text-xs text-muted-foreground">共 ${formatCount(rows.length)} 条加工单</span>`,
    tableHtml: renderStandardListTable({
      columns: bindingListColumns,
      rows: pageRows,
      preferences: bindingListPreferences(),
      sort: null,
      eventPrefix: 'cutting-binding',
      emptyText: '当前筛选范围内暂无捆条加工单',
    }),
    paginationHtml: renderTablePagination({
      total: rows.length,
      from: rows.length ? fromIndex + 1 : 0,
      to: Math.min(fromIndex + bindingListPageSize, rows.length),
      currentPage: bindingListPage,
      totalPages,
      pageSize: bindingListPageSize,
      actionPrefix: 'cutting-binding',
      pageSizeOptions: [10, 20, 50],
    }),
  })
}

function renderDetailMetric(label: string, value: string): string {
  return `
    <article class="rounded-lg border bg-muted/20 p-3">
      <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-1 font-medium text-foreground">${escapeHtml(value)}</p>
    </article>
  `
}

function renderDetailSection(title: string, body: string): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="text-base font-semibold text-foreground">${escapeHtml(title)}</h2>
      <div class="mt-3">${body}</div>
    </section>
  `
}

function renderDetailRows(details: BindingStripWorkOrderDetail[]): string {
  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[1320px] text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">规格</th>
            <th class="px-3 py-3">切割方式</th>
            <th class="px-3 py-3">公式</th>
            <th class="px-3 py-3">计划 / 布料</th>
            <th class="px-3 py-3">实际记录</th>
            <th class="px-3 py-3">菲票</th>
            <th class="px-3 py-3">流转</th>
            <th class="px-3 py-3">结果</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${details.map((detail) => `
            <tr>
              <td class="px-3 py-3">
                <div class="font-medium text-foreground">${escapeHtml(detail.bindingStripName)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${detail.bindingWidth} cm / ${detail.bindingStripNo}`)}</div>
              </td>
              <td class="px-3 py-3 text-xs text-muted-foreground">
                <div class="font-medium text-foreground">${escapeHtml(detail.cuttingMethod)}</div>
                <div class="mt-1">${escapeHtml(detail.cuttingMethodIndonesian)}</div>
              </td>
              <td class="px-3 py-3 text-xs text-muted-foreground">
                <div>${escapeHtml(detail.formulaText)}</div>
                <div class="mt-1">${renderMinRequiredLengthNote(detail)}</div>
              </td>
              <td class="px-3 py-3 text-xs text-muted-foreground">
                <div>计划数量：${formatCount(detail.plannedGarmentQty)} 件</div>
                <div>单件捆条：${escapeHtml(formatLength(detail.unitBindingLength))}</div>
                <div>捆条需要长度：${escapeHtml(formatLength(detail.plannedBindingLength))}</div>
                <div>需要布料长度：${escapeHtml(formatLength(detail.requiredLength))}</div>
                <div>接收布料长度：${escapeHtml(formatRecordedLength(detail.receivedMaterialLength))}</div>
              </td>
              <td class="px-3 py-3 text-xs text-muted-foreground">
                <div>实际完成总长度：${escapeHtml(formatRecordedLength(detail.actualLength))}</div>
                <div>${escapeHtml(formatRollLength(detail))}</div>
                <div>${escapeHtml(formatCuttingMethodLength(detail))}</div>
                <div class="text-[11px]">切割长度 = 每卷长度 × 实切卷数</div>
                <div>实切卷数：${detail.actualRollCount ? `${formatCount(detail.actualRollCount)} 卷` : '待记录'}</div>
                <div>记录时间：${escapeHtml(detail.latestRecordedAt || '待记录')}</div>
              </td>
              <td class="px-3 py-3">
                <div class="font-medium text-blue-600">${escapeHtml(detail.feiTicketNo)}</div>
                <div class="mt-1">${renderBadge(detail.printStatus, printToneMap[detail.printStatus])}</div>
              </td>
              <td class="px-3 py-3">
                <div class="flex flex-wrap gap-1">
                  ${renderBadge(detail.inboundStatus, inboundToneMap[detail.inboundStatus])}
                  ${renderBadge(detail.handoverStatus, handoverToneMap[detail.handoverStatus])}
                </div>
              </td>
              <td class="px-3 py-3">
                <div class="flex flex-wrap gap-1">
                  ${renderBadge(detail.sufficiencyStatus, sufficiencyToneMap[detail.sufficiencyStatus])}
                  ${renderBadge(detail.differenceStatus, differenceToneMap[detail.differenceStatus])}
                </div>
                ${detail.shortageLength > 0 ? `<div class="mt-1 text-xs text-rose-700">缺口：${escapeHtml(formatLength(detail.shortageLength))}</div>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderCuttingRecords(row: BindingProcessOrder): string {
  if (!row.cuttingRecords.length) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">尚未记录本次裁剪，当前为待加工。</div>'
  }
  return `
    <div class="grid gap-3 md:grid-cols-2">
      ${row.cuttingRecords.map((record) => `
        <article class="rounded-lg border bg-background p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-sm font-medium text-foreground">${escapeHtml(`${record.bindingWidth} cm / ${record.cuttingMethod} / ${formatLength(record.actualLength)}`)}</div>
            <div class="text-xs text-muted-foreground">${escapeHtml(record.operatedAt)}</div>
          </div>
          <div class="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
            <div>接收布料：${escapeHtml(formatLength(record.receivedMaterialLength))}</div>
            <div>${escapeHtml(formatRollLength(record))}</div>
            <div>实切卷数：${formatCount(record.actualRollCount)} 卷</div>
            <div>${escapeHtml(formatCuttingMethodLength(record))}</div>
            <div>公式：切割长度 = 每卷长度 × 实切卷数</div>
            <div>操作人：${escapeHtml(record.operatorName)}</div>
          </div>
          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(record.remark || '无备注')}</div>
        </article>
      `).join('')}
    </div>
  `
}

function renderDifferenceRecords(row: BindingProcessOrder): string {
  if (!row.differenceRecords.length) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">当前加工单暂无差异记录。</div>'
  }
  return `
    <div class="grid gap-3 md:grid-cols-2">
      ${row.differenceRecords.map((record) => `
        <article class="rounded-lg border bg-background p-3">
          <div class="flex flex-wrap items-center gap-2">
            ${renderBadge(record.differenceType, 'border-rose-200 bg-rose-50 text-rose-700')}
            <span class="text-xs text-muted-foreground">${escapeHtml(record.recordedAt)}</span>
          </div>
          <div class="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
            <div>计划：${escapeHtml(formatLength(record.plannedLength))}</div>
            <div>实际：${escapeHtml(formatLength(record.actualLength))}</div>
            <div>差异：${escapeHtml(formatLength(record.differenceLength))}</div>
          </div>
          <p class="mt-2 text-sm text-foreground">${escapeHtml(record.reason)}</p>
        </article>
      `).join('')}
    </div>
  `
}

export function renderCraftCuttingSpecialProcessDetailPage(bindingOrderId?: string): string {
  const row = getBindingProcessOrderById(bindingOrderId)
  const backHref = '/fcs/craft/cutting/special-processes'
  if (!row) {
    return `
      <section class="space-y-5 p-6">
        <a href="${backHref}" data-nav="${backHref}" class="text-sm text-blue-700 hover:underline">返回捆条加工单</a>
        <div class="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">未找到捆条加工单。</div>
      </section>
    `
  }

  return `
    <section class="space-y-5 p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <a href="${backHref}" data-nav="${backHref}" class="text-sm text-blue-700 hover:underline">返回捆条加工单</a>
          <h1 class="mt-2 text-2xl font-semibold text-foreground">捆条加工单详情</h1>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(row.bindingOrderNo)} · ${escapeHtml(row.sourceCutOrderNo)} · 不关联具体铺布单</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${renderBadge(row.status, statusToneMap[row.status])}
          ${renderBadge(row.printStatus, printToneMap[row.printStatus])}
          ${renderBadge(row.inboundStatus, inboundToneMap[row.inboundStatus])}
          ${renderBadge(row.handoverStatus, handoverToneMap[row.handoverStatus])}
        </div>
      </div>

      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderMetricCard('捆条需要长度', formatLength(row.plannedTotalLength), '计划数量 × 单件捆条长度')}
        ${renderMetricCard('需要 / 接收布料', `${formatLength(row.requiredMaterialLength)} / ${formatRecordedLength(row.receivedMaterialLength)}`, '接收布料由裁床记录回写')}
        ${renderMetricCard('实际完成总长度', formatRecordedLength(row.actualTotalLength), '按各规格唯一切割方式累计')}
        ${renderMetricCard('结果判断', row.sufficiencyStatus, row.shortageLength > 0 ? `缺口 ${formatLength(row.shortageLength)}` : '按实际完成长度判断')}
      </section>

      ${renderDetailSection(
        '来源对象',
        `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderDetailMetric('加工单 ID', row.bindingOrderId)}
          ${renderDetailMetric('来源任务 ID', row.sourceTaskId)}
          ${renderDetailMetric('来源生产单', row.sourceProductionOrderNo)}
          ${renderDetailMetric('来源裁片单', row.sourceCutOrderNo)}
          ${renderDetailMetric('来源唛架方案', row.sourceMarkerPlanNo || '待确认后生成')}
          ${renderDetailMetric('是否接收', row.materialReceiveStatus)}
          ${renderDetailMetric('货架位置', row.materialShelfLocation || '待接收后回写')}
        </div>`,
      )}

      ${renderDetailSection(
        '物料与纸样',
        `<div class="grid gap-4 xl:grid-cols-2">
          <div>
            ${renderMaterialIdentityBlock(
              {
                materialSku: row.materialIdentity.materialSku,
                materialLabel: row.materialIdentity.materialName,
                materialAlias: row.materialIdentity.materialAlias,
                materialImageUrl: row.materialIdentity.materialImageUrl,
              },
              { compact: true, imageSizeClass: 'h-10 w-10' },
            )}
            <p class="mt-2 text-xs text-muted-foreground">颜色：${escapeHtml(row.materialIdentity.materialColor)} / 单位：${escapeHtml(row.materialIdentity.materialUnit)}</p>
            <p class="mt-1 text-xs text-muted-foreground">布料图片与物料 SKU 用于裁床确认是否领对布。</p>
          </div>
          <div class="text-sm text-muted-foreground">
            <p class="font-medium text-foreground">${escapeHtml(row.patternIdentity.patternFileName)}</p>
            <p class="mt-1">${escapeHtml(row.patternIdentity.patternVersion)} / 门幅 ${escapeHtml(`${row.doorWidthCm} cm`)}</p>
            <p class="mt-1">纸样包：${escapeHtml(row.sourcePatternPackageName || '纸样包待补')}</p>
            <p class="mt-1">部位集合：${escapeHtml(row.patternIdentity.piecePartNames.join('、') || '部位待补')}</p>
          </div>
        </div>`,
      )}

      ${renderDetailSection('捆条明细', renderDetailRows(row.bindingDetails))}
      ${renderDetailSection(
        '加工单操作',
        `<div class="space-y-2">
          <p class="text-sm text-muted-foreground">所有操作只写入当前捆条加工单；来源任务 ID 仅在基本信息中追溯。</p>
          ${renderOrderActions(row)}
        </div>`,
      )}
      ${renderDetailSection('分批裁剪记录', renderCuttingRecords(row))}
      ${renderDetailSection('差异记录', renderDifferenceRecords(row))}
      ${renderDetailSection(
        '菲票 / 入仓 / 装袋交出',
        `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderDetailMetric('捆条菲票', row.sourceFeiTicketNos.join(' / ') || '待生成')}
          ${renderDetailMetric('入仓状态', row.inboundStatus)}
          ${renderDetailMetric('交出状态', row.handoverStatus)}
          ${renderDetailMetric('库存查询', `${row.materialIdentity.materialSku} + ${row.bindingDetails.map((detail) => `${detail.bindingWidth}cm`).join(' / ')}`)}
        </div>`,
      )}
    </section>
  `
}

export function renderBindingStripRequirementPrompt(summary: BindingStripRequirementSummary): string {
  if (!summary.lines.length) return ''
  return `
    <section class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900" data-testid="binding-strip-spreading-confirmation">
      <div class="font-medium">该物料有捆条加工单，生成铺布单前请确认捆条明细。</div>
      <div class="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        ${summary.widthSummaries.map((item) => `
          <div class="rounded-md border border-amber-200 bg-white/80 px-2 py-2 text-xs">
            <div class="font-medium text-foreground">${escapeHtml(item.materialSku)} / ${escapeHtml(`${item.bindingWidthCm} cm`)}</div>
            ${item.minRequiredLengthApplied ? `<div class="mt-1 text-amber-700">原算 ${escapeHtml(formatLength(item.rawRequiredLengthM))}，不足 4m 按 4m</div>` : ''}
            <div class="mt-1 text-muted-foreground">总长度 ${escapeHtml(formatLength(item.requiredLengthM))}</div>
            <div class="mt-1 text-muted-foreground">菲票 ${escapeHtml(item.ticketNos.join(' / ') || '待打印')}</div>
          </div>
        `).join('')}
      </div>
      <div class="mt-2 text-xs text-amber-800">铺布单不分摊捆条长度；捆条加工单独执行确认接收、加工填报、发起交出和完成加工单；不足 4m 的捆条明细已按 4m 起算。</div>
    </section>
  `
}

function showBindingToast(message: string): void {
  const rootId = 'cutting-binding-toast-root'
  let root = document.getElementById(rootId)
  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'fixed right-6 top-20 z-50 flex flex-col gap-2'
    document.body.appendChild(root)
  }
  const toast = document.createElement('div')
  toast.className = 'rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-lg'
  toast.textContent = message
  root.appendChild(toast)
  window.setTimeout(() => {
    toast.remove()
    if (root && root.childElementCount === 0) root.remove()
  }, 1800)
}

function removeBindingActionModal(): void {
  document.getElementById(BINDING_ACTION_MODAL_ID)?.remove()
}

const bindingActionMeta: Record<BindingProcessActionCode, { title: string; help: string; requiresQty: boolean; requiresDetail: boolean }> = {
  BINDING_CONFIRM_RECEIVE: {
    title: '确认接收',
    help: '选择实际收到的捆条规格并填写本次数量；可以分批确认，不能超过该规格剩余应收。',
    requiresQty: true,
    requiresDetail: true,
  },
  BINDING_PROCESS_REPORT: {
    title: '加工填报',
    help: '选择本次加工的捆条规格并填写实际完成长度；不能超过已接收可用量和剩余计划量。',
    requiresQty: true,
    requiresDetail: true,
  },
  BINDING_SUBMIT_HANDOVER: {
    title: '发起交出',
    help: '填写本次实际交出的捆条长度；允许分批交出，不能超过当前已加工未交出数量。',
    requiresQty: true,
    requiresDetail: false,
  },
  BINDING_COMPLETE_ORDER: {
    title: '完成加工单',
    help: '已有加工填报即可完成加工单；剩余已加工数量仍可在完成后分批交出。存在短裁时必须填写差异原因。',
    requiresQty: false,
    requiresDetail: false,
  },
}

function getBindingActionAvailableQty(row: BindingProcessOrder, actionCode: BindingProcessActionCode, detailId?: string): number {
  const detail = row.bindingDetails.find((item) => item.detailId === detailId) || row.bindingDetails[0]
  if (actionCode === 'BINDING_CONFIRM_RECEIVE' && detail) {
    return roundLength(Math.max(detail.requiredLength - detail.receivedMaterialLength, 0))
  }
  if (actionCode === 'BINDING_PROCESS_REPORT' && detail) {
    return getBindingDetailAvailableProcessQty(detail)
  }
  if (actionCode === 'BINDING_SUBMIT_HANDOVER') {
    return roundLength(Math.max(row.actualOutputQty - (row.handedOverQty || 0), 0))
  }
  return 0
}

function renderBindingWorkOrderActionDialog(row: BindingProcessOrder, actionCode: BindingProcessActionCode): string {
  const meta = bindingActionMeta[actionCode]
  const detailOptions = row.bindingDetails.map((detail) => {
    const available = getBindingActionAvailableQty(row, actionCode, detail.detailId)
    return `<option value="${escapeHtml(detail.detailId)}" ${available <= 0 ? 'disabled' : ''}>${escapeHtml(detail.bindingStripName)} · ${escapeHtml(detail.feiTicketNo)} · 可操作 ${available.toFixed(2)} 米</option>`
  }).join('')
  const firstDetail = row.bindingDetails.find((detail) => getBindingActionAvailableQty(row, actionCode, detail.detailId) > 0)
  const availableQty = getBindingActionAvailableQty(row, actionCode, firstDetail?.detailId)
  const confirmationKey = `WEB-BIND-${row.bindingOrderId}-${actionCode}-${Date.now()}`
  const shortDifference = row.actualOutputQty < row.plannedOutputQty
  return `
    <div class="fixed inset-0 z-[130]" id="${BINDING_ACTION_MODAL_ID}"
      data-binding-order-id="${escapeHtml(row.bindingOrderId)}"
      data-binding-action-code="${actionCode}"
      data-binding-confirmation-key="${escapeHtml(confirmationKey)}">
      <button type="button" class="absolute inset-0 bg-black/45" data-skip-page-rerender="true" data-cutting-binding-action="close-overlay" aria-label="关闭弹窗"></button>
      <div class="absolute inset-x-4 top-12 mx-auto max-w-xl rounded-xl border bg-background shadow-xl">
        <div class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold text-foreground">${meta.title}</h2>
            <p class="mt-1 text-sm text-muted-foreground">加工单 ${escapeHtml(row.bindingOrderNo)}</p>
          </div>
          <button type="button" class="rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cutting-binding-action="close-overlay">关闭</button>
        </div>
        <div class="space-y-4 px-5 py-4">
          <div class="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">${meta.help}</div>
          <div class="grid gap-3 sm:grid-cols-3">
            ${renderDetailMetric('计划产出', formatLength(row.plannedOutputQty))}
            ${renderDetailMetric('已加工', formatLength(row.actualOutputQty))}
            ${renderDetailMetric('已交出', formatLength(row.handedOverQty || 0))}
          </div>
          ${meta.requiresDetail ? `
            <label class="block space-y-1 text-sm">
              <span class="font-medium text-foreground">捆条规格</span>
              <select data-binding-action-detail class="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-500">${detailOptions}</select>
            </label>
          ` : ''}
          ${meta.requiresQty ? `
            <label class="block space-y-1 text-sm">
              <span class="font-medium text-foreground">本次数量（米）</span>
              <input data-binding-action-qty type="number" min="0.01" step="0.01" value="${availableQty.toFixed(2)}" class="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-500" />
            </label>
          ` : ''}
          <label class="block space-y-1 text-sm">
            <span class="font-medium text-foreground">备注${actionCode === 'BINDING_COMPLETE_ORDER' && shortDifference ? '（短裁必填）' : '（选填）'}</span>
            <textarea data-binding-action-remark class="min-h-20 w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500" placeholder="${actionCode === 'BINDING_COMPLETE_ORDER' && shortDifference ? '填写短裁差异原因' : '填写本次操作说明'}"></textarea>
          </label>
        </div>
        <div class="flex justify-end gap-2 border-t px-5 py-4">
          <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cutting-binding-action="close-overlay">取消</button>
          <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-skip-page-rerender="true" data-cutting-binding-action="submit-work-order-action">确认${meta.title}</button>
        </div>
      </div>
    </div>
  `
}

function openBindingActionModal(row: BindingProcessOrder, actionCode: BindingProcessActionCode): void {
  removeBindingActionModal()
  const wrapper = document.createElement('div')
  wrapper.innerHTML = renderBindingWorkOrderActionDialog(row, actionCode)
  const modal = wrapper.firstElementChild
  if (modal) {
    modal.addEventListener('click', (event) => {
      const eventTarget = event.target
      if (!(eventTarget instanceof HTMLElement)) return
      if (!eventTarget.closest('[data-cutting-binding-action]')) return
      event.preventDefault()
      event.stopPropagation()
      handleCraftCuttingSpecialProcessesEvent(eventTarget)
    })
    document.body.appendChild(modal)
  }
}

export function handleCraftCuttingSpecialProcessesEvent(target: HTMLElement): boolean {
  const pageSizeField = target.closest<HTMLSelectElement>('[data-cutting-binding-field="pageSize"]')
  if (pageSizeField) {
    const pageSize = Number(pageSizeField.value)
    if ([10, 20, 50].includes(pageSize)) bindingListPageSize = pageSize
    bindingListPage = 1
    return true
  }

  const button = target.closest<HTMLElement>('[data-cutting-binding-action]')
  if (!button) return false

  const action = button.dataset.cuttingBindingAction
  if (action === 'close-overlay') {
    removeBindingActionModal()
    return true
  }
  if (action === 'submit-work-order-action') {
    const modal = document.getElementById(BINDING_ACTION_MODAL_ID)
    const bindingOrderId = modal?.dataset.bindingOrderId || ''
    const actionCode = modal?.dataset.bindingActionCode as BindingProcessActionCode | undefined
    const confirmationKey = modal?.dataset.bindingConfirmationKey || ''
    const qtyField = modal?.querySelector<HTMLInputElement>('[data-binding-action-qty]')
    const detailField = modal?.querySelector<HTMLSelectElement>('[data-binding-action-detail]')
    const remarkField = modal?.querySelector<HTMLTextAreaElement>('[data-binding-action-remark]')
    if (!bindingOrderId || !actionCode) {
      showBindingToast('加工单动作信息缺失，请关闭后重新操作')
      return true
    }
    try {
      executeBindingProcessActionWithWarehouse({
        bindingOrderId,
        actionCode,
        qty: qtyField ? Number(qtyField.value) : undefined,
        detailId: detailField?.value,
        confirmationKey,
        operatorName: 'Web 操作员',
        operatedAt: new Date().toLocaleString('zh-CN', { hour12: false }).replaceAll('/', '-'),
        remark: remarkField?.value,
      })
      const actionLabel = bindingActionMeta[actionCode].title
      removeBindingActionModal()
      showBindingToast(`${actionLabel}已写入具体捆条加工单`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (error) {
      showBindingToast(error instanceof Error ? error.message : '加工单操作失败，请重试')
    }
    return true
  }
  if (action === 'refresh') {
    showBindingToast('捆条加工单已刷新')
    return true
  }
  if (action === 'apply-list-filters') {
    applyBindingListFiltersFromDom()
    return true
  }
  if (action === 'reset-list-filters') {
    resetBindingListFilters()
    return true
  }
  if (action === 'prev-page') {
    bindingListPage = Math.max(1, bindingListPage - 1)
    return true
  }
  if (action === 'next-page') {
    bindingListPage += 1
    return true
  }
  const bindingActionCodeMap: Partial<Record<string, BindingProcessActionCode>> = {
    'confirm-receive': 'BINDING_CONFIRM_RECEIVE',
    'process-report': 'BINDING_PROCESS_REPORT',
    'submit-handover': 'BINDING_SUBMIT_HANDOVER',
    'complete-order': 'BINDING_COMPLETE_ORDER',
  }
  const bindingActionCode = action ? bindingActionCodeMap[action] : undefined
  if (bindingActionCode) {
    const row = getBindingProcessOrderById(button.dataset.rowId)
    if (row) openBindingActionModal(row, bindingActionCode)
    else showBindingToast('未找到对应捆条加工单')
    return true
  }
  return false
}

export function isCraftCuttingSpecialProcessesDialogOpen(): boolean {
  return Boolean(document.getElementById(BINDING_ACTION_MODAL_ID))
}
