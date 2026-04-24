import {
  listCuttingSpecialCraftDispatchViews,
  listCuttingSpecialCraftReturnViews,
} from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import { getCuttingSewingDispatchSummary } from '../../../data/fcs/cutting/sewing-dispatch.ts'
import { escapeHtml } from '../../../utils.ts'
import { buildCutPieceWarehouseProjection } from './cut-piece-warehouse-projection.ts'
import { buildFabricWarehouseProjection } from './fabric-warehouse-projection.ts'
import { renderCompactKpiCard } from './layout.helpers.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta.ts'

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value)
}

function uniqueCount(values: Array<string | undefined>): number {
  return new Set(values.filter(Boolean)).size
}

function renderHubActionCard(options: {
  title: string
  description: string
  rows: Array<[string, string | number]>
  href: string
  actionLabel: string
}): string {
  return `
    <article class="rounded-xl border bg-card p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-base font-semibold">${escapeHtml(options.title)}</h2>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(options.description)}</p>
        </div>
        <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(options.href)}">
          ${escapeHtml(options.actionLabel)}
        </button>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        ${options.rows
          .map(
            ([label, value]) => `
              <div class="rounded-lg border bg-background px-3 py-2">
                <dt class="text-xs text-muted-foreground">${escapeHtml(label)}</dt>
                <dd class="mt-1 text-base font-semibold tabular-nums">${escapeHtml(String(value))}</dd>
              </div>
            `,
          )
          .join('')}
      </dl>
    </article>
  `
}

function renderHubShell(options: {
  metaKey: 'warehouse-management-wait-process' | 'warehouse-management-wait-handover'
  description: string
  kpis: string
  cards: string
}): string {
  const meta = getCanonicalCuttingMeta('', options.metaKey)
  return `
    <div class="space-y-5">
      ${renderCuttingPageHeader(meta)}
      <section class="rounded-xl border bg-card p-4">
        <p class="text-sm text-muted-foreground">${escapeHtml(options.description)}</p>
      </section>
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${options.kpis}
      </section>
      <section class="grid gap-4 xl:grid-cols-2">
        ${options.cards}
      </section>
    </div>
  `
}

export function renderCraftCuttingWarehouseManagementWaitProcessPage(): string {
  const fabricSummary = buildFabricWarehouseProjection().viewModel.summary
  const dispatchRows = listCuttingSpecialCraftDispatchViews()
  const generatedDispatchCount = dispatchRows.filter((row) => row.handoverRecordNo && row.handoverRecordNo !== '未创建').length
  const operationCount = uniqueCount(dispatchRows.map((row) => row.operationName))
  const factoryCount = uniqueCount(dispatchRows.map((row) => row.targetFactoryName))

  return renderHubShell({
    metaKey: 'warehouse-management-wait-process',
    description: '集中查看裁床仓与特殊工艺发料',
    kpis: [
      renderCompactKpiCard('面料 SKU 数', fabricSummary.stockItemCount, '裁床仓', 'text-blue-600'),
      renderCompactKpiCard('卷数', fabricSummary.rollCount, '裁床仓', 'text-slate-700'),
      renderCompactKpiCard('配置长度总量', `${formatNumber(fabricSummary.configuredLengthTotal)} m`, '裁床仓', 'text-blue-600'),
      renderCompactKpiCard('待发特殊工艺记录数', dispatchRows.length, '特殊工艺发料', 'text-amber-600'),
    ].join(''),
    cards: [
      renderHubActionCard({
        title: '裁床仓',
        description: '查看裁床仓面料、卷号、长度和低余量状态。',
        href: getCanonicalCuttingPath('fabric-warehouse'),
        actionLabel: '进入裁床仓',
        rows: [
          ['面料 SKU 数', fabricSummary.stockItemCount],
          ['卷数', fabricSummary.rollCount],
          ['配置长度总量', `${formatNumber(fabricSummary.configuredLengthTotal)} m`],
          ['剩余长度总量', `${formatNumber(fabricSummary.remainingLengthTotal)} m`],
          ['低余量项数', fabricSummary.lowRemainingItemCount],
        ],
      }),
      renderHubActionCard({
        title: '特殊工艺发料',
        description: '查看待发特殊工艺菲票、发料单与接收状态。',
        href: getCanonicalCuttingPath('special-craft-dispatch'),
        actionLabel: '进入特殊工艺发料',
        rows: [
          ['待发记录数', dispatchRows.length],
          ['已生成发料单数', generatedDispatchCount],
          ['涉及工艺数', operationCount],
          ['涉及工厂数', factoryCount],
        ],
      }),
    ].join(''),
  })
}

export function renderCraftCuttingWarehouseManagementWaitHandoverPage(): string {
  const cutPieceSummary = buildCutPieceWarehouseProjection().viewModel.summary
  const returnRows = listCuttingSpecialCraftReturnViews()
  const sewingSummary = getCuttingSewingDispatchSummary()
  const completedReturnCount = returnRows.filter((row) => row.returnStatus === '已回仓').length
  const returnDifferenceCount = returnRows.filter((row) => row.returnStatus === '差异' || row.differenceQty > 0).length

  return renderHubShell({
    metaKey: 'warehouse-management-wait-handover',
    description: '集中查看裁片仓、特殊工艺回仓与裁片发料',
    kpis: [
      renderCompactKpiCard('裁片仓记录数', cutPieceSummary.totalItemCount, '裁片仓', 'text-blue-600'),
      renderCompactKpiCard('裁片总数量', cutPieceSummary.totalQuantity, '裁片仓', 'text-slate-700'),
      renderCompactKpiCard('待交数量', cutPieceSummary.waitingHandoffCount, '裁片仓', 'text-amber-600'),
      renderCompactKpiCard('特殊工艺回仓记录数', returnRows.length, '特殊工艺回仓', 'text-blue-600'),
      renderCompactKpiCard('可交出批次数', sewingSummary.readyBatchCount, '裁片发料', 'text-emerald-600'),
    ].join(''),
    cards: [
      renderHubActionCard({
        title: '裁片仓',
        description: '查看裁片入仓、待交和库区位置。',
        href: getCanonicalCuttingPath('cut-piece-warehouse'),
        actionLabel: '进入裁片仓',
        rows: [
          ['记录数', cutPieceSummary.totalItemCount],
          ['裁片总数量', cutPieceSummary.totalQuantity],
          ['待交数量', cutPieceSummary.waitingHandoffCount],
          ['已入仓数量', cutPieceSummary.inWarehouseCount],
        ],
      }),
      renderHubActionCard({
        title: '特殊工艺回仓',
        description: '查看特殊工艺回裁床后的回仓与差异。',
        href: getCanonicalCuttingPath('special-craft-return'),
        actionLabel: '进入特殊工艺回仓',
        rows: [
          ['回仓记录数', returnRows.length],
          ['已完成回仓数', completedReturnCount],
          ['差异数', returnDifferenceCount],
        ],
      }),
      renderHubActionCard({
        title: '裁片发料',
        description: '查看裁片发车缝前的齐套、交出和回写差异。',
        href: getCanonicalCuttingPath('sewing-dispatch'),
        actionLabel: '进入裁片发料',
        rows: [
          ['待配齐发料单数', sewingSummary.waitingCompleteOrderCount],
          ['可交出批次', sewingSummary.readyBatchCount],
          ['已交出批次', sewingSummary.handedOverBatchCount],
          ['差异批次', sewingSummary.differenceBatchCount],
        ],
      }),
    ].join(''),
  })
}
