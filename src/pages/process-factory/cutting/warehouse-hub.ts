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
import { getWarehouseSearchParams } from './warehouse-shared.ts'
import {
  renderFactoryWarehouseStandardTabs,
  renderWarehouseLocationActions,
  renderWarehouseLocationToolbar,
  type FactoryWarehouseStandardTab,
} from '../shared/warehouse-standard.ts'

type WaitProcessTabKey = 'inventory' | 'receipts' | 'usage' | 'locations'
type WaitHandoverTabKey = 'inventory' | 'handouts' | 'inbounds' | 'locations'

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value)
}

function uniqueCount(values: Array<string | undefined>): number {
  return new Set(values.filter(Boolean)).size
}

function getSafeCuttingSewingDispatchSummary(): ReturnType<typeof getCuttingSewingDispatchSummary> {
  try {
    return getCuttingSewingDispatchSummary()
  } catch {
    return {
      waitingCompleteOrderCount: 0,
      readyBatchCount: 0,
      handedOverBatchCount: 0,
      writtenBackBatchCount: 0,
      differenceBatchCount: 0,
      objectionBatchCount: 0,
      remainingGarmentQty: 0,
    }
  }
}

function renderHubActionCard(options: {
  title: string
  rows: Array<[string, string | number]>
}): string {
  return `
    <article class="rounded-xl border bg-card p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-base font-semibold">${escapeHtml(options.title)}</h2>
        </div>
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

function renderHubGuideCard(title: string, lines: string[]): string {
  return `
    <article class="rounded-xl border border-dashed bg-muted/20 p-4 xl:col-span-2">
      <h2 class="text-base font-semibold">${escapeHtml(title)}</h2>
      <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
        ${lines
          .map(
            (line) => `
              <li class="flex gap-2">
                <span class="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                <span>${escapeHtml(line)}</span>
              </li>
            `,
          )
          .join('')}
      </ul>
    </article>
  `
}

function renderLocationRows(scopeLabel: string, rows: Array<[string, string, string, string]>): string {
  return `
    <div class="overflow-x-auto">
      <table class="min-w-[960px] w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">仓库</th>
            <th class="px-3 py-2 font-medium">库区</th>
            <th class="px-3 py-2 font-medium">库位</th>
            <th class="px-3 py-2 font-medium">承载对象</th>
            <th class="px-3 py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(([warehouse, area, location, object]) => `
              <tr class="border-b last:border-b-0">
                <td class="px-3 py-3">${escapeHtml(warehouse)}</td>
                <td class="px-3 py-3">${escapeHtml(area)}</td>
                <td class="px-3 py-3">${escapeHtml(location)}</td>
                <td class="px-3 py-3">${escapeHtml(object)}</td>
                <td class="px-3 py-3">${renderWarehouseLocationActions(scopeLabel, `${area}/${location}`)}</td>
              </tr>
            `)
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function readTabKey<T extends string>(fallback: T, supportedTabs: readonly T[]): T {
  const raw = getWarehouseSearchParams().get('tab')
  return supportedTabs.includes(raw as T) ? (raw as T) : fallback
}

function buildHubTabHref(
  pageKey: 'warehouse-management-wait-process' | 'warehouse-management-wait-handover',
  tabKey: string,
): string {
  const basePath = getCanonicalCuttingPath(pageKey)
  return tabKey === 'overview' ? basePath : `${basePath}?tab=${encodeURIComponent(tabKey)}`
}

function renderHubTabs(
  pageKey: 'warehouse-management-wait-process' | 'warehouse-management-wait-handover',
  activeTab: string,
  tabs: Array<{ key: string; label: string }>,
): string {
  return `
    <section class="rounded-xl border bg-card p-2">
      <div class="flex flex-wrap gap-2">
        ${tabs
          .map((tab) => {
            const isActive = tab.key === activeTab
            return `
              <button
                type="button"
                class="rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'border bg-background text-slate-700 hover:bg-muted'}"
                data-nav="${escapeHtml(buildHubTabHref(pageKey, tab.key))}"
              >
                ${escapeHtml(tab.label)}
              </button>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderHubShell(options: {
  metaKey: 'warehouse-management-wait-process' | 'warehouse-management-wait-handover'
  description: string
  kpis: string
  tabs: string
  content: string
}): string {
  const meta = getCanonicalCuttingMeta('', options.metaKey)
  return `
    <div class="space-y-5">
      ${renderCuttingPageHeader(meta)}
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${options.kpis}
      </section>
      ${options.tabs}
      ${options.content}
    </div>
  `
}

export function renderCraftCuttingWarehouseManagementWaitProcessPage(): string {
  const fabricSummary = buildFabricWarehouseProjection().viewModel.summary
  const dispatchRows = listCuttingSpecialCraftDispatchViews()
  const generatedDispatchCount = dispatchRows.filter((row) => row.handoverRecordNo && row.handoverRecordNo !== '未创建').length
  const operationCount = uniqueCount(dispatchRows.map((row) => row.operationName))
  const factoryCount = uniqueCount(dispatchRows.map((row) => row.targetFactoryName))
  const activeTab = readTabKey<WaitProcessTabKey>('inventory', ['inventory', 'receipts', 'usage', 'locations'])

  const fabricWarehouseCard = renderHubActionCard({
    title: '裁床仓',
    rows: [
      ['面料 SKU 数', fabricSummary.stockItemCount],
      ['卷数', fabricSummary.rollCount],
      ['配置长度总量', `${formatNumber(fabricSummary.configuredLengthTotal)} m`],
      ['剩余长度总量', `${formatNumber(fabricSummary.remainingLengthTotal)} m`],
      ['低余量项数', fabricSummary.lowRemainingItemCount],
    ],
  })

  const specialCraftDispatchCard = renderHubActionCard({
    title: '特殊工艺待加工 / 发料',
    rows: [
      ['待发记录数', dispatchRows.length],
      ['已生成发料单数', generatedDispatchCount],
      ['涉及工艺数', operationCount],
      ['涉及工厂数', factoryCount],
    ],
  })

  const standardTabs: FactoryWarehouseStandardTab[] = [
    {
      key: 'inventory',
      label: '库存',
      count: fabricSummary.stockItemCount + dispatchRows.length,
      content: `<section class="grid gap-4 xl:grid-cols-2">${fabricWarehouseCard}${specialCraftDispatchCard}</section>`,
    },
    {
      key: 'receipts',
      label: '领料记录',
      count: fabricSummary.rollCount + generatedDispatchCount,
      content: `<section class="grid gap-4 xl:grid-cols-2">
        ${renderHubActionCard({
          title: '面料领料记录',
          rows: [
            ['WMS 来料卷数', fabricSummary.rollCount],
            ['面料 SKU 数', fabricSummary.stockItemCount],
            ['配置长度总量', `${formatNumber(fabricSummary.configuredLengthTotal)} m`],
            ['低余量项数', fabricSummary.lowRemainingItemCount],
          ],
        })}
        ${renderHubActionCard({
          title: '特殊工艺发料记录',
          rows: [
            ['待发记录数', dispatchRows.length],
            ['已生成发料单数', generatedDispatchCount],
            ['涉及工艺数', operationCount],
            ['涉及工厂数', factoryCount],
          ],
        })}
      </section>`,
    },
    {
      key: 'usage',
      label: '加工用料记录',
      count: fabricSummary.stockItemCount,
      content: `<section class="grid gap-4 xl:grid-cols-2">
        ${renderHubActionCard({
          title: '铺布裁剪用料',
          rows: [
            ['配置长度总量', `${formatNumber(fabricSummary.configuredLengthTotal)} m`],
            ['剩余长度总量', `${formatNumber(fabricSummary.remainingLengthTotal)} m`],
            ['已用长度估算', `${formatNumber(Math.max(fabricSummary.configuredLengthTotal - fabricSummary.remainingLengthTotal, 0))} m`],
            ['低余量项数', fabricSummary.lowRemainingItemCount],
          ],
        })}
        ${renderHubGuideCard('用料口径', ['待加工仓库存由 WMS 来料形成。', '铺布、裁剪、特殊工艺发料会扣减待加工仓库存。'])}
      </section>`,
    },
    {
      key: 'locations',
      label: '库区库位',
      count: 3,
      content: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('裁床待加工仓')}</div>${renderLocationRows('裁床待加工仓', [
        ['裁床待加工仓', '面料 A 区', 'FAB-A-01', '待裁面料'],
        ['裁床待加工仓', '面料 B 区', 'FAB-B-02', '补料 / 余料'],
        ['特殊工艺待发区', '发料暂存区', 'SP-DISPATCH-01', '待发特殊工艺裁片'],
      ])}`,
    },
  ]

  return renderHubShell({
    metaKey: 'warehouse-management-wait-process',
    description: '查看 WMS 来料接收后的待加工仓、裁床仓和特殊工艺待加工。',
    kpis: [
      renderCompactKpiCard('面料 SKU 数', fabricSummary.stockItemCount, '裁床仓', 'text-blue-600'),
      renderCompactKpiCard('卷数', fabricSummary.rollCount, '裁床仓', 'text-slate-700'),
      renderCompactKpiCard('配置长度总量', `${formatNumber(fabricSummary.configuredLengthTotal)} m`, '裁床仓', 'text-blue-600'),
      renderCompactKpiCard('待发特殊工艺记录数', dispatchRows.length, '特殊工艺发料', 'text-amber-600'),
    ].join(''),
    tabs: '',
    content: renderFactoryWarehouseStandardTabs(
      standardTabs.sort((a, b) => Number(b.key === activeTab) - Number(a.key === activeTab)),
      'cutting-wait-process-standard-tabs',
    ),
  })
}

export function renderCraftCuttingWarehouseManagementWaitHandoverPage(): string {
  const cutPieceSummary = buildCutPieceWarehouseProjection().viewModel.summary
  const returnRows = listCuttingSpecialCraftReturnViews()
  const sewingSummary = getSafeCuttingSewingDispatchSummary()
  const completedReturnCount = returnRows.filter((row) => row.returnStatus === '已回仓').length
  const returnDifferenceCount = returnRows.filter((row) => row.returnStatus === '差异' || row.differenceQty > 0).length
  const activeTab = readTabKey<WaitHandoverTabKey>('inventory', ['inventory', 'handouts', 'inbounds', 'locations'])

  const cutPieceWarehouseCard = renderHubActionCard({
    title: '裁片仓',
    rows: [
      ['记录数', cutPieceSummary.totalItemCount],
      ['裁片总数量', cutPieceSummary.totalQuantity],
      ['待交数量', cutPieceSummary.waitingHandoffCount],
      ['已入仓数量', cutPieceSummary.inWarehouseCount],
    ],
  })

  const specialCraftReturnCard = renderHubActionCard({
    title: '特殊工艺回仓',
    rows: [
      ['回仓记录数', returnRows.length],
      ['已完成回仓数', completedReturnCount],
      ['差异数', returnDifferenceCount],
    ],
  })

  const sewingDispatchCard = renderHubActionCard({
    title: '裁片发料',
    rows: [
      ['待配齐发料单数', sewingSummary.waitingCompleteOrderCount],
      ['可交出批次', sewingSummary.readyBatchCount],
      ['已交出批次', sewingSummary.handedOverBatchCount],
      ['差异批次', sewingSummary.differenceBatchCount],
    ],
  })

  const standardTabs: FactoryWarehouseStandardTab[] = [
    {
      key: 'inventory',
      label: '库存',
      count: cutPieceSummary.totalItemCount + returnRows.length,
      content: `<section class="grid gap-4 xl:grid-cols-2">${cutPieceWarehouseCard}${specialCraftReturnCard}</section>`,
    },
    {
      key: 'handouts',
      label: '交出记录',
      count: sewingSummary.handedOverBatchCount + returnRows.length,
      content: `<section class="grid gap-4 xl:grid-cols-2">${sewingDispatchCard}${specialCraftReturnCard}</section>`,
    },
    {
      key: 'inbounds',
      label: '加工入仓记录',
      count: cutPieceSummary.inWarehouseCount + completedReturnCount,
      content: `<section class="grid gap-4 xl:grid-cols-2">
        ${renderHubActionCard({
          title: '裁片加工入仓',
          rows: [
            ['记录数', cutPieceSummary.totalItemCount],
            ['裁片总数量', cutPieceSummary.totalQuantity],
            ['已入仓数量', cutPieceSummary.inWarehouseCount],
            ['待交数量', cutPieceSummary.waitingHandoffCount],
          ],
        })}
        ${renderHubActionCard({
          title: '特殊工艺回仓入仓',
          rows: [
            ['回仓记录数', returnRows.length],
            ['已完成回仓数', completedReturnCount],
            ['差异数', returnDifferenceCount],
          ],
        })}
      </section>`,
    },
    {
      key: 'locations',
      label: '库区库位',
      count: 3,
      content: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('裁床待交出仓')}</div>${renderLocationRows('裁床待交出仓', [
        ['裁床待交出仓', '裁片 A 区', 'CUT-A-01', '待发车缝裁片'],
        ['裁床待交出仓', '特殊工艺回仓区', 'SP-RETURN-01', '回仓裁片'],
        ['裁床待交出仓', '中转袋暂存区', 'BAG-A-01', '待交出中转袋'],
      ])}`,
    },
  ]

  return renderHubShell({
    metaKey: 'warehouse-management-wait-handover',
    description: '查看铺布裁剪后的待交出仓、裁片仓、特殊工艺回仓和裁片发车缝。',
    kpis: [
      renderCompactKpiCard('裁片仓记录数', cutPieceSummary.totalItemCount, '裁片仓', 'text-blue-600'),
      renderCompactKpiCard('裁片总数量', cutPieceSummary.totalQuantity, '裁片仓', 'text-slate-700'),
      renderCompactKpiCard('待交数量', cutPieceSummary.waitingHandoffCount, '裁片仓', 'text-amber-600'),
      renderCompactKpiCard('特殊工艺回仓记录数', returnRows.length, '特殊工艺回仓', 'text-blue-600'),
      renderCompactKpiCard('可交出批次数', sewingSummary.readyBatchCount, '裁片发料', 'text-emerald-600'),
    ].join(''),
    tabs: '',
    content: renderFactoryWarehouseStandardTabs(
      standardTabs.sort((a, b) => Number(b.key === activeTab) - Number(a.key === activeTab)),
      'cutting-wait-handover-standard-tabs',
    ),
  })
}
