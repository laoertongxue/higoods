import { escapeHtml } from '../../../utils.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import { getCanonicalCuttingMeta, renderCuttingPageHeader } from './meta.ts'
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
  BindingStripWorkOrderDetail,
} from './special-processes-model.ts'

const numberFormatter = new Intl.NumberFormat('zh-CN')

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

function renderSummaryPill(label: string, value: string | number, className = 'border-slate-200 bg-white text-slate-700'): string {
  return `<span class="inline-flex min-h-8 items-center gap-2 rounded-md border px-3 text-xs font-medium ${className}"><span>${escapeHtml(label)}</span><span class="font-semibold">${escapeHtml(String(value))}</span></span>`
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

function renderListOverview(rows: BindingProcessOrder[]): string {
  const totalRequired = rows.reduce((sum, row) => sum + row.plannedTotalLength, 0)
  const totalActual = rows.reduce((sum, row) => sum + row.actualTotalLength, 0)
  const minAppliedDetailCount = rows.flatMap((row) => row.bindingDetails).filter((detail) => detail.minRequiredLengthApplied).length
  return `
    <section class="rounded-lg border bg-card px-4 py-3" data-testid="cutting-binding-list-overview">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-sm font-semibold text-foreground">捆条加工单列表</h2>
          <p class="mt-1 text-xs text-muted-foreground">按物料+纸样生成加工单；每个宽度一张唯一捆条菲票，分批裁剪只写入本加工单；计划长度不足 4m 的捆条明细按 4m 起算。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${renderSummaryPill('全部', `${formatCount(rows.length)} 单`)}
          ${renderSummaryPill('待加工', `${formatCount(rows.filter((row) => row.status === '待加工').length)} 单`)}
          ${renderSummaryPill('加工中', `${formatCount(rows.filter((row) => row.status === '加工中').length)} 单`, 'border-blue-200 bg-blue-50 text-blue-700')}
          ${renderSummaryPill('已完成', `${formatCount(rows.filter((row) => row.status === '已完成').length)} 单`, 'border-emerald-200 bg-emerald-50 text-emerald-700')}
          ${renderSummaryPill('有差异', `${formatCount(rows.filter((row) => row.differenceStatus === '有差异').length)} 单`, 'border-rose-200 bg-rose-50 text-rose-700')}
          ${renderSummaryPill('4m 起算', `${formatCount(minAppliedDetailCount)} 条`, 'border-amber-200 bg-amber-50 text-amber-700')}
          ${renderSummaryPill('计划/实际', `${formatLength(totalRequired)} / ${formatLength(totalActual)}`)}
        </div>
      </div>
    </section>
  `
}

function renderListFilters(): string {
  return `
    <section class="rounded-lg border bg-card px-4 py-3" data-testid="cutting-binding-list-filters">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold text-foreground">筛选条件</h2>
        <button type="button" class="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-cutting-binding-action="refresh">刷新列表</button>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-1 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">加工单 / 来源单</span>
          <input class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="捆条单 / 裁片单 / 菲票" />
        </label>
        <label class="space-y-1 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">加工状态</span>
          <select class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
            ${['全部', '待加工', '加工中', '已完成', '已取消'].map((item) => `<option>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">菲票状态</span>
          <select class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
            ${['全部', '未生成', '待打印', '已打印'].map((item) => `<option>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">物料 / 宽度</span>
          <input class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="物料 SKU / 捆条宽度" />
        </label>
        <label class="space-y-1 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">差异状态</span>
          <select class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
            ${['全部', '无差异', '有差异'].map((item) => `<option>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
      </div>
    </section>
  `
}

function renderSourceSummary(row: BindingProcessOrder): string {
  return `
    <div class="space-y-1 text-xs text-muted-foreground">
      <p><span class="text-foreground">生产单：</span>${escapeHtml(row.sourceProductionOrderNo)}</p>
      <p><span class="text-foreground">裁片单：</span>${escapeHtml(row.sourceCutOrderNo)}</p>
      <p><span class="text-foreground">唛架方案：</span>${escapeHtml(row.sourceMarkerPlanNo || '待确认后生成')}</p>
      <p><span class="text-foreground">铺布关系：</span>不分摊到具体铺布单</p>
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
        <span>${escapeHtml(`${detail.bindingWidth} cm`)} / ${escapeHtml(formatLength(detail.requiredLength))}</span>
        ${detail.minRequiredLengthApplied ? `<span class="text-[11px] text-amber-700">原算 ${escapeHtml(formatLength(detail.rawRequiredLength))}，4m 起算</span>` : ''}
      </span>
    `)
    .join('')
}

function renderProcessSummary(row: BindingProcessOrder): string {
  return `
    <div class="space-y-1 text-xs text-muted-foreground">
      <p><span class="text-foreground">规格数：</span>${formatCount(row.bindingSpecificationCount)} 种</p>
      <p><span class="text-foreground">计划长度：</span>${escapeHtml(formatLength(row.plannedTotalLength))}</p>
      <p><span class="text-foreground">累计实际：</span>${escapeHtml(row.actualTotalLength ? formatLength(row.actualTotalLength) : '待回写')}</p>
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

function renderOrderActions(row: BindingProcessOrder): string {
  const detailHref = `/fcs/craft/cutting/special-processes/${encodeURIComponent(row.bindingOrderId)}`
  return `
    <div class="flex min-w-[10rem] flex-wrap gap-1.5">
      <a href="${escapeHtml(detailHref)}" data-nav="${escapeHtml(detailHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">查看</a>
      <button type="button" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50" data-cutting-binding-action="record-cutting" data-row-id="${escapeHtml(row.bindingOrderId)}">记录裁剪</button>
      <button type="button" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50" data-cutting-binding-action="finish" data-row-id="${escapeHtml(row.bindingOrderId)}">结束加工</button>
      <button type="button" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700" data-cutting-binding-action="print-ticket" data-row-id="${escapeHtml(row.bindingOrderId)}">打印菲票</button>
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
  const rows = buildBindingProcessOrders()
  const meta = getCanonicalCuttingMeta('/fcs/craft/cutting/special-processes', 'special-processes')

  return `
    <section class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: `
          <div class="flex flex-wrap gap-2">
            <a href="/fcs/craft/cutting/fei-tickets" data-nav="/fcs/craft/cutting/fei-tickets" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">打印捆条菲票</a>
            <a href="/fcs/craft/cutting/warehouse-management/wait-handover?inventoryType=binding" data-nav="/fcs/craft/cutting/warehouse-management/wait-handover?inventoryType=binding" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">查捆条库存</a>
            <button type="button" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50" data-cutting-binding-action="refresh">刷新</button>
          </div>
        `,
      })}
      ${renderListOverview(rows)}
      ${renderListFilters()}
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
      <table class="w-full min-w-[1040px] text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">规格</th>
            <th class="px-3 py-3">公式</th>
            <th class="px-3 py-3">计划 / 实际</th>
            <th class="px-3 py-3">菲票</th>
            <th class="px-3 py-3">流转</th>
            <th class="px-3 py-3">差异</th>
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
                <div>${escapeHtml(detail.formulaText)}</div>
                <div class="mt-1">${renderMinRequiredLengthNote(detail)}</div>
              </td>
              <td class="px-3 py-3 text-xs text-muted-foreground">
                <div>原算：${escapeHtml(formatLength(detail.rawRequiredLength))}</div>
                <div>计划：${escapeHtml(formatLength(detail.requiredLength))}</div>
                <div>实际：${escapeHtml(detail.actualLength ? formatLength(detail.actualLength) : '待回写')}</div>
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
              <td class="px-3 py-3">${renderBadge(detail.differenceStatus, differenceToneMap[detail.differenceStatus])}</td>
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
            <div class="text-sm font-medium text-foreground">${escapeHtml(`${record.bindingWidth} cm / ${formatLength(record.actualLength)}`)}</div>
            <div class="text-xs text-muted-foreground">${escapeHtml(record.operatedAt)}</div>
          </div>
          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(record.operatorName)} · ${escapeHtml(record.remark || '无备注')}</div>
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
        ${renderMetricCard('捆条规格', `${formatCount(row.bindingSpecificationCount)} 种`, '一个宽度对应一张唯一捆条菲票')}
        ${renderMetricCard('计划总长度', formatLength(row.plannedTotalLength), '公式：长度×宽度÷门幅×1.3；不足 4m 按 4m')}
        ${renderMetricCard('累计实际长度', row.actualTotalLength ? formatLength(row.actualTotalLength) : '待回写', '来自分批裁剪记录累计')}
        ${renderMetricCard('差异状态', row.differenceStatus, '只记录差异，不设置异常处理中主状态')}
      </section>

      ${renderDetailSection(
        '来源对象',
        `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderDetailMetric('来源生产单', row.sourceProductionOrderNo)}
          ${renderDetailMetric('来源裁片单', row.sourceCutOrderNo)}
          ${renderDetailMetric('来源唛架方案', row.sourceMarkerPlanNo || '待确认后生成')}
          ${renderDetailMetric('铺布单关系', '不分摊到具体铺布单')}
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

export function handleCraftCuttingSpecialProcessesEvent(target: HTMLElement): boolean {
  const button = target.closest<HTMLElement>('[data-cutting-binding-action]')
  if (!button) return false

  const action = button.dataset.cuttingBindingAction
  if (action === 'refresh') {
    showBindingToast('捆条加工单已刷新')
    return true
  }
  if (action === 'record-cutting') {
    showBindingToast('已记录本次裁剪入口；实际长度按规格累计到捆条加工单')
    return true
  }
  if (action === 'finish') {
    showBindingToast('结束加工时如未达计划长度，必须记录差异原因')
    return true
  }
  if (action === 'print-ticket') {
    showBindingToast('捆条菲票按每个宽度唯一生成')
    return true
  }
  return false
}

export function isCraftCuttingSpecialProcessesDialogOpen(): boolean {
  return false
}
