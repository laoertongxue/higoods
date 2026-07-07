import { escapeHtml } from '../../../utils.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import { getCanonicalCuttingMeta, renderCuttingPageHeader } from './meta.ts'
import { renderCompactKpiCard, renderCompactKpiGroup } from './layout.helpers.ts'
import {
  buildBindingProcessOrders as buildProjectedBindingProcessOrders,
  getBindingProcessOrderById,
  type BindingStripRequirementSummary,
} from './binding-strip-orders.ts'
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
}

function resetBindingListFilters(): void {
  bindingListFilters.keyword = ''
  bindingListFilters.status = '全部'
  bindingListFilters.printStatus = '全部'
  bindingListFilters.materialKeyword = ''
  bindingListFilters.differenceStatus = '全部'
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
      <p><span class="text-foreground">领料状态：</span>${escapeHtml(row.materialReceiveStatus)}</p>
      <p><span class="text-foreground">货架位置：</span>${escapeHtml(row.materialShelfLocation || '待领料后回写')}</p>
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
  return `
    <div class="flex min-w-[10rem] flex-wrap gap-1.5">
      <a href="${escapeHtml(detailHref)}" data-nav="${escapeHtml(detailHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">查看</a>
      <button type="button" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50" data-skip-page-rerender="true" data-cutting-binding-action="record-cutting" data-row-id="${escapeHtml(row.bindingOrderId)}">记录裁剪</button>
      <button type="button" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50" data-skip-page-rerender="true" data-cutting-binding-action="finish" data-row-id="${escapeHtml(row.bindingOrderId)}">结束加工</button>
      <button type="button" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700" data-nav="${escapeHtml(printHref)}">打印菲票</button>
    </div>
  `
}

function renderOrderTableRow(row: BindingProcessOrder): string {
  return `
    <tr class="hover:bg-muted/20">
      <td class="px-4 py-3 align-top">
        <a href="/fcs/craft/cutting/special-processes/${encodeURIComponent(row.bindingOrderId)}" data-nav="/fcs/craft/cutting/special-processes/${encodeURIComponent(row.bindingOrderId)}" class="font-medium text-blue-600 hover:underline">${escapeHtml(row.bindingOrderNo)}</a>
        <div class="mt-2 flex flex-wrap gap-1.5">
          ${renderBadge(row.status, statusToneMap[row.status])}
          ${renderBadge(row.sufficiencyStatus, sufficiencyToneMap[row.sufficiencyStatus])}
          ${renderBadge(row.differenceStatus, differenceToneMap[row.differenceStatus])}
        </div>
      </td>
      <td class="px-4 py-3 align-top">${renderSourceSummary(row)}</td>
      <td class="px-4 py-3 align-top">
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
      </td>
      <td class="px-4 py-3 align-top">${renderPatternSummary(row)}</td>
      <td class="px-4 py-3 align-top">${renderProcessSummary(row)}</td>
      <td class="px-4 py-3 align-top">${renderFlowSummary(row)}</td>
      <td class="px-4 py-3 align-top">${renderDifferenceSummary(row)}</td>
      <td class="px-4 py-3 align-top">${renderOrderActions(row)}</td>
    </tr>
  `
}

function renderOrderTable(rows: BindingProcessOrder[]): string {
  if (!rows.length) {
    return '<section class="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">当前筛选范围内暂无捆条加工单。</section>'
  }

  return `
    <section class="rounded-lg border bg-card" data-testid="cutting-binding-list-table">
      <div class="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 class="text-sm font-semibold">捆条加工单</h2>
        <div class="text-xs text-muted-foreground">共 ${formatCount(rows.length)} 条加工单</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1480px] text-sm">
          <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
            <tr>
              <th class="px-4 py-3 text-left font-medium">加工单</th>
              <th class="px-4 py-3 text-left font-medium">来源对象</th>
              <th class="px-4 py-3 text-left font-medium">物料</th>
              <th class="px-4 py-3 text-left font-medium">纸样</th>
              <th class="px-4 py-3 text-left font-medium">捆条明细</th>
              <th class="px-4 py-3 text-left font-medium">菲票 / 入仓 / 交出</th>
              <th class="px-4 py-3 text-left font-medium">差异</th>
              <th class="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${rows.map(renderOrderTableRow).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

export function renderCraftCuttingSpecialProcessesPage(): string {
  const rows = filterBindingProcessOrders(buildBindingProcessOrders())
  const meta = getCanonicalCuttingMeta('/fcs/craft/cutting/special-processes', 'special-processes')

  return `
    <section class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: `
          <div class="flex flex-wrap gap-2">
            <a href="/fcs/craft/cutting/binding-fei-tickets" data-nav="/fcs/craft/cutting/binding-fei-tickets" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">打印捆条菲票</a>
            <a href="/fcs/craft/cutting/warehouse-management/wait-handover?inventoryType=binding" data-nav="/fcs/craft/cutting/warehouse-management/wait-handover?inventoryType=binding" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">查捆条库存</a>
            <button type="button" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50" data-skip-page-rerender="true" data-cutting-binding-action="refresh">刷新</button>
          </div>
        `,
      })}
      <p class="mt-1 text-sm text-muted-foreground">只展示我方内部加工对象；三方连续任务内部工艺不生成我方加工单。</p>
      ${renderListFilters()}
      ${renderListStats(rows)}
      ${renderOrderTable(rows)}
    </section>
  `
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
          ${renderDetailMetric('来源生产单', row.sourceProductionOrderNo)}
          ${renderDetailMetric('来源裁片单', row.sourceCutOrderNo)}
          ${renderDetailMetric('来源唛架方案', row.sourceMarkerPlanNo || '待确认后生成')}
          ${renderDetailMetric('是否领料', row.materialReceiveStatus)}
          ${renderDetailMetric('货架位置', row.materialShelfLocation || '待领料后回写')}
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
      <div class="mt-2 text-xs text-amber-800">铺布单不分摊捆条长度；捆条加工单独记录裁剪、入仓暂存和装袋交出；不足 4m 的捆条明细已按 4m 起算。</div>
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

function renderRecordCuttingDialog(row: BindingProcessOrder): string {
  return `
    <div class="fixed inset-0 z-[130]" id="${BINDING_ACTION_MODAL_ID}" data-cutting-binding-dialog="record-cutting">
      <button type="button" class="absolute inset-0 bg-black/45" data-skip-page-rerender="true" data-cutting-binding-action="close-overlay" aria-label="关闭弹窗"></button>
      <div class="absolute inset-x-4 top-10 mx-auto max-w-6xl rounded-xl border bg-background shadow-xl">
        <div class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold text-foreground">记录裁剪</h2>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(row.bindingOrderNo)} · 按捆条规格记录接收布料、每卷长度和实切卷数，切割长度自动计算</p>
          </div>
          <button type="button" class="rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cutting-binding-action="close-overlay">关闭</button>
        </div>
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          <div class="grid gap-3 md:grid-cols-4">
            ${renderDetailMetric('来源裁片单', row.sourceCutOrderNo)}
            ${renderDetailMetric('货架位置', row.materialShelfLocation || '待领料后回写')}
            ${renderDetailMetric('捆条需要长度', formatLength(row.plannedTotalLength))}
            ${renderDetailMetric('需要布料长度', formatLength(row.requiredMaterialLength))}
          </div>
          <div class="mt-4 overflow-x-auto rounded-lg border">
            <table class="w-full min-w-[1160px] text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-3">捆条规格</th>
                  <th class="px-3 py-3">切割方式</th>
                  <th class="px-3 py-3">计划数据</th>
                  <th class="px-3 py-3">接收布料长度</th>
                  <th class="px-3 py-3">每卷长度</th>
                  <th class="px-3 py-3">实切卷数</th>
                  <th class="px-3 py-3">切割长度</th>
                  <th class="px-3 py-3">记录时间</th>
                  <th class="px-3 py-3">操作员工</th>
                  <th class="px-3 py-3">备注</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                ${row.bindingDetails.map((detail) => {
                  const rollCount = detail.actualRollCount || estimateDisplayedRollCount(detail.actualLength || detail.plannedBindingLength)
                  const rollLength = resolveRollLength(detail) || (rollCount ? roundLength((detail.actualLength || detail.plannedBindingLength) / rollCount) : 0)
                  const cuttingLength = roundLength(rollLength * rollCount)
                  return `
                    <tr data-binding-detail-row="${escapeHtml(detail.detailId)}">
                      <td class="px-3 py-3">
                        <div class="font-medium text-foreground">${escapeHtml(detail.bindingStripName)}</div>
                        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${detail.bindingWidth} cm / ${detail.feiTicketNo}`)}</div>
                      </td>
                      <td class="px-3 py-3 text-xs text-muted-foreground">
                        <div class="font-medium text-foreground">${escapeHtml(detail.cuttingMethod)}</div>
                        <div class="mt-1">${escapeHtml(detail.cuttingMethodIndonesian)}</div>
                      </td>
                      <td class="px-3 py-3 text-xs text-muted-foreground">
                        <div>计划数量：${formatCount(detail.plannedGarmentQty)} 件</div>
                        <div>单件捆条：${escapeHtml(formatLength(detail.unitBindingLength))}</div>
                        <div>捆条需要：${escapeHtml(formatLength(detail.plannedBindingLength))}</div>
                        <div>需要布料：${escapeHtml(formatLength(detail.requiredLength))}</div>
                      </td>
                      <td class="px-3 py-3">
                        <input data-skip-page-rerender="true" class="h-9 w-24 rounded-md border px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value="${escapeHtml(String(detail.receivedMaterialLength || detail.requiredLength || 0))}" />
                        <span class="ml-1 text-xs text-muted-foreground">m</span>
                      </td>
                      <td class="px-3 py-3">
                        <input data-skip-page-rerender="true" data-binding-roll-length="true" class="h-9 w-24 rounded-md border px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value="${escapeHtml(String(rollLength || 0))}" />
                        <span class="ml-1 text-xs text-muted-foreground">m/卷</span>
                      </td>
                      <td class="px-3 py-3">
                        <input data-skip-page-rerender="true" data-binding-roll-count="true" class="h-9 w-20 rounded-md border px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value="${escapeHtml(String(rollCount || 0))}" />
                      </td>
                      <td class="px-3 py-3">
                        <div class="font-medium text-foreground"><span data-binding-cutting-length="true">${escapeHtml(cuttingLength.toFixed(2))}</span> m</div>
                        <div class="mt-1 text-xs text-muted-foreground">切割长度 = 每卷长度 × 实切卷数</div>
                        <div class="mt-1 text-xs text-muted-foreground">实际完成总长度同步取此值</div>
                      </td>
                      <td class="px-3 py-3">
                        <input data-skip-page-rerender="true" class="h-9 w-36 rounded-md border px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value="${escapeHtml(detail.latestRecordedAt || '2026-06-12 09:30')}" />
                      </td>
                      <td class="px-3 py-3">
                        <input data-skip-page-rerender="true" class="h-9 w-32 rounded-md border px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value="${escapeHtml(row.operatorName || 'Budi Santoso')}" />
                      </td>
                      <td class="px-3 py-3">
                        <input data-skip-page-rerender="true" class="h-9 w-44 rounded-md border px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="本次裁剪备注" />
                      </td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>
          <div class="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            记录裁剪只回写捆条加工单自身的分批裁剪记录；每个规格只维护一种切割方式，系统按“切割长度 = 每卷长度 × 实切卷数”计算实际完成总长度，并将录入结果带到菲票。
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t px-5 py-4">
          <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cutting-binding-action="close-overlay">取消</button>
          <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-skip-page-rerender="true" data-cutting-binding-action="submit-record-cutting">确认记录裁剪</button>
        </div>
      </div>
    </div>
  `
}

function renderFinishDialog(row: BindingProcessOrder): string {
  const differenceLength = row.shortageLength
  return `
    <div class="fixed inset-0 z-[130]" id="${BINDING_ACTION_MODAL_ID}" data-cutting-binding-dialog="finish">
      <button type="button" class="absolute inset-0 bg-black/45" data-skip-page-rerender="true" data-cutting-binding-action="close-overlay" aria-label="关闭弹窗"></button>
      <div class="absolute inset-x-4 top-12 mx-auto max-w-3xl rounded-xl border bg-background shadow-xl">
        <div class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold text-foreground">结束加工</h2>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(row.bindingOrderNo)} · 结束后按当前实际长度形成加工结果</p>
          </div>
          <button type="button" class="rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cutting-binding-action="close-overlay">关闭</button>
        </div>
        <div class="space-y-4 px-5 py-4">
          <div class="grid gap-3 md:grid-cols-3">
            ${renderDetailMetric('捆条需要长度', formatLength(row.plannedTotalLength))}
            ${renderDetailMetric('实际完成总长度', formatRecordedLength(row.actualTotalLength))}
            ${renderDetailMetric('缺口长度', differenceLength ? formatLength(differenceLength) : '无缺口')}
          </div>
          <div class="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
            <div class="font-medium text-foreground">结束规则</div>
            <p class="mt-1">如果实际完成总长度小于捆条需要长度，结果显示捆条不足并记录缺口；系统只记录差异，不新增“异常处理中”等加工主状态。</p>
          </div>
          <label class="block space-y-1 text-sm">
            <span class="font-medium text-foreground">结束说明 / 差异原因</span>
            <textarea data-skip-page-rerender="true" class="min-h-24 w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="例如：短裁 0.20m，主管确认手动结束。">${differenceLength ? `短裁 ${formatLength(differenceLength)}，需记录差异原因。` : '实际长度已满足计划，确认结束加工。'}</textarea>
          </label>
        </div>
        <div class="flex justify-end gap-2 border-t px-5 py-4">
          <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cutting-binding-action="close-overlay">取消</button>
          <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-skip-page-rerender="true" data-cutting-binding-action="submit-finish">确认结束加工</button>
        </div>
      </div>
    </div>
  `
}

function parseBindingNumberInput(input: HTMLInputElement | null): number {
  if (!input) return 0
  const value = Number(input.value)
  return Number.isFinite(value) ? Math.max(value, 0) : 0
}

function updateBindingCalculatedCuttingLength(row: Element | null): void {
  if (!row) return
  const rollLength = parseBindingNumberInput(row.querySelector<HTMLInputElement>('[data-binding-roll-length]'))
  const rollCount = parseBindingNumberInput(row.querySelector<HTMLInputElement>('[data-binding-roll-count]'))
  const output = row.querySelector<HTMLElement>('[data-binding-cutting-length]')
  if (!output) return
  output.textContent = roundLength(rollLength * rollCount).toFixed(2)
}

function openBindingActionModal(row: BindingProcessOrder, action: 'record-cutting' | 'finish'): void {
  removeBindingActionModal()
  const wrapper = document.createElement('div')
  wrapper.innerHTML = action === 'record-cutting'
    ? renderRecordCuttingDialog(row)
    : renderFinishDialog(row)
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
    modal.addEventListener('input', (event) => {
      const eventTarget = event.target
      if (!(eventTarget instanceof HTMLInputElement)) return
      if (!eventTarget.matches('[data-binding-roll-length], [data-binding-roll-count]')) return
      updateBindingCalculatedCuttingLength(eventTarget.closest('[data-binding-detail-row]'))
    })
    modal.querySelectorAll('[data-binding-detail-row]').forEach(updateBindingCalculatedCuttingLength)
    document.body.appendChild(modal)
  }
}

export function handleCraftCuttingSpecialProcessesEvent(target: HTMLElement): boolean {
  const button = target.closest<HTMLElement>('[data-cutting-binding-action]')
  if (!button) return false

  const action = button.dataset.cuttingBindingAction
  if (action === 'close-overlay') {
    removeBindingActionModal()
    return true
  }
  if (action === 'submit-record-cutting') {
    removeBindingActionModal()
    showBindingToast('本次裁剪记录已暂存到捆条加工单')
    return true
  }
  if (action === 'submit-finish') {
    removeBindingActionModal()
    showBindingToast('捆条加工已结束，差异只进入差异记录')
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
  if (action === 'record-cutting') {
    const row = getBindingProcessOrderById(button.dataset.rowId)
    if (row) openBindingActionModal(row, 'record-cutting')
    else showBindingToast('未找到对应捆条加工单')
    return true
  }
  if (action === 'finish') {
    const row = getBindingProcessOrderById(button.dataset.rowId)
    if (row) openBindingActionModal(row, 'finish')
    else showBindingToast('未找到对应捆条加工单')
    return true
  }
  return false
}

export function isCraftCuttingSpecialProcessesDialogOpen(): boolean {
  return Boolean(document.getElementById(BINDING_ACTION_MODAL_ID))
}
